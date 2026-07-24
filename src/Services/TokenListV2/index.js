// Token list v2 fetch service — EVM-only, per-account.
// For each chain in SUPPORTED_CHAINS_BY_SERVICE_MORALIS (keyed by chainId, so
// custom chains in that list are supported too) we fetch balances from Moralis,
// then map prices/metadata from the Keyring API:
//   - price = Keyring price first; if Keyring has the token but its price is
//     missing/zero, fall back to Moralis `usd_price`
//   - a token with balance but NO Keyring entry lands in the hidden list
// All token + metadata + detail fields are stored directly on each token entry
// (no separate meta redux) since the account count is bounded.

import MoralisService from 'src/Services/Moralis'
import ReduxService from 'common/redux'
import BaseAPI from 'controller/API/BaseAPI'
import CoinGeckoAPI from 'controller/API/CoinGeckoAPI'
import { SUPPORTED_CHAINS_BY_SERVICE_MORALIS, MULTICALL3_CHAIN_IDS } from 'common/constants/chain'
import { lowerCase, getChainInfo, getRpcUrlByChain } from 'common/function'
import { erc20Abi, formatUnits, isAddress } from 'viem'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { isNativeToken } from 'common/tokens'

// Multicall3 deployment is the same address across most EVM chains.
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'
const MULTICALL3_ABI = [
  {
    inputs: [{ name: 'addr', type: 'address' }],
    name: 'getEthBalance',
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
]

const NATIVE = 'native'

// Mirrors MIN_VALUE_USD in TokenList/page.js — the threshold below which a
// (non-manually-shown) token is excluded from the visible list. Kept local so
// this service doesn't depend on the Frontend layer; keep the two in sync.
const MIN_VISIBLE_VALUE_USD = 0.01

// Per-token RPC reads (sequential fallback) run in bounded-concurrency batches —
// fast enough without blasting the RPC as one giant burst.
const SEQUENTIAL_RPC_CONCURRENCY = 8

// Unified Keyring token API for every EVM chain — served from the default API
// base URL (relative path, via BaseAPI), same as the single-token lookups.
const KEYRING_TOKENS_ALL_API = 'keyrings/tokens/all'

const MAX_ADDRESSES_FOR_QUERY = 150

// The custom-chain API caps each response at a small default page size and now
// returns a paginated envelope: { items, currentPage, totalPage, nextPage, ... }
// with nextPage === null on the last page. We page through with limit=200 and
// follow the nextPage cursor so the whole token list is fetched, not just the
// first page. The page cap is a safety net against a misbehaving cursor.
const CUSTOM_API_PAGE_LIMIT = 200
const CUSTOM_API_MAX_PAGES = 200

const fetchAllCustomApiTokens = async (chainId, query = null) => {
  const all = []
  let page = 1
  for (let i = 0; i < CUSTOM_API_MAX_PAGES; i++) {
    const res = await BaseAPI.getData(
      `${KEYRING_TOKENS_ALL_API}/${chainId}`,
      { ...(query || {}), limit: CUSTOM_API_PAGE_LIMIT, page }
    )
    const items = res?.items
    if (!Array.isArray(items) || items.length === 0) break
    all.push(...items)
    if (!res?.nextPage) break
    page = res.nextPage
  }
  return all
}

const buildMetaKey = (chainId, contractAddress) => `${chainId}:${contractAddress}`

const normalizeContractAddress = (row) => {
  if (row?.native_token) return NATIVE
  const addr = row?.token_address
  return addr ? lowerCase(addr) : NATIVE
}

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// The unified token endpoint (`/keyrings/tokens/all/{chainId}`, see
// KEYRING_TOKENS_ALL_API) returns symbols all-lowercased (e.g. "usdc.e", "weth").
// NOTE: this is NOT the same as `/keyrings/tokens/custom/{chainId}`, which keeps
// them uppercase; the app does not call that one. The Moralis source keeps
// uppercase. Normalize an ALL-lowercase symbol to uppercase so these chains
// match every other chain in the list; leave a symbol that already has any
// uppercase (e.g. "stETH") untouched so we don't mangle intended casing.
const normalizeSymbol = (symbol) => {
  const s = symbol || ''
  return s && s === s.toLowerCase() ? s.toUpperCase() : s
}

const buildSocials = (k) => ({
  telegram_channel_identifier: k?.telegram_channel_identifier || null,
  subreddit_url: k?.subreddit_url || null,
  facebook_username: k?.facebook_username || null,
  twitter_screen_name: k?.twitter_screen_name || null,
  homepage: k?.homepage || null,
  announcement_url: k?.announcement_url || null,
  chat_url: k?.chat_url || null
})

// Fetch the Keyring token list used for price + metadata. All EVM chains now go
// through the unified `keyrings/tokens/all/{chainId}` endpoint.
export const fetchKeyringTokens = async (chainId, contractAddresses) => {
  let query
  if (contractAddresses.length === 0) query = { isTop: true }
  else if (contractAddresses.length > MAX_ADDRESSES_FOR_QUERY) query = null
  else query = { addresses: contractAddresses.join(',') }

  return fetchAllCustomApiTokens(chainId, query)
}

// Find the matching Keyring token for a Moralis row.
// Native → match by symbol with no address; ERC20 → match by contract address.
const findKeyringMatch = (keyringList, row) => {
  if (row?.native_token) {
    const symbol = lowerCase(row?.symbol)
    return (keyringList || []).find((k) => {
      if (k?.address) return false
      return lowerCase(k?.symbol) === symbol || lowerCase(k?.auditGoplus?.token_symbol) === symbol
    })
  }
  const addr = lowerCase(row?.token_address)
  return (keyringList || []).find((k) => lowerCase(k?.address) === addr)
}

// Build a minimal viem chain config from blockchainListRedux + the resolved
// RPC URL. We don't need anything beyond id/name/nativeCurrency/rpcUrls for
// multicall reads.
export const buildViemChain = (chainId, rpcUrl) => {
  const info = getChainInfo(chainId) || {}
  const symbol = info?.nativeCurrency?.symbol || 'ETH'
  // Ordered RPC list (paid linkProvider first for stability). When a caller
  // passes an explicit rpcUrl, force it to the front and de-dupe.
  const httpList = ViemWeb3.getListRpc(chainId)
  // const httpList = rpcUrl ? [rpcUrl, ...list.filter(url => url !== rpcUrl)] : list
  return {
    id: Number(chainId),
    name: info?.name || `Chain ${chainId}`,
    nativeCurrency: { name: symbol, symbol, decimals: 18 },
    rpcUrls: { default: { http: httpList } }
  }
}

// Transform a Keyring custom-API entry + on-chain balance (bigint from
// multicall) → token entry. Returns null for zero/invalid balances. Tokens
// without a Keyring price land in the hidden list (isHidden: true).
const transformMulticallEntry = (chainId, keyring, rawBalance) => {
  if (!keyring || rawBalance == null) return null
  const isNative = !keyring?.address
  // Native balance comes from getEthBalance/getBalance, which always returns wei
  // (18 decimals on EVM) regardless of the token's symbol. Use 18 for native and
  // ignore the Keyring entry's `decimals` — the custom token API can list a
  // native stablecoin (e.g. USDT0 on chain 988) with 6 decimals, which would
  // inflate the balance ~1e12x. ERC20s keep their own decimals.
  const decimals = isNative ? 18 : Number(keyring?.decimals ?? 18)
  let balanceFormatted = 0
  try {
    balanceFormatted = Number(formatUnits(rawBalance, decimals))
  } catch {
    return null
  }
  if (!Number.isFinite(balanceFormatted) || balanceFormatted <= 0) return null

  const contractAddress = isNative ? NATIVE : lowerCase(keyring.address)
  const priceUSD = toNumber(keyring?.price)
  const isHidden = priceUSD <= 0
  const valueUSD = balanceFormatted * priceUSD

  return {
    chainId,
    contractAddress,
    metaKey: buildMetaKey(chainId, contractAddress),
    symbol: normalizeSymbol(keyring?.auditGoplus?.token_symbol || keyring?.symbol || ''),
    name: keyring?.name || keyring?.symbol || '',
    iconUrl: keyring?.icon_image || '',
    decimals,
    isNative,
    isVerified: false,
    isPossibleSpam: false,
    balance: rawBalance.toString(),
    balanceFormatted,
    priceUSD,
    valueUSD,
    priceChange24hPct: toNumber(keyring?.price_change_percentage_24h),
    coinGeckoId: keyring?.coinGeckoId || keyring?.idCoinGecko || null,
    marketCapRank: keyring?.market_cap_rank || null,
    categories: keyring?.categories || null,
    socials: buildSocials(keyring),
    isCustom: false,
    isHidden,
    isManuallyShown: false
  }
}

// Transform one Moralis row + its Keyring match → token entry. Price priority
// is Keyring first; if Keyring has the token info but its price field is
// missing/zero, fall back to Moralis `usd_price`. A token with balance but no
// Keyring entry (or no price from either source) still lands in the hidden
// list (isHidden: true). Returns null only when there's no balance to show.
const transformRow = (chainId, row, keyring) => {
  const contractAddress = normalizeContractAddress(row)
  const balanceFormatted = toNumber(row?.balance_formatted)
  if (balanceFormatted <= 0) return null

  const keyringPrice = toNumber(keyring?.price)
  const moralisPrice = toNumber(row?.usd_price)
  const priceUSD = keyringPrice > 0 ? keyringPrice : moralisPrice
  const isHidden = !keyring || priceUSD <= 0
  const valueUSD = balanceFormatted * priceUSD

  return {
    chainId,
    contractAddress,
    metaKey: buildMetaKey(chainId, contractAddress),
    symbol: normalizeSymbol(keyring?.auditGoplus?.token_symbol || keyring?.symbol || row?.symbol || ''),
    name: keyring?.name || row?.name || keyring?.symbol || row?.symbol || '',
    iconUrl: keyring?.icon_image || row?.logo || row?.thumbnail || '',
    decimals: keyring?.decimals ?? row?.decimals ?? 18,
    isNative: !!row?.native_token,
    isVerified: !!row?.verified_contract,
    isPossibleSpam: !!row?.possible_spam,
    balance: row?.balance || '0',
    balanceFormatted,
    priceUSD,
    valueUSD,
    priceChange24hPct: toNumber(keyring?.price_change_percentage_24h),
    coinGeckoId: keyring?.coinGeckoId || keyring?.idCoinGecko || null,
    marketCapRank: keyring?.market_cap_rank || null,
    categories: keyring?.categories || null,
    socials: buildSocials(keyring),
    isCustom: false,
    isHidden,
    isManuallyShown: false
  }
}

// Fetch via Moralis (chains in SUPPORTED_CHAINS_BY_SERVICE_MORALIS).
const fetchChainTokensViaMoralis = async (chainId, address) => {
  const moralisChain = SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]
  if (!moralisChain) return []

  const rows = await MoralisService.getTokenBalanceByWallet(address, moralisChain)
  if (!rows || rows.length === 0) return []

  const contractAddresses = rows
    .filter((r) => r?.token_address)
    .map((r) => r.token_address)

  const keyringList = await fetchKeyringTokens(chainId, contractAddresses)

  const tokens = []
  rows.forEach((row) => {
    const keyring = findKeyringMatch(keyringList, row)
    const entry = transformRow(chainId, row, keyring)
    if (entry) tokens.push(entry)
  })
  return tokens
}

// Fallback for chains whose token list the custom API doesn't return (e.g.
// testnets / freshly-added chains). We can't discover ERC20s without a list,
// but we can still read the NATIVE balance directly over RPC and price it via
// the chain's coinGeckoId (from blockchainListRedux — same source the legacy
// flow used). Treated like any other token: it shows in the visible list only
// when it has a real USD value (priced AND valueUSD >= MIN_VISIBLE_VALUE_USD);
// otherwise (no price, or dust) it lands in the hidden list.
const fetchNativeOnlyTokens = async (chainId, address, rpcUrl) => {
  const client = ViemWeb3.getPublicClient(chainId, rpcUrl)

  let rawBalance
  try {
    rawBalance = await client.getBalance({ address })
  } catch {
    return []
  }
  if (rawBalance == null) return []

  let balanceFormatted = 0
  try {
    balanceFormatted = Number(formatUnits(rawBalance, 18))
  } catch {
    return []
  }
  if (!Number.isFinite(balanceFormatted) || balanceFormatted <= 0) return []

  const native = getChainInfo(chainId)?.nativeCurrency || {}
  const coinGeckoId = native?.coinGeckoId || null

  let priceUSD = 0
  let priceChange24hPct = 0
  let iconUrl = native?.icon || ''
  if (coinGeckoId) {
    const data = await CoinGeckoAPI.getTokenInfoById(coinGeckoId)
    priceUSD = toNumber(data?.market_data?.current_price?.usd)
    priceChange24hPct = toNumber(data?.market_data?.price_change_percentage_24h)
    iconUrl = data?.image?.small || iconUrl
  }

  const valueUSD = balanceFormatted * priceUSD
  // Native-only fallback chains have no token list to discover ERC20s and often
  // no CoinGecko price. Show the native token whenever it has a balance (already
  // guaranteed > 0 above) instead of burying it in the Hidden list. Mark it
  // isManuallyShown so the UI's MIN_VALUE_USD dust filter doesn't re-hide the
  // unpriced case (valueUSD = 0).
  const isHidden = false

  return [{
    chainId,
    contractAddress: NATIVE,
    metaKey: buildMetaKey(chainId, NATIVE),
    symbol: native?.symbol || '',
    name: native?.name || native?.symbol || '',
    iconUrl,
    decimals: 18,
    isNative: true,
    isVerified: false,
    isPossibleSpam: false,
    balance: rawBalance.toString(),
    balanceFormatted,
    priceUSD,
    valueUSD,
    priceChange24hPct,
    coinGeckoId,
    marketCapRank: null,
    categories: null,
    socials: buildSocials(null),
    isCustom: false,
    isHidden,
    isManuallyShown: true
  }]
}

// Fetch via viem multicall (chains NOT supported by Moralis). Discovery list
// comes from the Keyring custom API (full list, no isTop), then a single
// Multicall3.aggregate3 fans out balanceOf(wallet) for every ERC20 plus
// getEthBalance(wallet) for the native token. RPC URL is resolved via
// getRpcUrlByChain (Quicknode-first; falls back to the chain's linkProvider).
const fetchChainTokensViaMulticall = async (chainId, address, isCallAPIGetRpc = false) => {
  let rpcUrl = getRpcUrlByChain(Number(chainId))

  if (isCallAPIGetRpc && (!rpcUrl || rpcUrl?.length === 0)) {
    try {
      const data = await BaseAPI.getBlockChainList()
      const chainInfo = (data || {})[chainId?.toString()]

      if (chainInfo) {
        const rpcTemp = []

        if (chainInfo?.linkProvider) {
          rpcTemp.push(chainInfo.linkProvider)
        }

        if (chainInfo?.rpcs?.length > 0) {
          rpcTemp.push(...chainInfo.rpcs)
        }
        if (rpcTemp.length > 0) {
          rpcUrl = rpcTemp.filter(rpc => !!rpc && rpc?.startsWith('http'))
        }
      }
    } catch { }
  }

  if (!rpcUrl) return []

  let keyringList = []
  try {
    keyringList = await fetchAllCustomApiTokens(chainId)
  } catch {
    keyringList = []
  }
  // No discovery list (testnet / unindexed chain) → at least read native balance.
  if (!Array.isArray(keyringList) || keyringList.length === 0) {
    return fetchNativeOnlyTokens(chainId, address, rpcUrl)
  }

  // const chain = buildViemChain(chainId, rpcUrl)
  // const client = createPublicClient({ chain, transport: http(rpcUrl) })
  const client = ViemWeb3.getPublicClient(chainId, rpcUrl)

  keyringList = keyringList.filter((k) => k?.address === '' || isAddress(k?.address))

  const contracts = keyringList.map((t) => {
    return (
      t?.address
        ? { address: t.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] }
        : { address: MULTICALL3_ADDRESS, abi: MULTICALL3_ABI, functionName: 'getEthBalance', args: [address] }
    )
  })
  let results
  try {
    results = await client.multicall({
      contracts,
      allowFailure: true,
      multicallAddress: MULTICALL3_ADDRESS
    })
  } catch {
    return []
  }

  const tokens = []
  results.forEach((r, i) => {
    if (r?.status !== 'success' || r.result == null) return
    const entry = transformMulticallEntry(chainId, keyringList[i], r.result)
    if (entry) tokens.push(entry)
  })
  return tokens
}

// Fetch via sequential (bounded-concurrency) per-token RPC reads — the fallback
// for chains with NEITHER Moralis support NOR a Multicall3 deployment. Same
// discovery list as the multicall path; each token's balance is read directly
// with getBalance (native) / balanceOf (ERC20), so it works on any plain RPC.
const fetchChainTokensViaSequentialRpc = async (chainId, address) => {
  const rpcUrl = getRpcUrlByChain(Number(chainId))
  if (!rpcUrl) return []

  let keyringList = []
  try {
    keyringList = await fetchAllCustomApiTokens(chainId)
  } catch {
    keyringList = []
  }
  // No discovery list (testnet / unindexed chain) → at least read native balance.
  if (!Array.isArray(keyringList) || keyringList.length === 0) {
    return fetchNativeOnlyTokens(chainId, address, rpcUrl)
  }

  keyringList = keyringList.filter((k) => k?.address === '' || isAddress(k?.address))

  // const chain = buildViemChain(chainId, rpcUrl)
  // const client = createPublicClient({ chain, transport: http(rpcUrl) })
  const client = ViemWeb3.getPublicClient(chainId, rpcUrl)

  const readBalance = async (k) => {
    try {
      if (!k?.address) return await client.getBalance({ address })
      return await client.readContract({
        address: k.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address]
      })
    } catch {
      return null
    }
  }

  const tokens = []
  for (let i = 0; i < keyringList.length; i += SEQUENTIAL_RPC_CONCURRENCY) {
    const batch = keyringList.slice(i, i + SEQUENTIAL_RPC_CONCURRENCY)
    const balances = await Promise.all(batch.map(readBalance))
    balances.forEach((rawBalance, j) => {
      if (rawBalance == null) return
      const entry = transformMulticallEntry(chainId, batch[j], rawBalance)
      if (entry) tokens.push(entry)
    })
  }
  return tokens
}

// A "fast" chain returns its balances in a single round-trip (Moralis API or one
// Multicall3 call). Everything else is "slow" — it falls back to per-token RPC
// reads. Used to decide which chains the loading indicator waits on.
const isFastChain = (chainId) =>
  !!SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId] || MULTICALL3_CHAIN_IDS.has(Number(chainId))

// Route by capability (fastest first, always-works last):
//   1. Moralis-supported          → Moralis (one API call)
//   2. Multicall3 deployed        → viem multicall (one RPC call)
//   3. otherwise                  → sequential per-token RPC reads
export const fetchChainTokens = async (chainId, address, isCallAPIGetRpc = false) => {
  if (!chainId || !address) return []
  if (SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]) {
    return fetchChainTokensViaMoralis(chainId, address)
  }
  if (MULTICALL3_CHAIN_IDS.has(Number(chainId))) {
    return fetchChainTokensViaMulticall(chainId, address, isCallAPIGetRpc)
  }
  return fetchChainTokensViaSequentialRpc(chainId, address)
}

// Commit ONE chain's freshly-fetched tokens into the account entry, replacing
// only that chain's tokens and leaving every other chain untouched. This lets
// chains land progressively (a slow chain never blocks a fast one from showing).
// Commits are synchronous read-modify-write, so the event loop serializes them
// and there's no lost-update race between concurrent chain fetches.
const commitChainTokens = (address, chainId, chainTokens) => {
  const currentList = ReduxService.getAccountTokenList()
  const prevTokens = currentList[address]?.tokens || []
  const id = Number(chainId)

  // Flags to carry over (keyed by metaKey) + this chain's previous custom tokens.
  const prevByKey = {}
  prevTokens.forEach((t) => { prevByKey[t.metaKey] = t })

  // Tokens from OTHER chains are kept verbatim.
  const otherChainTokens = prevTokens.filter((t) => Number(t.chainId) !== id)

  // This chain's fresh tokens inherit hide/custom/manual flags from the snapshot.
  const merged = chainTokens.map((t) => {
    const prevT = prevByKey[t.metaKey]
    if (!prevT) return t
    return {
      ...t,
      isHidden: !!prevT.isHidden,
      isCustom: !!prevT.isCustom,
      isManuallyShown: !!prevT.isManuallyShown
    }
  })

  // Re-attach this chain's custom tokens that the fetch didn't return.
  prevTokens.forEach((prevT) => {
    if (prevT?.isCustom && Number(prevT.chainId) === id && !merged.find((t) => t.metaKey === prevT.metaKey)) {
      merged.push(prevT)
    }
  })

  const allTokens = [...otherChainTokens, ...merged]
  allTokens.sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0))
  const totalUSD = allTokens.reduce((sum, t) => sum + (t.valueUSD || 0), 0)

  ReduxService.setAccountTokenList({
    ...currentList,
    // Spread the previous entry so non-token fields (e.g. syncedChainIds) survive
    // progressive per-chain commits instead of being dropped each time.
    [address]: { ...(currentList[address] || {}), tokens: allTokens, totalUSD, lastSyncedAt: Date.now() }
  })
}

// Drop tokens of chains that are no longer active. commitChainTokens only ever
// replaces the tokens for chains it fetches and keeps the rest verbatim, so a
// chain removed from the active list would otherwise never have its tokens
// cleared (no fetch → no commit). Pruned synchronously before the fetch so the
// removed chain's tokens vanish immediately.
const pruneInactiveChainTokens = (address, activeChainIds) => {
  const activeSet = new Set(activeChainIds.map(Number))
  const currentList = ReduxService.getAccountTokenList()
  const entry = currentList[address]
  if (!entry?.tokens?.length) return
  const pruned = entry.tokens.filter((t) => activeSet.has(Number(t.chainId)))
  if (pruned.length === entry.tokens.length) return // nothing inactive to remove
  const totalUSD = pruned.reduce((sum, t) => sum + (t.valueUSD || 0), 0)
  ReduxService.setAccountTokenList({
    ...currentList,
    [address]: { ...entry, tokens: pruned, totalUSD, lastSyncedAt: Date.now() }
  })
}

// Targeted multi-token balance refresh via direct RPC — used after send/exchange
// to update only the affected tokens without going through Moralis (which can lag
// a few seconds before reflecting a just-broadcast tx). Accepts a single address
// string or an array. On Multicall3 chains all reads are batched into one call;
// on other chains they run in parallel. For tokens already in the cache only
// balance/valueUSD are patched (price/metadata kept from Redux); the list is also
// self-healing around the affected tokens:
//   - a requested token NOT yet in the list that now holds a balance is
//     discovered (metadata + price from the Keyring API) and ADDED
//   - an existing token drained to 0 (e.g. fully sent/swapped away) is REMOVED —
//     except user-added custom tokens, which stay. A failed RPC read never
//     removes a token (only a confirmed 0 balance does).
const refreshTokenBalances = async (address, chainId, contractAddresses) => {
  const normalized = (Array.isArray(contractAddresses) ? contractAddresses : [contractAddresses])
    .map((a) => isNativeToken(a, chainId) ? NATIVE : lowerCase(a))

  if (normalized.length === 0) return

  const currentList = ReduxService.getAccountTokenList()
  const entry = currentList[address]
  const existingByMetaKey = {}
  ;(entry?.tokens || []).forEach((t) => { existingByMetaKey[t.metaKey] = t })

  // Read every requested token (known + unknown). Known tokens patch in place (or
  // get removed when drained to 0); unknown tokens with a balance get discovered.
  const targets = normalized.map((addr) => ({
    addr,
    metaKey: buildMetaKey(chainId, addr),
    existing: existingByMetaKey[buildMetaKey(chainId, addr)]
  }))

  // const rpcUrl = getRpcUrlByChain(Number(chainId))
  const client = ViemWeb3.getPublicClient(chainId)

  const buildContract = (addr) =>
    addr === NATIVE
      ? { address: MULTICALL3_ADDRESS, abi: MULTICALL3_ABI, functionName: 'getEthBalance', args: [address] }
      : { address: addr, abi: erc20Abi, functionName: 'balanceOf', args: [address] }

  let rawBalances
  if (MULTICALL3_CHAIN_IDS.has(Number(chainId))) {
    // One multicall round-trip for all tokens.
    try {
      const results = await client.multicall({
        contracts: targets.map(({ addr }) => buildContract(addr)),
        allowFailure: true,
        multicallAddress: MULTICALL3_ADDRESS
      })
      rawBalances = results.map((r) => (r?.status === 'success' ? r.result : null))
    } catch {
      return
    }
  } else {
    // Parallel individual reads (small N, so no throttle needed).
    rawBalances = await Promise.all(
      targets.map(async ({ addr }) => {
        try {
          if (addr === NATIVE) return await client.getBalance({ address })
          return await client.readContract({ address: addr, abi: erc20Abi, functionName: 'balanceOf', args: [address] })
        } catch {
          return null
        }
      })
    )
  }

  const updates = {} // metaKey → balance patch for existing tokens
  const removedMetaKeys = new Set() // existing tokens drained to 0
  const unknownWithBalance = [] // { addr, rawBalance } not yet in the list

  targets.forEach(({ addr, metaKey, existing }, i) => {
    const rawBalance = rawBalances[i]
    if (rawBalance == null) return // failed read → leave the token as-is
    if (existing) {
      const decimals = addr === NATIVE ? 18 : Number(existing.decimals ?? 18)
      let balanceFormatted = 0
      try { balanceFormatted = Number(formatUnits(rawBalance, decimals)) } catch { return }
      if (balanceFormatted <= 0) {
        // Drained to zero → drop it, unless the user added it as a custom token.
        if (!existing.isCustom) removedMetaKeys.add(metaKey)
        return
      }
      updates[metaKey] = {
        balance: rawBalance.toString(),
        balanceFormatted,
        valueUSD: balanceFormatted * (existing.priceUSD || 0)
      }
    } else if (rawBalance > 0n) {
      unknownWithBalance.push({ addr, rawBalance })
    }
  })

  // Discover metadata + price for unknown tokens that now hold a balance, then
  // build full entries (mirrors the multicall discovery path). Tokens the Keyring
  // API doesn't know about can't be reliably priced/named, so they're skipped.
  const addedTokens = []
  if (unknownWithBalance.length > 0) {
    const addrs = unknownWithBalance.filter(({ addr }) => addr !== NATIVE).map(({ addr }) => addr)
    let keyringList = []
    if (addrs.length > 0) {
      try { keyringList = await fetchKeyringTokens(chainId, addrs) } catch { keyringList = [] }
    }
    unknownWithBalance.forEach(({ addr, rawBalance }) => {
      const keyring = addr === NATIVE ? null : keyringList.find((k) => lowerCase(k?.address) === addr)
      const built = transformMulticallEntry(chainId, keyring, rawBalance)
      if (built) addedTokens.push(built)
    })
  }

  if (Object.keys(updates).length === 0 && removedMetaKeys.size === 0 && addedTokens.length === 0) return

  let tokens = (entry?.tokens || [])
    .filter((t) => !removedMetaKeys.has(t.metaKey))
    .map((t) => (updates[t.metaKey] ? { ...t, ...updates[t.metaKey] } : t))
  tokens = [...tokens, ...addedTokens]
  tokens.sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0))
  const totalUSD = tokens.reduce((sum, t) => sum + (t.valueUSD || 0), 0)

  ReduxService.setAccountTokenList({
    ...currentList,
    [address]: { ...(entry || {}), tokens, totalUSD, lastSyncedAt: Date.now() }
  })
}

// Refresh the per-account token list across all active EVM chains.
// Each chain commits its own result the moment it resolves (progressive render).
// Returned promise resolves once the FAST chains are done — slow per-token-RPC
// chains keep filling in afterward in the background — so the caller's loading
// indicator can stop early instead of waiting on the slowest chain.
export const refreshAccountTokens = async (accountAddress, opts = {}) => {
  if (!accountAddress) return null
  const address = lowerCase(accountAddress)

  // Targeted token shortcut: read only the specified token(s) directly over RPC
  // instead of going through the full Moralis/multicall pipeline. Moralis can take
  // a few seconds to index a just-broadcast tx; the RPC node reflects it immediately.
  // tokenAddress accepts a single address string or an array of addresses. Besides
  // patching balances, this also self-heals the list around those tokens: a token
  // that now holds a balance but isn't listed yet is added, and one drained to 0 is
  // removed (see refreshTokenBalances).
  if (opts.tokenAddress && Array.isArray(opts.chainIds) && opts.chainIds.length === 1) {
    return refreshTokenBalances(address, Number(opts.chainIds[0]), opts.tokenAddress)
  }

  // Prune against the REAL active chain list, not the fetch subset — a filtered
  // (single-chain) refresh must not wipe other active chains' already-loaded
  // tokens. Also empties the list when no chains are active.
  const activeChainIds = (ReduxService.getActiveEvmChainIds() || []).map(Number)
  pruneInactiveChainTokens(address, activeChainIds)

  // Which chains to FETCH this run: an explicit subset (filtered refresh) or all
  // active chains by default.
  const isFullRefresh = !(Array.isArray(opts.chainIds) && opts.chainIds.length)
  const chainIds = (isFullRefresh ? activeChainIds : opts.chainIds).map(Number)

  if (!chainIds || chainIds.length === 0) return null

  // On a FULL refresh, record which active chains this snapshot now covers so
  // consumers can detect when the active chain list later changes (chain added
  // /removed on the Network screen) and lazily re-fetch. Skipped for filtered
  // (subset) refreshes since they don't cover the whole active set.
  const stampSyncedChainIds = () => {
    if (!isFullRefresh) return
    const list = ReduxService.getAccountTokenList()
    const entry = list[address]
    if (!entry) return
    ReduxService.setAccountTokenList({
      ...list,
      [address]: { ...entry, syncedChainIds: activeChainIds }
    })
  }

  const fetchAndCommit = (chainId) =>
    fetchChainTokens(chainId, address)
      .then((tokens) => commitChainTokens(address, chainId, tokens))
      .catch(() => {})

  const fastChains = chainIds.filter(isFastChain)
  const slowChains = chainIds.filter((id) => !isFastChain(id))

  // Fire the slow chains without awaiting — they commit progressively in the
  // background. If there are no fast chains, wait on the slow ones instead so
  // the loading indicator still has something to track.
  const blocking = fastChains.length > 0 ? fastChains : slowChains
  const background = fastChains.length > 0 ? slowChains : []

  // Flag this account as loading (consumed by the home account list icon). The
  // flag is cleared only once EVERY chain settles — including the slow
  // background ones — even though this function returns earlier (after the fast
  // chains) to keep the caller's own loading indicator snappy.
  ReduxService.setTokenLoading(address, true)
  const backgroundPromises = background.map(fetchAndCommit)
  const blockingPromises = blocking.map(fetchAndCommit)
  Promise.allSettled([...backgroundPromises, ...blockingPromises])
    .then(() => {
      // Stamp only after EVERY chain (incl. slow background) has settled, so the
      // coverage marker reflects a fully completed full-refresh.
      stampSyncedChainIds()
      ReduxService.setTokenLoading(address, false)
    })

  await Promise.allSettled(blockingPromises)

  return ReduxService.getAccountTokenList()[address] || null
}

// True when an account's cached tokens no longer match the current active EVM
// chain list — i.e. never synced, or a chain was added/removed since the last
// full refresh. Consumers use this to lazily re-fetch (on focus / on open)
// instead of refetching everything whenever the chain list changes. Order-
// insensitive compare since the active list isn't kept sorted.
export const isStaleForActiveChains = (entry, activeChainIds) => {
  if (!entry?.lastSyncedAt) return true
  const synced = [...(entry.syncedChainIds || [])].map(Number).sort((a, b) => a - b)
  const active = [...(activeChainIds || [])].map(Number).sort((a, b) => a - b)
  if (synced.length !== active.length) return true
  return synced.some((id, i) => id !== active[i])
}

// Single source of truth for "what the user sees as their account total" —
// the snapshot's `entry.totalUSD` is fixed at fetch time and goes stale the
// moment a token is hidden/unhidden, so any UI that displays the total should
// derive it from the live token list instead.
//
// Mirrors the TokenList visible-list filter (TokenList/page.js): excludes
// hidden tokens AND sub-MIN_VISIBLE_VALUE_USD dust (unless the user manually
// unhid it), so the Home account total matches the TokenList header total
// instead of running higher by the sum of all the dust rows.
export const getVisibleTotalUSD = (entry) => {
  if (!entry?.tokens) return 0
  return entry.tokens.reduce((sum, t) => {
    if (t.isHidden) return sum
    if (!t.isManuallyShown && (t.valueUSD || 0) < MIN_VISIBLE_VALUE_USD) return sum
    return sum + (t.valueUSD || 0)
  }, 0)
}

// Toggle per-token hide flag inside an account entry. When unhiding we also
// flag `isManuallyShown: true` so the visible-list filter bypasses
// MIN_VALUE_USD — otherwise tokens auto-hidden for lack of Keyring price
// (valueUSD = 0) would never reappear after the user explicitly shows them.
export const toggleTokenHidden = (accountAddress, metaKey, isHidden) => {
  const address = lowerCase(accountAddress)
  const list = ReduxService.getAccountTokenList()
  const entry = list[address]
  if (!entry?.tokens) return
  const tokens = entry.tokens.map((t) => (
    t.metaKey === metaKey
      ? { ...t, isHidden: !!isHidden, isManuallyShown: !isHidden }
      : t
  ))
  ReduxService.setAccountTokenList({
    ...list,
    [address]: { ...entry, tokens }
  })
}
