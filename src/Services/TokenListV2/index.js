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
import AlchemyService from 'src/Services/Alchemy'
import ReduxService from 'common/redux'
import BaseAPI from 'controller/API/BaseAPI'
import CoinGeckoAPI from 'controller/API/CoinGeckoAPI'
import { SUPPORTED_CHAINS_BY_SERVICE_MORALIS, SUPPORTED_CHAINS_BY_SERVICE_ALCHEMY, MULTICALL3_CHAIN_IDS } from 'common/constants/chain'
import { lowerCase, getChainInfo, getRpcUrlByChain } from 'common/function'
import { erc20Abi, formatUnits, isAddress, zeroAddress } from 'viem'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { isNativeToken } from 'common/tokens'
import { resolveApiYieldProtocol, resolveApiYieldAsset } from 'common/constants/lending'
// Yield-token valuation (see applyYieldTokenValues):
//   - Rebasing (aave-v3, compound-v3): balance is already the underlying →
//     balance × unit price.
//   - Share (ERC-4626 vaults, maple, L2 sUSDS): balance is shares → core converts
//     them to underlying on-chain (`valueYieldTokens`) × unit price.
// Unit price = `yieldAsset.fixedPrice` when the API sends one, otherwise the
// UNDERLYING asset's own price from the token API (never the vault's `price`).
//
// Identity (`yieldProtocol` / `yieldAsset`) stays OUR job: it is resolved from
// sources only this service can see (the live API row, the field persisted on
// the token, a by-address re-ask, the Redux snapshot), so the tokens handed to
// core arrive already described.
import { valueYieldTokens, resolveTokenPriceUSD, isShareBasedProtocol } from 'keyring-agent-core'
import { resolveOnchainSymbols } from './symbolOnchain'
import pLimit from 'p-limit'

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

// Chains whose native coin is ALSO exposed through an ERC-20 contract that reads
// the very same balance. Indexers return both rows, so without dropping the
// contract row the balance shows twice: once as native, once as a token the
// Keyring list does not carry (auto-hidden). Kept apart from
// NATIVE_TOKEN_BY_CHAIN_ID on purpose: that map also rewrites the native address
// sent to swap providers, and Arc's ERC-20 interface uses 6 decimals while native
// USDC uses 18.
const NATIVE_BALANCE_MIRROR_BY_CHAIN_ID = {
  5042: '0x3600000000000000000000000000000000000000' // Arc — USDC
}

// Per-token RPC reads (sequential fallback) run in bounded-concurrency batches —
// fast enough without blasting the RPC as one giant burst.
const SEQUENTIAL_RPC_CONCURRENCY = 8

// ONE account sweeps at a time.
//
// This is the fix for the home screen locking up when a user opens many funded
// accounts in a row. Measured on device, by flipping this one constant with
// everything else held fixed: 20 reproduces the original jank, 1 is smooth.
//
// What costs is not the request count and not the loading animations — both were
// ruled out separately. It is the CHAIN COMMIT churn: every chain that lands
// parses a large response, rebuilds and re-sorts that account's whole token list,
// dispatches, persists and re-renders the row. Twenty accounts sweeping at once
// crams ~200 of those into the same stretch of JS thread the user is tapping on.
// Serializing does not reduce the total work, it spreads it out so the thread
// always has room for the next tap.
//
// Bounding CHAIN fetches instead was measurably worse: with a cap that isn't a
// multiple of one account's chain count, accounts interleave (account 1 takes
// six slots, account 2 picks up the four left over, …) so several accounts sit
// mid-sweep at once — the exact state to avoid. Serializing per account also
// stays correct no matter how many chains the user activated, which a
// chain-count-derived number does not.
//
// A single account is never throttled: all of its chains still run in parallel,
// so the common case (one or two accounts) is exactly as fast as it was before
// any limiter existed.
// Exported so the test asserts against the value actually in force instead of a
// number copied into the test file, which would go stale the moment this is tuned.
export const ACCOUNT_SWEEP_CONCURRENCY = 2
const accountSweepLimit = pLimit(ACCOUNT_SWEEP_CONCURRENCY)

// Slow chains (per-token RPC, no indexer) keep their own small pool: they stream
// in behind the fast ones, and must not hold an account's sweep slot hostage
// while a later row waits to load.
const BACKGROUND_CHAIN_FETCH_CONCURRENCY = 2
const backgroundChainLimit = pLimit(BACKGROUND_CHAIN_FETCH_CONCURRENCY)

// Full refreshes currently queued or in flight, keyed by address. The home row's
// effect re-runs on every progressive commit; the redux loading flag catches the
// common case but it is UI state, and a queued refresh must not be scheduled
// twice. Callers that arrive while one is running join it instead of starting a
// second sweep, so they still resolve when the fast chains are done.
const pendingFullRefresh = new Map()

// How long an account with failed chains waits before it counts as stale again.
// A provider outage would otherwise be retried on every focus / every commit;
// this keeps the retry honest without turning it into a hot loop.
const FAILED_RETRY_COOLDOWN_MS = 60 * 1000

// Traces the yield-token conversion: which tokens qualified (and why the others
// didn't), what the chain answered, and how each value changed. Dev-only —
// transform-remove-console strips console calls from release builds regardless,
// but gating on __DEV__ also skips building the strings. Set to false to silence
// it while debugging something else on this path.
// Currently OFF — silenced while tracing the symbol path (see symbolOnchain.js).
// Flip back to `__DEV__` to get the yield trace again.
const DEBUG_YIELD = false
const logYield = (...args) => { if (DEBUG_YIELD) console.log('[yield]', ...args) }

// Unified Keyring token API for every EVM chain — served from the default API
// base URL (relative path, via BaseAPI), same as the single-token lookups.
const KEYRING_TOKENS_ALL_API = 'keyrings/tokens/all'

// How many contract addresses go into one `addresses=` lookup. Purely a URL-size
// budget: `query-string` percent-encodes the separators, so each address costs
// 45 chars (42 + `%2C`), not 43.
//
// Measured against the live API — the request line dies at ~8 KB, the classic
// nginx/CDN ceiling:
//   170 addresses (7.7 KB) → 200 OK
//   175–180      (8.0 KB) → 502   ← upstream dies before the proxy even objects
//   182+         (8.3 KB) → 414 URI Too Long
// 100 keeps the URL at ~4.6 KB, a bit over half the budget, so the request
// survives a proxy with a tighter limit or an extra query param added later.
// The chunks are fetched in parallel, so a smaller batch costs latency, not time.
const MAX_ADDRESSES_FOR_QUERY = 100

// The custom-chain API caps each response at a small default page size and now
// returns a paginated envelope: { items, currentPage, totalPage, nextPage, ... }
// with nextPage === null on the last page. We page through with limit=200 and
// follow the nextPage cursor so the whole token list is fetched, not just the
// first page. The page cap is a safety net against a misbehaving cursor.
const CUSTOM_API_PAGE_LIMIT = 200
const CUSTOM_API_MAX_PAGES = 200

// Ceiling on the discovery list the RPC tiers will read. They ask for a balance
// per LISTED token, so their cost scales with the Keyring list rather than with
// what the wallet holds — and that list keeps growing (Ethereum is already ~8.4k
// tokens ≈ 42 sequential pages ≈ 31 MB of metadata). Past this many entries the
// chain reads its native balance only, which is far better than a multi-minute
// download or a burst of hundreds of parallel eth_calls. Every chain that
// actually depends on the RPC tiers today lists under 200 tokens, so nothing in
// current use is affected; the cap is insurance against future growth.
const DISCOVERY_LIST_MAX_TOKENS = 1500

// Returns { items, ok }. `ok: false` means the list is INCOMPLETE — the API
// answered with an error status (BaseAPI resolves null on any non-2xx instead of
// throwing) or with a malformed envelope, so we never got the whole list. That is
// NOT the same as a chain legitimately having no tokens: callers must not conclude
// "this token has no price" from a response we never received.
const fetchAllCustomApiTokens = async (chainId, query = null, maxItems = Infinity, maxPages = CUSTOM_API_MAX_PAGES) => {
  const all = []
  let page = 1
  for (let i = 0; i < Math.min(maxPages, CUSTOM_API_MAX_PAGES); i++) {
    const res = await BaseAPI.getData(
      `${KEYRING_TOKENS_ALL_API}/${chainId}`,
      { ...(query || {}), limit: CUSTOM_API_PAGE_LIMIT, page }
    )
    const items = res?.items
    // HTTP error (429/500/…) or a broken envelope → stop and report the loss.
    if (!Array.isArray(items)) return { items: all, ok: false }
    // The envelope carries the full count, so a list too large to read over RPC
    // can be refused after ONE page instead of being paged through. Callers that
    // need the list for balance discovery pass a cap; the price/metadata lookups
    // (which query specific addresses) leave it at Infinity.
    // `all.length` is the belt to `total`'s braces: an older/misbehaving API that
    // omits `total` would otherwise leave the cap silently disabled and page
    // through the whole list anyway.
    const total = toNumber(res?.total)
    if (total > maxItems || all.length > maxItems) return { items: [], ok: true, tooLarge: true }
    if (items.length === 0) break
    all.push(...items)

    // `nextPage` alone CANNOT be trusted to end the loop. With an `addresses=`
    // filter the API ignores `page` entirely: it returns the same rows for every
    // page and still advertises `nextPage = page + 1`, forever. Following that
    // burns CUSTOM_API_MAX_PAGES requests per chain on every single balance
    // refresh — hundreds to thousands of calls across the active chain list.
    // So stop on the first independent end-of-list signal instead.
    if (total > 0 && all.length >= total) break // already have everything the API says exists
    if (items.length < CUSTOM_API_PAGE_LIMIT) break // a short page is the last page
    const next = toNumber(res?.nextPage)
    if (!next || next <= page) break // cursor not advancing → not a real next page
    page = next
  }
  return { items: all, ok: true }
}

const buildMetaKey = (chainId, contractAddress) => `${chainId}:${contractAddress}`

// ---------------------------------------------------------------------------
// Provider-neutral balance row
// ---------------------------------------------------------------------------
// Every balance source normalizes into this shape, and exactly one function
// (buildTokenEntry) turns it into a token entry. Provider quirks — hex vs
// decimal balances, where the price lives, which fields native rows omit — stay
// at the edge instead of leaking into the pricing/hiding rules.
//
// Shape: { contractAddress, isNative, symbol, name, iconUrl, decimals,
//          balance, balanceFormatted, priceUSD, isVerified, isPossibleSpam }
//
// Chosen over "make everything look like a Moralis row" on purpose: this is the
// shape a Keyring proxy would serve, so swapping or adding a provider is one new
// normalize* function, and no consumer ends up depending on a vendor's field
// names.

const normalizeMoralisRow = (row) => {
  const isNative = !!row?.native_token
  const addr = row?.token_address
  return {
    contractAddress: isNative || !addr ? NATIVE : lowerCase(addr),
    isNative,
    symbol: row?.symbol || '',
    name: row?.name || '',
    iconUrl: row?.logo || row?.thumbnail || '',
    decimals: row?.decimals,
    balance: row?.balance || '0',
    balanceFormatted: toNumber(row?.balance_formatted),
    priceUSD: toNumber(row?.usd_price),
    isVerified: !!row?.verified_contract,
    isPossibleSpam: !!row?.possible_spam
  }
}

// Alchemy Portfolio row → neutral row. Three differences from Moralis that have
// to be absorbed here:
//   - `tokenBalance` is a HEX string, not a decimal one, and there is no
//     pre-divided `balance_formatted`;
//   - native rows arrive with an ALL-NULL metadata block — no symbol, no name,
//     no decimals. Decimals is assumed (EVM native balances are always wei) and
//     the symbol is filled in from chain metadata, because the Keyring list is
//     matched for native tokens BY SYMBOL: leaving it empty finds no match, and
//     a token with no Keyring match is auto-hidden. That would bury the user's
//     ETH in the Hidden list on exactly the fallback meant to rescue it;
//   - there is no spam flag at all. Left false: TokenListV2 already gates the
//     visible list on presence in the Keyring list, which is the real filter.
const normalizeAlchemyToken = (token, chainId) => {
  const isNative = !token?.tokenAddress
  const meta = token?.tokenMetadata || {}
  // A non-numeric `decimals` would silently shift the balance by orders of
  // magnitude in formatUnits, so anything unusable falls back to 18 rather than
  // being passed through.
  const metaDecimals = Number(meta?.decimals)
  const decimals = isNative || !Number.isInteger(metaDecimals) || metaDecimals < 0
    ? 18
    : metaDecimals
  const nativeInfo = isNative ? (getChainInfo(chainId)?.nativeCurrency || {}) : {}

  let balance = '0'
  let balanceFormatted = 0
  try {
    const raw = BigInt(token?.tokenBalance ?? 0)
    balance = raw.toString()
    balanceFormatted = Number(formatUnits(raw, decimals))
  } catch {
    return null
  }
  if (!Number.isFinite(balanceFormatted)) return null

  return {
    contractAddress: isNative ? NATIVE : lowerCase(token.tokenAddress),
    isNative,
    symbol: meta?.symbol || nativeInfo?.symbol || '',
    name: meta?.name || nativeInfo?.name || nativeInfo?.symbol || '',
    iconUrl: meta?.logo || nativeInfo?.icon || '',
    decimals,
    balance,
    balanceFormatted,
    priceUSD: toNumber((token?.tokenPrices || []).find((p) => p?.currency === 'usd')?.value),
    isVerified: false,
    isPossibleSpam: false
  }
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
// Returns { items, ok } — see fetchAllCustomApiTokens for what `ok: false` means.
const fetchKeyringTokensWithStatus = async (chainId, contractAddresses) => {
  if (contractAddresses.length === 0) {
    // No ERC20 to price on this chain — the only entry still needed is the
    // NATIVE one, and the API puts it on the first page. Paging the whole
    // `isTop` list (3.6k tokens ≈ 19 requests per chain) to find one row is pure
    // waste, so stop after that page.
    return fetchAllCustomApiTokens(chainId, { isTop: true }, Infinity, 1)
  }
  // More addresses than fit in one URL → split them and merge the answers.
  //
  // The old behaviour was to drop the filter entirely and download the chain's
  // WHOLE token list. On Base that is 13 requests / 11.6 MB / 10.5s for a wallet
  // holding 300 tokens (measured) — and airdrop spam pushes wallets past this
  // threshold routinely. Chunking asks only about the tokens actually held:
  // 2 requests / 1.3 MB / 0.6s for the same wallet.
  const chunks = []
  for (let i = 0; i < contractAddresses.length; i += MAX_ADDRESSES_FOR_QUERY) {
    chunks.push(contractAddresses.slice(i, i + MAX_ADDRESSES_FOR_QUERY))
  }

  const results = await Promise.all(
    chunks.map((chunk) => fetchAllCustomApiTokens(chainId, { addresses: chunk.join(',') }))
  )

  // Every chunk's response also carries the chain's NATIVE entry, so merging
  // them raw would repeat it once per chunk. Deduped by address — `findKeyringMatch`
  // would pick the first match anyway, but a list with silent duplicates is a
  // trap for the next reader.
  const seen = new Set()
  const items = []
  results.forEach((r) => {
    (r.items || []).forEach((k) => {
      const key = lowerCase(k?.address || '')
      if (seen.has(key)) return
      seen.add(key)
      items.push(k)
    })
  })

  // One failed chunk means the price list is INCOMPLETE — same contract as a
  // single failed page, so callers keep treating it as "degraded", not "these
  // tokens are worthless".
  return { items, ok: results.every((r) => r.ok) }
}

// Plain-array flavour for callers that only need the list (search / lookup UI).
export const fetchKeyringTokens = async (chainId, contractAddresses) => {
  const { items } = await fetchKeyringTokensWithStatus(chainId, contractAddresses)
  return items
}

// Find the matching Keyring token for a neutral balance row.
// Native → match by symbol with no address; ERC20 → match by contract address.
const findKeyringMatch = (keyringList, nrow) => {
  if (nrow?.isNative) {
    const symbol = lowerCase(nrow?.symbol)
    return (keyringList || []).find((k) => {
      if (k?.address) return false
      return lowerCase(k?.symbol) === symbol || lowerCase(k?.auditGoplus?.token_symbol) === symbol
    })
  }
  return (keyringList || []).find((k) => lowerCase(k?.address) === nrow?.contractAddress)
}

// Build a minimal viem chain config from blockchainListRedux + the resolved
// RPC URL. We don't need anything beyond id/name/nativeCurrency/rpcUrls for
// multicall reads.
export const buildViemChain = (chainId, rpcUrl) => {
  const info = getChainInfo(chainId) || {}
  const symbol = info?.nativeCurrency?.symbol || 'ETH'
  // Ordered RPC list (paid Quicknode RPC first for stability). When a caller
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
// multicall) → token entry. Returns null for zero/invalid balances, EXCEPT for a
// token the user added by hand (`keepAtZeroBalance`). Tokens without a Keyring
// price land in the hidden list (isHidden: true).
const transformMulticallEntry = (chainId, keyring, rawBalance, pricingDegraded = false, keepAtZeroBalance = false) => {
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
  if (!Number.isFinite(balanceFormatted)) return null
  // A zero balance normally means "not held" and the token is dropped. A token
  // the user added manually stays regardless — commitChainTokens would re-attach
  // it from the snapshot anyway, but only VERBATIM, so dropping it here is what
  // kept a zero-balance vault out of applyYieldTokenValues and froze its price at
  // the API's UNDERLYING quote while the detail screen showed the per-share one.
  if (balanceFormatted <= 0 && !keepAtZeroBalance) return null

  const contractAddress = isNative ? NATIVE : lowerCase(keyring.address)
  const priceUSD = toNumber(keyring?.price)
  // Auto-hide verdict for THIS fetch. Kept separate from `isHidden` so
  // commitChainTokens can re-derive it every refresh (see the merge there).
  const autoHidden = priceUSD <= 0
  const valueUSD = balanceFormatted * priceUSD

  return {
    chainId,
    contractAddress,
    metaKey: buildMetaKey(chainId, contractAddress),
    // Goplus first, the listing symbol as the final fallback. Overwritten by the
    // contract's own ticker in resolveOnchainSymbols, before the commit.
    symbol: normalizeSymbol(keyring?.auditGoplus?.token_symbol || keyring?.symbol || ''),
    // The API's on-chain ticker, kept raw (no normalizeSymbol) — the contract's
    // casing is the truth, not something to correct. Input for the resolver
    // only: it is applied to `symbol` and then dropped before Redux.
    symbolOnchain: keyring?.symbolOnchain,
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
    autoHidden,
    isHidden: autoHidden,
    // Persisted so snapshot-backed discovery can re-identify a yield vault when
    // the API list comes back short (see snapshotTokenAsKeyringEntry). Written
    // RAW, not `|| null`: the chain-wide discovery list feeding this transform
    // is NOT authoritative on yield identity — it omits the tag for real vaults
    // — so an absent field must stay `undefined` ("never answered", which the
    // identity backfill in applyYieldTokenValues re-asks by address) instead of
    // being recorded as the settled answer `null` ("not a vault"). Stamping null
    // here is what permanently locked vaults added before yield support shipped
    // out of the conversion: the first full refresh overwrote their unasked
    // state with a wrong verdict no later pass would revisit.
    // Read through the two-field resolver, not `keyring.yieldProtocol` directly:
    // a protocol the API serves only in `yieldProtocolV2` (Maple today) would
    // otherwise be stored untagged and valued as if its shares were the
    // underlying. See `resolveApiYieldProtocol`.
    yieldProtocol: resolveApiYieldProtocol(keyring),
    yieldAsset: resolveApiYieldAsset(keyring),
    // Built from the previous snapshot rather than a live Keyring entry (the API
    // list came back without this token) — the commit keeps the metadata it
    // already has and refreshes only the live numbers.
    pricingDegraded,
    isManuallyShown: false
  }
}

// Transform one neutral balance row + its Keyring match → token entry. Price
// priority is Keyring first; if Keyring has the token info but its price field
// is missing/zero, fall back to the provider's own price. A token with balance
// but no Keyring entry (or no price from either source) still lands in the
// hidden list (isHidden: true). Returns null only when there's no balance to
// show — EXCEPT under `keepAtZeroBalance` (manually added tokens), the same
// rule transformMulticallEntry applies: the user asked for the token, and
// dropping it here is what froze its price at the add-time value.
const buildTokenEntry = (chainId, nrow, keyring, pricingDegraded = false, keepAtZeroBalance = false) => {
  if (!nrow) return null
  const contractAddress = nrow.contractAddress
  const balanceFormatted = nrow.balanceFormatted
  if (!(balanceFormatted > 0) && !keepAtZeroBalance) return null

  const keyringPrice = toNumber(keyring?.price)
  const providerPrice = toNumber(nrow.priceUSD)
  const priceUSD = keyringPrice > 0 ? keyringPrice : providerPrice
  // Auto-hide verdict for THIS fetch (re-derived every refresh in
  // commitChainTokens). A token missing from the Keyring list stays hidden even
  // when Moralis prices it — that's the spam-airdrop guard, not a bug.
  const autoHidden = !keyring || priceUSD <= 0
  const valueUSD = balanceFormatted * priceUSD

  return {
    chainId,
    contractAddress,
    metaKey: buildMetaKey(chainId, contractAddress),
    // Same order as transformMulticallEntry, with the raw balance row as one more
    // fallback behind the listing symbol.
    symbol: normalizeSymbol(keyring?.auditGoplus?.token_symbol || keyring?.symbol || nrow.symbol || ''),
    // See transformMulticallEntry — kept raw, promoted in commitChainTokens.
    symbolOnchain: keyring?.symbolOnchain,
    name: keyring?.name || nrow.name || keyring?.symbol || nrow.symbol || '',
    iconUrl: keyring?.icon_image || nrow.iconUrl || '',
    // Native balances are wei on every EVM chain, so the Keyring entry's
    // `decimals` is ignored for them — the token API can list a native
    // stablecoin with 6 decimals, which would misreport the amount by ~1e12.
    // Same rule transformMulticallEntry already applies.
    decimals: nrow.isNative ? 18 : (keyring?.decimals ?? nrow.decimals ?? 18),
    isNative: nrow.isNative,
    isVerified: nrow.isVerified,
    isPossibleSpam: nrow.isPossibleSpam,
    balance: nrow.balance || '0',
    balanceFormatted,
    priceUSD,
    valueUSD,
    priceChange24hPct: toNumber(keyring?.price_change_percentage_24h),
    coinGeckoId: keyring?.coinGeckoId || keyring?.idCoinGecko || null,
    marketCapRank: keyring?.market_cap_rank || null,
    categories: keyring?.categories || null,
    socials: buildSocials(keyring),
    isCustom: false,
    autoHidden,
    isHidden: autoHidden,
    // Persisted for parity with the multicall path — keeps a token's yield
    // identity on the entry rather than only in the transient API response.
    // The lookup behind this entry queries BY ADDRESS, the authoritative source
    // for yield identity, so a found entry records its answer (absent tag =
    // null, "not a vault") and a healthy batch that didn't return the token at
    // all records the same. Only a DEGRADED batch records nothing (`undefined`)
    // — it never really answered, and the identity backfill asks again later.
    yieldProtocol: keyring ? (resolveApiYieldProtocol(keyring) || null) : (pricingDegraded ? undefined : null),
    yieldAsset: keyring ? (resolveApiYieldAsset(keyring) || null) : (pricingDegraded ? undefined : null),
    // The Keyring list came back incomplete for this batch, so metadata/price
    // here is provider-only. commitChainTokens keeps what it already knows rather
    // than letting this thinner row overwrite it.
    pricingDegraded,
    isManuallyShown: false
  }
}

// Shared tail for every indexer source (Moralis, Alchemy, a future proxy): price
// a set of neutral rows against the Keyring list and build token entries.
const buildTokensFromRows = async (chainId, address, sourceRows) => {
  const snapshotByAddress = snapshotTokensByAddress(chainId, address)

  // Drop the ERC-20 mirror of the native balance (see
  // NATIVE_BALANCE_MIRROR_BY_CHAIN_ID) — unless the user added it by hand, which
  // is their call and always stays.
  const mirror = NATIVE_BALANCE_MIRROR_BY_CHAIN_ID[chainId]
  const neutralRows = mirror && !snapshotByAddress[mirror]?.isCustom
    ? sourceRows.filter((r) => r.isNative || r.contractAddress !== mirror)
    : sourceRows

  // The NATIVE sentinel is not an address — a malformed row (no address, not
  // flagged native) must not smuggle it into the lookup query.
  const contractAddresses = neutralRows
    .filter((r) => !r.isNative && r.contractAddress && r.contractAddress !== NATIVE)
    .map((r) => r.contractAddress)

  // Manually added tokens the indexer did NOT return — almost always because
  // their balance is zero, which indexers omit. These used to be re-attached
  // VERBATIM by commitChainTokens, freezing price, metadata AND yield identity
  // at whatever add time recorded (a token added before the API listed or
  // tagged it never picked the later answer up). Including their addresses in
  // the same lookup keeps them tracking the API like every held token.
  const rowAddressSet = new Set(contractAddresses)
  const missingCustom = Object.values(snapshotByAddress).filter((t) =>
    t?.isCustom &&
    t.contractAddress !== NATIVE &&
    !rowAddressSet.has(t.contractAddress) &&
    isAddress(t.contractAddress)
  )

  // An incomplete price list must NOT be read as "these tokens are worthless".
  // The provider still gives us balances and a usable price, so keep refreshing
  // the numbers and flag the batch as degraded — commitChainTokens then leaves
  // already-known tokens where they are instead of burying them in the hidden
  // list (see the merge there).
  const { items: keyringList, ok } = await fetchKeyringTokensWithStatus(
    chainId,
    [...contractAddresses, ...missingCustom.map((t) => t.contractAddress)]
  )

  // Deduped by metaKey: both indexers paginate, and a cursor that returns an
  // overlapping page would otherwise put the same token in the list twice —
  // which shows a duplicate row AND double-counts it in the account total.
  const tokens = []
  const seen = new Set()
  const keyringByMetaKey = {}
  neutralRows.forEach((nrow) => {
    const keyring = findKeyringMatch(keyringList, nrow)
    // A custom token the indexer reports AT zero balance (Alchemy does return
    // zero rows) must survive the build too — same keep rule as the RPC paths.
    const keep = !nrow.isNative && !!snapshotByAddress[nrow.contractAddress]?.isCustom
    const entry = buildTokenEntry(chainId, nrow, keyring, !ok, keep)
    if (!entry || seen.has(entry.metaKey)) return
    seen.add(entry.metaKey)
    tokens.push(entry)
    keyringByMetaKey[entry.metaKey] = keyring
  })

  // Refreshed entries for the missing customs the lookup answered for. Balance
  // stays what the snapshot last recorded (the indexer said nothing about it;
  // almost always 0) while price/metadata/yield identity come fresh. A token
  // the lookup did NOT return is left out on purpose: commitChainTokens
  // re-attaches the stored copy verbatim, and the address is simply asked again
  // next refresh — so it starts updating the moment the API lists it.
  missingCustom.forEach((prev) => {
    const keyring = keyringList.find((k) => lowerCase(k?.address) === prev.contractAddress)
    if (!keyring) return
    let rawBalance = 0n
    try { rawBalance = BigInt(prev.balance || '0') } catch { rawBalance = 0n }
    // This lookup queried BY ADDRESS — authoritative on yield identity — so on
    // a healthy batch an absent tag is a real answer ("not a vault") and is
    // recorded as null, exactly as buildTokenEntry does. A degraded batch
    // records nothing (`undefined`) and the identity is re-asked later.
    const answered = ok
      ? { ...keyring, yieldProtocol: resolveApiYieldProtocol(keyring) || null, yieldAsset: resolveApiYieldAsset(keyring) || null }
      : keyring
    const entry = transformMulticallEntry(chainId, answered, rawBalance, !ok, true)
    if (!entry || seen.has(entry.metaKey)) return
    seen.add(entry.metaKey)
    tokens.push(entry)
    keyringByMetaKey[entry.metaKey] = answered
  })

  // Share-based yield tokens hold a balance in SHARES, so their listed price is
  // per underlying unit — the value has to be converted on-chain. Applied here,
  // in the shared tail, so every indexer gets it: doing it per-source is how the
  // Alchemy path would silently have shipped without it.
  return applyYieldTokenValues(chainId, tokens, keyringByMetaKey, byMetaKey(snapshotByAddress))
}

// An empty 200 from an indexer is already anomalous: a wallet drained of
// everything still comes back with a zero-balance native row. Treat it as
// suspect when there is something to lose, so a provider that answers "nothing"
// by mistake can't wipe a chain. Belt-and-braces — real errors now throw rather
// than arriving disguised as [].
const assertEmptyIsPlausible = (chainId, address, source) => {
  if (Object.keys(snapshotTokensByAddress(chainId, address)).length > 0) {
    throw new Error(`${source} returned no balances for chain ${chainId}`)
  }
}

// Yield identity resolved as a PAIR from ordered sources. The first source that
// has an ANSWER for `yieldProtocol` (anything but `undefined` — `null` is the
// recorded answer "not a vault" and must stop the search, which is why a
// `||`/`??` chain can't express this) supplies BOTH fields, so a protocol from
// one source is never scaled by another source's `yieldAsset.decimals`. One
// exception: a source that answered the protocol but omitted the asset object
// may borrow the asset from a source that AGREES on the protocol — without it
// the conversion would just fail closed on the missing decimals.
//
// Each source is read through `resolveApiYieldProtocol` rather than by field:
// the first source is the RAW API entry, which may carry the tag in either
// field, while the rest are stored tokens that only ever hold the resolved one.
// Reading the raw field here is what let a `yieldProtocolV2`-only vault fall
// through to a stale/absent tag and skip its share conversion.
const resolveYieldIdentity = (sources) => {
  const answered = sources.find((s) => s && resolveApiYieldProtocol(s) !== undefined)
  if (!answered) return { yieldProtocol: undefined, yieldAsset: undefined }
  const yieldProtocol = resolveApiYieldProtocol(answered)
  let yieldAsset = resolveApiYieldAsset(answered)
  if (yieldProtocol && !yieldAsset) {
    const donor = sources.find((s) => s && resolveApiYieldProtocol(s) === yieldProtocol && resolveApiYieldAsset(s))
    if (donor) yieldAsset = resolveApiYieldAsset(donor)
  }
  return { yieldProtocol, yieldAsset }
}

// USD price of each underlying (`yieldAsset.address`) from the token API, keyed
// by lowercased address — ONE batched lookup per chain. A fixed-price asset
// needs no lookup. Best-effort: a failed lookup yields {} and unitPriceOf falls
// back to the vault's own quote.
const fetchAssetPrices = async (chainId, yieldAssets) => {
  const addresses = [...new Set(
    yieldAssets
      .filter((a) => a?.address && !(toNumber(a.fixedPrice) > 0))
      .map((a) => lowerCase(a.address))
  )].filter((a) => isAddress(a))
  if (addresses.length === 0) return {}
  try {
    const prices = {}
    const rows = await fetchKeyringTokens(chainId, addresses)
    rows.forEach((k) => {
      const price = toNumber(k?.price)
      if (k?.address && price > 0) prices[lowerCase(k.address)] = price
    })
    return prices
  } catch {
    return {}
  }
}

// Price of ONE unit of a yield token's underlying: `fixedPrice` when the API
// sends one, else the underlying's own price, else `fallback` — the vault's own
// API quote, which is what tokens without an asset config were always valued at.
// `source` says which one was used, for the yield log.
const unitPriceOf = (yieldAsset, assetPrices, fallback) => {
  const fixed = toNumber(yieldAsset?.fixedPrice)
  if (fixed > 0) return { price: fixed, source: 'assetFixedPrice' }
  const asset = lowerCase(yieldAsset?.address || '')
  const assetPrice = assetPrices[asset]
  if (assetPrice > 0) return { price: assetPrice, source: `asset ${asset} API price` }
  const reason = asset ? `asset ${asset} has no API price` : 'no asset config'
  return { price: toNumber(fallback), source: `vault's own quote (fallback: ${reason})` }
}

// `symbol (protocol, TYPE) on chain N` — the prefix of every per-token yield log.
// Symbol alone is ambiguous (a Morpho vault often reports its underlying's
// symbol, e.g. "USDC"), so the name, contract and underlying are logged too.
const yieldLabel = (chainId, { symbol, name, address }, yieldProtocol, yieldAsset) =>
  `chain ${chainId} | ${symbol || '?'}${name && name !== symbol ? ` "${name}"` : ''} ${address || '?'}` +
  ` (${yieldProtocol}, ${isShareBasedProtocol(yieldProtocol) ? 'SHARE' : 'REBASING'}` +
  `, underlying ${yieldAsset?.address || '?'})`

// Value the yield-bearing tokens of ONE chain (rules at the top of this file).
// Writes back:
//   priceUSD → value per token HELD (per share for a vault), so a later
//              balance-only refresh can recompute `balance × price` correctly
//   valueUSD → the position in USD
// `keyringByMetaKey` supplies each token's yieldProtocol/yieldAsset from the
// live API response, falling back to the fields persisted on the token itself
// (snapshot-recovered vaults have no live entry). Untagged tokens pass through
// untouched; a failed share conversion keeps the value the token already had,
// so a flaky RPC under-reports a position at worst instead of zeroing it.
// Returns a NEW array.
const applyYieldTokenValues = async (chainId, tokens, keyringByMetaKey, snapshotByMetaKey = null) => {
  // Last-resort yield identity: what this very token was recorded as last time.
  // Every path here rebuilds its token entries from the live API response, so a
  // vault the API describes without `yieldProtocol` in THIS query arrives
  // untagged even though the app already knows better — the symptom being a
  // refresh that logs "N tokens, 0 tagged" and skips the conversion outright.
  // Consulted only after both live sources come up empty, so a fresh answer
  // (including the API dropping a token's vault status) always wins.
  const snapshot = snapshotByMetaKey || {}

  // Ask BY ADDRESS for the identity of tokens no LIVE source answered for.
  // This is what upgrades a vault added before yield support shipped (stored
  // with no tag fields at all) the first time ANY refresh sees it — previously
  // only the targeted post-send path re-asked, so a token the user never sent
  // stayed unconverted forever. It also tags tokens discovered through a
  // chain-wide list that omits the field. Answers are recorded on the returned
  // tokens (absent tag = null, "not a vault") so the commit persists them and
  // the steady state costs no extra call; a failed or empty lookup records
  // nothing and is simply re-asked next pass.
  const tagPatch = {}
  // Explicit `=== undefined` on the live sources: a recorded `null` means the
  // question was answered ("not a vault") and normally suppresses the re-ask —
  // a `??`/`||` chain would skip over it and ask again on every refresh.
  // CUSTOM tokens are the exception: their stored answer was written at add
  // time and the API is allowed to change it (a vault added before the API
  // listed/tagged it is the reported case), while on chains whose discovery
  // list omits yield tags nothing else would ever ask again. They ride the
  // same single batched call, so re-asking costs no extra request.
  const unknownIdentity = tokens.filter((t) => {
    if (t.contractAddress === NATIVE) return false
    // Same resolver the entry builders use, so a token the API tagged only in
    // `yieldProtocolV2` counts as ANSWERED and isn't re-asked every refresh.
    if (resolveApiYieldProtocol(keyringByMetaKey[t.metaKey]) !== undefined) return false
    if (t.yieldProtocol !== undefined) return false
    const snap = snapshot[t.metaKey]
    if (snap?.yieldProtocol === undefined) return true // never answered anywhere
    return !!snap.isCustom // stored answer exists, but may have gone stale
  })
  if (unknownIdentity.length > 0) {
    try {
      const fresh = await fetchKeyringTokens(chainId, unknownIdentity.map((t) => t.contractAddress))
      fresh.forEach((k) => {
        if (!k?.address) return
        tagPatch[buildMetaKey(chainId, lowerCase(k.address))] = {
          yieldProtocol: resolveApiYieldProtocol(k) || null,
          yieldAsset: resolveApiYieldAsset(k) || null
        }
      })
      logYield(`chain ${chainId} | identity re-asked for ${unknownIdentity.length} untagged token(s), API answered ${Object.keys(tagPatch).length}`)
    } catch {
      // Best-effort — unanswered tokens stay `undefined` and are re-asked.
    }
  }

  // Identity precedence: the live API entry, then the token's own recorded
  // answer, then the fresh by-address answer, then the snapshot — a
  // snapshot-recovered vault has no live entry yet is still a vault.
  // resolveYieldIdentity stops at the first source that ANSWERED (`null`
  // included), so a fresh "not a vault" beats a stale tag.
  const inputs = []
  tokens.forEach((t) => {
    const { yieldProtocol, yieldAsset } = resolveYieldIdentity([keyringByMetaKey[t.metaKey], t, tagPatch[t.metaKey], snapshot[t.metaKey]])
    if (!yieldProtocol) return
    let rawBalance = 0n
    try { rawBalance = BigInt(t.balance) } catch { rawBalance = 0n }
    inputs.push({
      key: t.metaKey,
      address: t.contractAddress,
      rawBalance,
      decimals: Number(t.decimals ?? 18),
      priceUSD: t.priceUSD, // replaced by the unit price below
      yieldProtocol,
      yieldAsset,
      // Needed only by cross-chain sUSDS, valued against its chain's oracle.
      chain: chainId
    })
  })

  // Recorded identity answers must ride along even when there is nothing to
  // value, or the same tokens would be re-asked on every refresh.
  const withTagPatch = (t) => (tagPatch[t.metaKey] ? { ...t, ...tagPatch[t.metaKey] } : t)
  if (inputs.length === 0) {
    return Object.keys(tagPatch).length === 0 ? tokens : tokens.map(withTagPatch)
  }

  const assetPrices = await fetchAssetPrices(chainId, inputs.map((i) => i.yieldAsset))
  const inputByKey = {}
  inputs.forEach((i) => {
    const unit = unitPriceOf(i.yieldAsset, assetPrices, i.priceUSD)
    i.vaultQuoteUSD = i.priceUSD
    i.priceUSD = unit.price
    i.priceSource = unit.source
    inputByKey[i.key] = i
  })
  const shareCount = inputs.filter((i) => isShareBasedProtocol(i.yieldProtocol)).length
  logYield(
    `chain ${chainId} | ${inputs.length} yield token(s): ${inputs.length - shareCount} rebasing, ${shareCount} share` +
    ` | asset prices from API: ${Object.keys(assetPrices).length}`
  )

  const rpcUrl = getRpcUrlByChain(Number(chainId))
  const shares = inputs.filter((i) => isShareBasedProtocol(i.yieldProtocol) && i.priceUSD > 0)
  const held = shares.filter((i) => i.rawBalance > 0n)
  // A share vault held at zero (only manually added tokens get here) has no
  // amount to convert, but still needs a per-SHARE unit price — priced off one
  // synthetic share. Failures resolve to null and leave the stored price alone.
  const zeroHeld = shares.filter((i) => i.rawBalance <= 0n)

  const [values, perShare] = await Promise.all([
    held.length > 0 ? valueYieldTokens(chainId, held, { rpcUrl }) : new Map(),
    Promise.all(zeroHeld.map((i) =>
      resolveTokenPriceUSD(Number(chainId), {
        address: i.address,
        decimals: i.decimals,
        price: i.priceUSD,
        yieldProtocol: i.yieldProtocol,
        yieldAsset: i.yieldAsset
      }, { rpcUrl }).catch(() => null)
    ))
  ])
  const perShareByKey = {}
  zeroHeld.forEach((i, idx) => { if (perShare[idx] > 0) perShareByKey[i.key] = perShare[idx] })

  // A listed token that is priced is not auto-hidden (the entry builders' rule).
  // Re-applied here because a vault the API quotes no price for of its own is
  // priced only now, from its underlying. The user's own choice is never touched.
  const withPrice = (t, fields) => {
    const unhide = t.autoHidden && !t.hiddenByUser && fields.priceUSD > 0 && !!keyringByMetaKey[t.metaKey]
    return { ...t, ...fields, ...(unhide ? { autoHidden: false, isHidden: false } : {}) }
  }

  return tokens.map((raw) => {
    const t = withTagPatch(raw)
    const i = inputByKey[t.metaKey]
    if (!i) return t
    const label = yieldLabel(chainId, { symbol: t.symbol, name: t.name, address: t.contractAddress }, i.yieldProtocol, i.yieldAsset)
    const priceNote = `unit price $${i.priceUSD} from ${i.priceSource} (vault quote $${i.vaultQuoteUSD})`

    if (!(i.priceUSD > 0)) {
      logYield(`${label} | NO PRICE — ${priceNote} → left unchanged ($${t.valueUSD})`)
      return t
    }

    // Rebasing: the balance is already the underlying → balance × unit price.
    if (!isShareBasedProtocol(i.yieldProtocol)) {
      const valueUSD = t.balanceFormatted * i.priceUSD
      logYield(`${label} | ${t.balanceFormatted} × $${i.priceUSD} = $${valueUSD} | ${priceNote}`)
      return withPrice(t, { priceUSD: i.priceUSD, valueUSD })
    }

    // Share, held at zero: only the unit price is known; value is 0 by definition.
    if (i.rawBalance <= 0n) {
      const price = perShareByKey[t.metaKey]
      if (!(price > 0)) {
        logYield(`${label} | balance 0, per-share read FAILED → price left at $${t.priceUSD} | ${priceNote}`)
        return t
      }
      logYield(`${label} | balance 0 → $${price}/share | ${priceNote}`)
      return withPrice(t, { priceUSD: price, valueUSD: 0, isYieldConverted: true })
    }

    // Share, held: shares → underlying on-chain, × unit price.
    const v = values.get(t.metaKey)
    if (!v?.converted) {
      logYield(`${label} | convertToAssets FAILED → keeping $${t.valueUSD} ($${t.priceUSD}/share) | ${priceNote}`)
      return t
    }
    logYield(
      `${label} | ${t.balanceFormatted} shares → ${v.underlyingAmount} underlying × $${i.priceUSD} = $${v.valueUSD}` +
      ` ($${v.pricePerTokenUSD}/share) | ${priceNote}`
    )
    return withPrice(t, { priceUSD: v.pricePerTokenUSD, valueUSD: v.valueUSD, isYieldConverted: true })
  })
}

// The per-token price of ONE Keyring API row, for callers that price a token
// straight from the API instead of from a token-list refresh (useGetTokenPrice
// and everything built on it: token detail, Send, Exchange, Swap & Send, the
// pay-link preview; plus search and the add drawer). Same rules as
// applyYieldTokenValues, so no screen disagrees with the list:
//   - plain token → the API price;
//   - rebasing    → the underlying's unit price;
//   - share vault → per-SHARE price, converted off one synthetic share. Null
//                   when that read fails: the unit price is in the wrong unit
//                   there, so no price beats a wrong one.
export const resolveKeyringTokenPriceUSD = async (chainId, keyringToken) => {
  const apiPrice = toNumber(keyringToken?.price)
  const yieldProtocol = resolveApiYieldProtocol(keyringToken) || null
  if (!yieldProtocol) return apiPrice > 0 ? apiPrice : null

  const yieldAsset = resolveApiYieldAsset(keyringToken) || null
  const unit = unitPriceOf(yieldAsset, await fetchAssetPrices(chainId, [yieldAsset]), apiPrice)
  const unitPrice = unit.price
  const label = `[single price] ${yieldLabel(chainId, { symbol: keyringToken?.symbol, name: keyringToken?.name, address: keyringToken?.address }, yieldProtocol, yieldAsset)}`
  const priceNote = `unit price $${unitPrice} from ${unit.source} (vault quote $${apiPrice})`
  if (!isShareBasedProtocol(yieldProtocol)) {
    logYield(`${label} | → $${unitPrice > 0 ? unitPrice : null} | ${priceNote}`)
    return unitPrice > 0 ? unitPrice : null
  }

  const price = await resolveTokenPriceUSD(
    Number(chainId),
    {
      address: lowerCase(keyringToken?.address || ''),
      decimals: keyringToken?.decimals ?? 18,
      price: unitPrice,
      yieldProtocol,
      yieldAsset
    },
    { rpcUrl: getRpcUrlByChain(Number(chainId)) }
  )
  logYield(`${label} | → ${price > 0 ? `$${price}/share` : 'NULL (per-share read failed)'} | ${priceNote}`)
  return price
}

// Fetch via Moralis (chains in SUPPORTED_CHAINS_BY_SERVICE_MORALIS).
const fetchChainTokensViaMoralis = async (chainId, address) => {
  const moralisChain = SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]
  if (!moralisChain) return []

  // Throws on any failure (see Services/Moralis) — propagated so the caller can
  // try the next source instead of committing a wipe.
  const rows = await MoralisService.getTokenBalanceByWallet(address, moralisChain)
  if (!rows || rows.length === 0) {
    assertEmptyIsPlausible(chainId, address, 'Moralis')
    return []
  }

  return buildTokensFromRows(chainId, address, rows.map(normalizeMoralisRow))
}

// Fetch via the Alchemy Portfolio API — the fallback used when Moralis fails on
// a chain Alchemy also indexes. Same contract as the Moralis path: throws so the
// router can move on, never reports a failure as an empty wallet.
const fetchChainTokensViaAlchemy = async (chainId, address) => {
  const network = SUPPORTED_CHAINS_BY_SERVICE_ALCHEMY[chainId]
  if (!network) return []

  const rows = await AlchemyService.getTokenBalanceByWallet(address, network)
  if (!rows || rows.length === 0) {
    assertEmptyIsPlausible(chainId, address, 'Alchemy')
    return []
  }

  // normalizeAlchemyToken returns null for an unparseable balance — drop those
  // rather than letting one bad row fail the whole chain.
  return buildTokensFromRows(chainId, address, rows.map((t) => normalizeAlchemyToken(t, chainId)).filter(Boolean))
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
  const autoHidden = false

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
    autoHidden,
    isHidden: autoHidden,
    isManuallyShown: true
  }]
}

// ---------------------------------------------------------------------------
// Snapshot-backed discovery (non-Moralis chains only)
//
// On Moralis chains two independent sources exist: Moralis says what the wallet
// HOLDS, the Keyring API only adds price/metadata. Here the Keyring list is the
// only source of both — lose it and there is nothing left to scan, so the whole
// chain's tokens would vanish from the list.
//
// The previous snapshot plays the role Moralis plays over there: it already
// records what this wallet holds on this chain. We union it into the discovery
// list, so a token the API stopped returning is still scanned over RPC (which is
// working fine) and keeps its last known price/metadata.
// ---------------------------------------------------------------------------

// This chain's tokens from the current snapshot, keyed by contractAddress.
const snapshotTokensByAddress = (chainId, address) => {
  const entry = ReduxService.getAccountTokenList()[lowerCase(address)]
  const map = {}
  ;(entry?.tokens || []).forEach((t) => {
    if (Number(t.chainId) !== Number(chainId)) return
    map[t.contractAddress] = t
  })
  return map
}

// A snapshot map re-keyed by metaKey, which is how applyYieldTokenValues joins
// its inputs. Used to recover a token's yield identity when the live API
// response for THIS refresh doesn't carry one (see the fallback there). Takes
// the address-keyed map so the callers that already built one don't re-read it.
const byMetaKey = (snapshotByAddress) => {
  const map = {}
  Object.values(snapshotByAddress || {}).forEach((t) => {
    if (t?.metaKey) map[t.metaKey] = t
  })
  return map
}

// Shape a snapshot token like a Keyring API entry so the transform can consume
// it. `fromSnapshot` marks it as degraded: the commit then keeps the richer data
// it already has and refreshes only the live numbers.
const snapshotTokenAsKeyringEntry = (t) => ({
  address: t.contractAddress === NATIVE ? '' : t.contractAddress,
  symbol: t.symbol,
  name: t.name,
  decimals: t.decimals,
  // Last known price — EXCEPT for a converted vault, whose stored price is
  // per-SHARE while everything downstream treats this field as the UNDERLYING's
  // quote. Feeding it through would convert underlying units at a share's price,
  // inflating the position by the share/underlying ratio and compounding on
  // every recovery pass. With no price the conversion skips (no usable price)
  // and the commit's price fallback keeps the stored per-share figure, so the
  // row stays in the right unit and merely lags accrual until the API recovers.
  price: t.isYieldConverted ? 0 : t.priceUSD,
  icon_image: t.iconUrl,
  coinGeckoId: t.coinGeckoId,
  price_change_percentage_24h: t.priceChange24hPct,
  market_cap_rank: t.marketCapRank,
  categories: t.categories,
  // Carried so a vault recovered from the snapshot (API list came back short)
  // is still recognised as share-based and re-converted. Without these it would
  // silently fall back to shares × underlying-price and under-report itself.
  yieldProtocol: t.yieldProtocol,
  yieldAsset: t.yieldAsset,
  fromSnapshot: true
})

// Whether the snapshot records this discovery entry as a manually added token.
// Such a token must survive a zero balance (see transformMulticallEntry): the
// user asked for it, and dropping it here is what kept a zero-balance vault out
// of the yield conversion. Native is never custom.
const isCustomInSnapshot = (keyring, snapshotByAddress) => (
  !!keyring?.address && !!snapshotByAddress[lowerCase(keyring.address)]?.isCustom
)

// Keyring list ∪ tokens we already know this wallet holds here.
//
// A token present in BOTH keeps the live API entry, but inherits the snapshot's
// yield identity when the live one doesn't carry it. The chain-wide discovery
// list and the per-address lookup are different API queries and don't always
// agree on `yieldProtocol` — a manually added vault is tagged at add time (the
// drawer queries it by address) and would otherwise arrive untagged here,
// showing up as "N tokens, 0 tagged" and silently skipping the conversion. The
// live entry still wins whenever it HAS an answer, so a token the API stops
// classifying as a vault is not pinned by a stale snapshot.
const withSnapshotDiscovery = (keyringList, snapshotByAddress) => {
  const listed = new Set(
    (keyringList || []).map((k) => (k?.address ? lowerCase(k.address) : NATIVE))
  )
  const merged = (keyringList || []).map((k) => {
    const snap = snapshotByAddress[k?.address ? lowerCase(k.address) : NATIVE]
    if (!snap) return k
    // Live entry never answered → inherit the snapshot's identity as a PAIR, so
    // a protocol and the asset it scales by always travel together. Only an
    // actual TAG is inherited: a recorded `null` ("not a vault") is NOT copied
    // onto the live entry, because suppressing the identity re-ask is the
    // snapshot check's job in applyYieldTokenValues — which knows to exempt
    // custom tokens. Laundering the null into the "live" entry here would
    // overrule that exemption and freeze a custom token's add-time verdict.
    // A live answer wins; a live tag missing its asset borrows it from a
    // snapshot that agrees on the protocol (see resolveYieldIdentity).
    if (resolveApiYieldProtocol(k) === undefined && !snap.yieldProtocol) return k
    return { ...k, ...resolveYieldIdentity([k, snap]) }
  })
  const extra = Object.values(snapshotByAddress)
    .filter((t) => !listed.has(t.contractAddress))
    .map(snapshotTokenAsKeyringEntry)
  return [...merged, ...extra]
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
    } catch (e) {
      // console.error('fetchChainTokensViaMulticall getBlockChainList error', e)
    }
  }

  // No RPC → no evidence about any balance. Abort so the caller skips the commit
  // instead of committing an empty list and wiping this chain's tokens.
  if (!rpcUrl) throw new Error(`No RPC URL for chain ${chainId}`)

  // These chains have no indexer price fallback, so the Keyring list is the ONLY
  // price source — an incomplete one must abort the chain (caller skips the
  // commit) instead of silently degrading to "nothing has a price".
  const { items, ok, tooLarge } = await fetchAllCustomApiTokens(chainId, null, DISCOVERY_LIST_MAX_TOKENS)
  if (!ok) throw new Error(`Keyring token list incomplete for chain ${chainId}`)

  // Union with what we already know the wallet holds here, so an API list that
  // came back short can't make those tokens disappear.
  //
  // `tooLarge` drops the chain-wide list but NOT the snapshot: this commit
  // REPLACES the chain's tokens, so scanning native alone would delete every
  // ERC20 the user holds here. Scanning what the snapshot already knows keeps
  // those rows alive with fresh balances, and costs one call per held token
  // instead of one per listed token. Only a wallet with no snapshot at all
  // (first sync during an outage) falls through to native-only below.
  const snapshotByAddress = snapshotTokensByAddress(chainId, address)
  let keyringList = withSnapshotDiscovery(tooLarge ? [] : items, snapshotByAddress)
  // No discovery list at all (testnet / unindexed chain, nothing known yet) →
  // at least read the native balance.
  if (keyringList.length === 0) {
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
    // Read nothing at all → no evidence any token is gone. Abort the chain.
    throw new Error(`Multicall failed for chain ${chainId}`)
  }

  const tokens = []
  const keyringByMetaKey = {}
  results.forEach((r, i) => {
    const k = keyringList[i]
    if (r?.status !== 'success' || r.result == null) {
      // This one balance couldn't be read. Re-emit what we already had so a
      // transient RPC failure doesn't silently drop the token from the list.
      const prev = snapshotByAddress[k?.address ? lowerCase(k.address) : NATIVE]
      if (prev) tokens.push(prev)
      return
    }
    const entry = transformMulticallEntry(
      chainId, k, r.result, !!k?.fromSnapshot, isCustomInSnapshot(k, snapshotByAddress)
    )
    if (entry) {
      tokens.push(entry)
      keyringByMetaKey[entry.metaKey] = k
    }
  })
  return applyYieldTokenValues(chainId, tokens, keyringByMetaKey, byMetaKey(snapshotByAddress))
}

// Fetch via sequential (bounded-concurrency) per-token RPC reads — the fallback
// for chains with NEITHER Moralis support NOR a Multicall3 deployment. Same
// discovery list as the multicall path; each token's balance is read directly
// with getBalance (native) / balanceOf (ERC20), so it works on any plain RPC.
const fetchChainTokensViaSequentialRpc = async (chainId, address) => {
  const rpcUrl = getRpcUrlByChain(Number(chainId))
  // No RPC → no evidence about any balance; abort instead of wiping the chain.
  if (!rpcUrl) throw new Error(`No RPC URL for chain ${chainId}`)

  // Same reasoning as the multicall path: an incomplete price list must abort the
  // chain, not turn every token into a priceless one. The size cap matters even
  // more here — this path reads one token per RPC round-trip.
  const { items, ok, tooLarge } = await fetchAllCustomApiTokens(chainId, null, DISCOVERY_LIST_MAX_TOKENS)
  if (!ok) throw new Error(`Keyring token list incomplete for chain ${chainId}`)

  // Union with the snapshot — see withSnapshotDiscovery. On `tooLarge` the
  // snapshot becomes the whole discovery list (same reasoning as the multicall
  // path: replacing the chain with native alone would delete the user's ERC20s).
  const snapshotByAddress = snapshotTokensByAddress(chainId, address)
  let keyringList = withSnapshotDiscovery(tooLarge ? [] : items, snapshotByAddress)
  // Nothing to scan at all → at least read the native balance.
  if (keyringList.length === 0) {
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
  const keyringByMetaKey = {}
  for (let i = 0; i < keyringList.length; i += SEQUENTIAL_RPC_CONCURRENCY) {
    const batch = keyringList.slice(i, i + SEQUENTIAL_RPC_CONCURRENCY)
    const balances = await Promise.all(batch.map(readBalance))
    balances.forEach((rawBalance, j) => {
      const k = batch[j]
      if (rawBalance == null) {
        // Failed read → keep what we already had instead of dropping the token.
        const prev = snapshotByAddress[k?.address ? lowerCase(k.address) : NATIVE]
        if (prev) tokens.push(prev)
        return
      }
      const entry = transformMulticallEntry(
        chainId, k, rawBalance, !!k?.fromSnapshot, isCustomInSnapshot(k, snapshotByAddress)
      )
      if (entry) {
        tokens.push(entry)
        keyringByMetaKey[entry.metaKey] = k
      }
    })
  }
  return applyYieldTokenValues(chainId, tokens, keyringByMetaKey, byMetaKey(snapshotByAddress))
}

// A "fast" chain returns its balances in a single round-trip (Moralis API or one
// Multicall3 call). Everything else is "slow" — it falls back to per-token RPC
// reads. Used to decide which chains the loading indicator waits on.
// An indexer answers in ONE request, so an Alchemy-backed chain belongs with the
// blocking group even when it has no Multicall3 deployment. Leaving it out sent
// those chains to the background batch, where the caller's spinner stops before
// their tokens arrive — the list looks empty for a moment on a chain that is
// actually one of the quickest to load.
const isFastChain = (chainId) =>
  !!SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId] ||
  !!SUPPORTED_CHAINS_BY_SERVICE_ALCHEMY[chainId] ||
  MULTICALL3_CHAIN_IDS.has(Number(chainId))

// The ordered balance sources for a chain — tried in turn until one answers.
//
//   1. Moralis          (indexer)  — one API call, discovers tokens
//   2. Alchemy          (indexer)  — same, used when Moralis is down
//   3. multicall / sequential RPC  — reads a KNOWN list, discovers nothing
//
// Indexers come first because their cost scales with what the wallet holds. The
// RPC tiers scale with the Keyring token list instead, so they are the last
// resort and are size-capped (DISCOVERY_LIST_MAX_TOKENS) — on a big chain they
// degrade to the native balance rather than probing thousands of contracts.
const balanceSourcesFor = (chainId) => {
  const sources = []
  if (SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]) sources.push(fetchChainTokensViaMoralis)
  if (SUPPORTED_CHAINS_BY_SERVICE_ALCHEMY[chainId]) sources.push(fetchChainTokensViaAlchemy)
  sources.push(
    MULTICALL3_CHAIN_IDS.has(Number(chainId))
      ? fetchChainTokensViaMulticall
      : fetchChainTokensViaSequentialRpc
  )
  return sources
}

// A token whose symbol will never be rendered doesn't need an on-chain `symbol()`
// read. `isHidden` isn't decided until commitChainTokens, so the verdict is
// re-derived here from the same two inputs that merge uses:
//   - the user's sticky choice (userHiddenKeys), which always wins;
//   - otherwise this fetch's `autoHidden`, but ONLY for a token that isn't
//     already visible in the snapshot — commitChainTokens never re-hides a
//     visible token, so neither may this.
// Deliberately conservative: when in doubt the symbol gets resolved. Reading one
// symbol too many costs an eth_call; skipping one too few shows a stale ticker.
// (No chainId parameter: `metaKey` already encodes it, so the lookups below are
// chain-correct on their own.)
const buildSkipFetchOnChainForHiddenSymbols = (address) => {
  const entry = ReduxService.getAccountTokenList()[lowerCase(address)]
  const userHiddenKeys = entry?.userHiddenKeys || {}
  const prevByKey = {}
  ;(entry?.tokens || []).forEach((t) => { prevByKey[t.metaKey] = t })

  return (token) => {
    const hiddenByUser = resolveHiddenByUser(prevByKey[token?.metaKey], userHiddenKeys, token?.metaKey)
    if (hiddenByUser !== undefined) return hiddenByUser
    const prevT = prevByKey[token?.metaKey]
    if (prevT && !prevT.isHidden) return false
    return !!token?.autoHidden
  }
}

// `skipFetchOnChainForHiddenSymbols` is opt-in, and only the account-balance
// refresh opts in. Callers that build a SELECTABLE list (the swap/bridge token
// pickers) must not: there, an auto-hidden token is still shown to the user and
// needs its real ticker, so they keep resolving every symbol.
export const fetchChainTokens = async (chainId, address, isCallAPIGetRpc = false, { skipFetchOnChainForHiddenSymbols = false } = {}) => {
  if (!chainId || !address) return []

  const sources = balanceSourcesFor(chainId)
  const shouldSkip = skipFetchOnChainForHiddenSymbols ? buildSkipFetchOnChainForHiddenSymbols(address) : undefined
  let lastError
  for (const fetchFrom of sources) {
    try {
      const tokens = await fetchFrom(chainId, address, isCallAPIGetRpc)
      // Single choke point for the displayed symbol: every balance source lands
      // here before the commit, so applying the API's `symbolOnchain` (or reading
      // `symbol()` on-chain when it's absent) once here covers every screen that
      // renders a token. Never throws — a failed resolve returns the tokens with
      // the symbols they already had.
      return await resolveOnchainSymbols(chainId, tokens, { shouldSkip })
    } catch (error) {
      // This source couldn't answer — try the next one. Note that an empty (but
      // successful) result is NOT a failure and ends the loop here: only a throw
      // means "we couldn't ask".
      lastError = error
    }
  }

  // Every source failed → no evidence about any balance on this chain. Rethrow
  // so the caller skips the commit and keeps whatever it already had.
  throw lastError
}

// What the USER explicitly asked for: true = hid it, false = brought it back,
// undefined = never touched it (leave the decision to the auto rule).
// Snapshots written before `hiddenByUser` existed only had `isHidden` +
// `isManuallyShown`, which conflated "the user hid this" with "auto-hidden for
// lack of a price" — so only an explicit un-hide can be recovered from them.
// Everything else is treated as unknown, which is what un-sticks the tokens
// already frozen in the hidden list.
// `userHiddenKeys` (account level, keyed by metaKey) is the authoritative copy:
// it outlives the token objects themselves, which get destroyed whenever a chain
// is toggled off (pruneInactiveChainTokens) or the balance drops to 0 and the
// token leaves the list. Without it, hiding a token and later re-acquiring it
// would silently un-hide it.
const resolveHiddenByUser = (prevT, userHiddenKeys, metaKey) => {
  const fromAccount = userHiddenKeys?.[metaKey]
  if (typeof fromAccount === 'boolean') return fromAccount
  if (typeof prevT?.hiddenByUser === 'boolean') return prevT.hiddenByUser
  if (prevT?.isManuallyShown) return false
  return undefined
}

// Stamp a freshly built token with the user's remembered choice (no-op when they
// never made one). Used wherever a token enters the list without going through
// the commit merge — i.e. the targeted RPC refresh's discovery path.
const withUserHiddenChoice = (token, choice) => (
  choice === undefined
    ? token
    : { ...token, isHidden: choice, hiddenByUser: choice, isManuallyShown: !choice }
)

// Commit ONE chain's freshly-fetched tokens into the account entry, replacing
// only that chain's tokens and leaving every other chain untouched. This lets
// chains land progressively (a slow chain never blocks a fast one from showing).
// Commits are synchronous read-modify-write, so the event loop serializes them
// and there's no lost-update race between concurrent chain fetches.
const commitChainTokens = (address, chainId, chainTokens) => {
  const currentList = ReduxService.getAccountTokenList()
  const prevTokens = currentList[address]?.tokens || []
  const userHiddenKeys = currentList[address]?.userHiddenKeys || {}
  const id = Number(chainId)

  // Flags to carry over (keyed by metaKey) + this chain's previous custom tokens.
  const prevByKey = {}
  prevTokens.forEach((t) => { prevByKey[t.metaKey] = t })

  // Tokens from OTHER chains are kept verbatim.
  const otherChainTokens = prevTokens.filter((t) => Number(t.chainId) !== id)

  // Hidden flag rules, in order of precedence:
  //   1. the user's own choice (hiddenByUser) always wins and is sticky;
  //   2. a token ALREADY in the main list is never auto-hidden again — a later
  //      fetch that can't price it (API error, empty `price`, token dropped from
  //      the Keyring list) leaves it where the user expects it, priced off
  //      Moralis / its last known price;
  //   3. otherwise (first sighting, or currently auto-hidden) the auto verdict of
  //      THIS fetch applies, so an auto-hidden token returns to the main list as
  //      soon as it gets a price.
  // Only the auto verdict may move a token hidden → visible; visible → hidden is
  // the user's call alone. Inheriting `isHidden` wholesale (the old behaviour)
  // froze the very first verdict forever, stranding priced tokens in Hidden.
  const merged = chainTokens.map((t) => {
    const prevT = prevByKey[t.metaKey]
    // `symbolOnchain` is dropped here: the resolver has already applied it to
    // `symbol`, so it is a transient input field and never reaches Redux.
    const { pricingDegraded, symbolOnchain, ...fresh } = t // eslint-disable-line no-unused-vars

    if (!prevT) {
      // Never seen in this snapshot — the auto verdict applies, unless the user
      // had already made a call on this token before it left the list.
      return withUserHiddenChoice(fresh, resolveHiddenByUser(null, userHiddenKeys, t.metaKey))
    }

    const hiddenByUser = resolveHiddenByUser(prevT, userHiddenKeys, t.metaKey)
    const wasVisible = !prevT.isHidden
    const isHidden = hiddenByUser !== undefined
      ? hiddenByUser
      : (wasVisible ? false : !!t.autoHidden)

    // Balances always refresh. The price falls back to the last known one only
    // when THIS fetch found none at all, so an outage doesn't zero out a row and
    // let the UI's dust filter swallow it.
    const priceUSD = t.priceUSD > 0 ? t.priceUSD : toNumber(prevT.priceUSD)
    const valueUSD = (t.balanceFormatted || 0) * priceUSD

    // A degraded fetch carries Moralis-only metadata — keep the richer snapshot
    // we already have and refresh just the live numbers on top of it.
    const base = pricingDegraded ? prevT : fresh

    return {
      ...base,
      balance: t.balance,
      balanceFormatted: t.balanceFormatted,
      priceUSD,
      valueUSD,
      // The resolver (symbolOnchain.js) already wrote the contract's ticker onto
      // `symbol` before the commit, so this just carries it over — including on a
      // degraded fetch, where `base` is the previous snapshot: a degraded batch
      // only means the PRICE list was incomplete, which says nothing about the
      // symbol. When nothing was resolved, `base` keeps what it already had.
      //
      // `symbolOnchain` is deliberately NOT persisted: it is a transient input
      // field, and `symbol` already carries the resolved answer.
      ...(t.symbolOnchain ? { symbol: t.symbol } : {}),
      // Reflects THIS fetch: `base` may be the previous snapshot (degraded
      // fetch), and a stale flag there must not outlive the conversion it
      // described. `priceUSD` above is already the per-share price for a
      // converted token, so valueUSD recomputes consistently either way.
      //
      // On a DEGRADED row the fetch ran no conversion at all — the entry was
      // rebuilt from this very snapshot — so the previous verdict stands, the
      // same way yieldProtocol below falls back. Clearing it would mark a
      // per-share price as unconverted, and the next snapshot recovery would
      // feed that price back through the conversion as if it were the
      // underlying's (see snapshotTokenAsKeyringEntry).
      isYieldConverted: pricingDegraded ? !!(t.isYieldConverted || prevT.isYieldConverted) : !!t.isYieldConverted,
      // Same reasoning for the yield identity itself. The live fetch answers
      // first; the snapshot only fills in when the fetch has nothing to say —
      // which keeps a manually added token's tags alive on a chain whose
      // indexer doesn't list it. Explicit `!== undefined`, because neither `||`
      // nor `??` can express this: `null` is a recorded answer ("not a vault",
      // written only by address-authoritative lookups) and must stand, while
      // `undefined` means "never answered" and inherits whatever the snapshot
      // knew — including its own `undefined`, so a token added before yield
      // support shipped keeps asking until something answers. The old trailing
      // `|| null` is what converted "never asked" into a permanent "not a
      // vault" on the first refresh after an app update.
      yieldProtocol: t.yieldProtocol !== undefined ? t.yieldProtocol : prevT.yieldProtocol,
      yieldAsset: t.yieldAsset !== undefined ? t.yieldAsset : prevT.yieldAsset,
      isHidden,
      ...(hiddenByUser === undefined ? {} : { hiddenByUser }),
      isCustom: !!prevT.isCustom,
      isManuallyShown: hiddenByUser === false ? true : (hiddenByUser === true ? false : !!prevT.isManuallyShown)
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
  // Existing tokens whose yield identity was never recorded. Keyed on the MISSING
  // TAG, not on the balance: a token added by an older build (or added while the
  // Keyring lookup failed) carries neither yieldProtocol nor yieldAsset, and
  // nothing else ever revisits it — an indexer that doesn't list it leaves the
  // full-chain pass re-attaching its stored copy verbatim. It must be re-asked
  // whether it holds a balance or not, because the vault re-pricing below
  // selects by `yieldProtocol` and would otherwise never see it. `undefined`
  // always asks; `null` asks only for custom tokens (see the push site below).
  const untaggedMetaKeys = []

  targets.forEach(({ addr, metaKey, existing }, i) => {
    const rawBalance = rawBalances[i]
    if (rawBalance == null) return // failed read → leave the token as-is
    if (existing) {
      // `null` is a recorded answer and normally left alone — except on CUSTOM
      // tokens, whose answer was written at add time and may predate the API
      // listing/tagging them. The full-refresh pass re-asks those too (see
      // applyYieldTokenValues); this path must agree, or a post-send refresh
      // would keep the stale verdict alive.
      if (addr !== NATIVE && (existing.yieldProtocol === undefined || (existing.isCustom && existing.yieldProtocol === null))) untaggedMetaKeys.push(metaKey)
      const decimals = addr === NATIVE ? 18 : Number(existing.decimals ?? 18)
      let balanceFormatted = 0
      try { balanceFormatted = Number(formatUnits(rawBalance, decimals)) } catch { return }
      if (balanceFormatted <= 0) {
        // Drained to zero → drop it, unless the user added it as a custom token.
        if (!existing.isCustom) {
          removedMetaKeys.add(metaKey)
          return
        }
        // A custom token stays — but its numbers must still be patched: skipping
        // the update left the stale pre-send balance on screen, and (for a
        // share-based vault) kept it out of `touchedYield` below, freezing its
        // per-share price at whatever the add-time read returned while the
        // detail screen kept showing a fresh one.
        updates[metaKey] = {
          balance: rawBalance.toString(),
          balanceFormatted,
          valueUSD: 0
        }
        return
      }
      // Provisional value: shares × the cached per-SHARE price. Correct for every
      // plain token, and for a vault it is re-derived from a fresh
      // convertToAssets read further down (see reprice below) — a vault accrues
      // by making each share worth more, which `balanceOf` alone cannot see.
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
    const userHiddenKeys = entry?.userHiddenKeys || {}
    unknownWithBalance.forEach(({ addr, rawBalance }) => {
      const keyring = addr === NATIVE ? null : keyringList.find((k) => lowerCase(k?.address) === addr)
      const built = transformMulticallEntry(chainId, keyring, rawBalance)
      // A token the user hid can leave the list (drained to 0) and come back via
      // a later receive/swap — honour their choice instead of silently unhiding.
      if (built) addedTokens.push(withUserHiddenChoice(built, resolveHiddenByUser(null, userHiddenKeys, built.metaKey)))
    })
  }

  // Tokens discovered by THIS path never pass through fetchChainTokens, so they
  // need their on-chain symbol resolved here or they'd sit in the list with the
  // API's symbol until the next full refresh. Only the newly added ones are
  // resolved — the tokens already in the list were resolved when they entered,
  // and the resolver's cache makes a repeat lookup free anyway.
  // Hidden ones are skipped, same as the full refresh — their symbol is never
  // rendered. These entries already carry their FINAL `isHidden` (stamped by
  // withUserHiddenChoice above), so the check is exact here rather than re-derived.
  // `symbolOnchain` is dropped on the way in — the resolver has already applied
  // it to `symbol`, and it is never persisted (see commitChainTokens).
  const resolvedAddedTokens = addedTokens.length > 0
    ? (await resolveOnchainSymbols(chainId, addedTokens, { shouldSkip: (t) => !!t?.isHidden }))
      .map(({ symbolOnchain, ...t }) => t) // eslint-disable-line no-unused-vars
    : addedTokens

  if (
    Object.keys(updates).length === 0 &&
    removedMetaKeys.size === 0 &&
    addedTokens.length === 0 &&
    untaggedMetaKeys.length === 0
  ) return

  let tokens = (entry?.tokens || [])
    .filter((t) => !removedMetaKeys.has(t.metaKey))
    .map((t) => (updates[t.metaKey] ? { ...t, ...updates[t.metaKey] } : t))
  tokens = [...tokens, ...resolvedAddedTokens]

  // Backfill the yield identity of the untagged tokens above, BEFORE the vault
  // re-pricing below — that block selects by `yieldProtocol`, so a token tagged
  // here is converted in this same pass rather than waiting for the next one.
  //
  // Value is left to the re-pricing below, which handles BOTH shapes: a held
  // balance is converted through core (per-share price × shares), and a
  // zero-balance vault — necessarily custom, everything else was removed above —
  // has its unit price refreshed by applyYieldTokenValues' zero-balance branch.
  if (untaggedMetaKeys.length > 0) {
    const untaggedSet = new Set(untaggedMetaKeys)
    // A token collected above can still be gone from `tokens` (drained to 0 and
    // not custom). An empty `addresses` array makes fetchKeyringTokens fall back
    // to downloading the chain's whole first page, so skip the call entirely.
    const untagged = tokens.filter((t) => untaggedSet.has(t.metaKey))
    try {
      const fresh = untagged.length > 0
        ? await fetchKeyringTokens(chainId, untagged.map((t) => t.contractAddress))
        : []
      const byMetaKey = {}
      fresh.forEach((k) => {
        if (k?.address) byMetaKey[buildMetaKey(chainId, lowerCase(k.address))] = k
      })
      tokens = tokens.map((t) => {
        if (!untaggedSet.has(t.metaKey)) return t
        const k = byMetaKey[t.metaKey]
        // No entry means the API never answered for this token — leave it
        // untagged so a later refresh asks again, rather than recording a `null`
        // that would read as the settled answer "not a vault".
        if (!k) return t
        return { ...t, yieldProtocol: resolveApiYieldProtocol(k) || null, yieldAsset: resolveApiYieldAsset(k) || null }
      })
    } catch {
      // Best-effort — the token keeps what it had and is re-asked next refresh.
    }
  }

  // Re-price the YIELD tokens among the tokens we just touched, through the same
  // applyYieldTokenValues the full refresh uses (rebasing → balance × unit
  // price; share → converted on-chain). Without this a vault could never show
  // accrued yield here: its share count doesn't move as it earns, so
  // `shares × cached price` reproduces the same value forever.
  //
  // The cached `priceUSD` must not be the fallback price: for a converted vault
  // it is per-SHARE, and valuing underlying units at a share's price inflates
  // the position by the share/underlying ratio. So the vault's fresh API quote
  // (0 when it has none) is the fallback, and a token left without any price
  // keeps its provisional value. Zero-balance vaults (custom only) are priced
  // off one synthetic share.
  const addedMetaKeys = new Set(addedTokens.map((t) => t.metaKey))
  const isTouched = (t) => !!updates[t.metaKey] || addedMetaKeys.has(t.metaKey)
  const touchedYield = tokens.filter((t) => isTouched(t) && t.yieldProtocol)
  if (touchedYield.length > 0) {
    try {
      const fresh = await fetchKeyringTokens(chainId, touchedYield.map((t) => t.contractAddress))
      const byMetaKey = {}
      fresh.forEach((k) => {
        if (k?.address) byMetaKey[buildMetaKey(chainId, lowerCase(k.address))] = k
      })
      const priced = touchedYield
        .filter((t) => byMetaKey[t.metaKey])
        .map((t) => ({ ...t, priceUSD: toNumber(byMetaKey[t.metaKey].price) }))
      if (priced.length > 0) {
        const valued = await applyYieldTokenValues(chainId, priced, byMetaKey)
        const valuedByKey = {}
        // Only tokens that came back PRICED are taken. A share vault that failed
        // to convert (or anything left at 0) is skipped: its `priced` copy
        // carries the fallback quote beside the provisional value.
        valued.forEach((t) => {
          const ok = isShareBasedProtocol(t.yieldProtocol) ? t.isYieldConverted : t.priceUSD > 0
          if (ok) valuedByKey[t.metaKey] = t
        })
        tokens = tokens.map((t) => valuedByKey[t.metaKey] || t)
      }
    } catch {
      // Keep the provisional value — a flaky RPC or API must not zero a
      // position, only leave it slightly behind.
    }
  }

  // Re-price the PLAIN tokens this pass touched. Without this the targeted path
  // only ever re-read `balanceOf` and recomputed `balance x <the price already in
  // Redux>` — so a token's unit price could not move until the next FULL
  // multi-chain refresh happened to run.
  //
  // That is the WETH-on-Optimism report: the token API quoted $2494.36 while the
  // detail screen showed $2406.97. TokenDetailScreen fires this targeted refresh
  // on every mount and, whenever a balance is held, renders `token.priceUSD` from
  // Redux rather than its own live `useGetTokenPrice` value — deliberately, so the
  // price shown and the holding value shown always come from ONE snapshot.
  //
  // Yield tokens are excluded: the block above already priced them from their
  // underlying, and the vault's own quote would undo that.
  const touchedPlain = tokens.filter((t) => isTouched(t) && !t.yieldProtocol)
  // The chain's NATIVE row rides along on every chunked response (address ''),
  // so an ERC20 lookup re-prices native for free. But a NATIVE-ONLY refresh —
  // opening ETH's detail screen, or coming back from sending ETH — has no ERC20
  // to ride on, and an empty address list would make fetchKeyringTokens fall
  // back to downloading the chain's whole first page (50 rows) to find one.
  //
  // So native asks by ZERO ADDRESS instead: `addresses=0x000…0` returns exactly
  // the one native row (verified against keyrings/tokens/all/10 — `total: 1`).
  // That is the same native → zeroAddress mapping useGetTokenPrice already uses
  // for this endpoint, so it is the endpoint's own convention rather than a
  // trick local to this call site.
  //
  // This holds even on the chains whose native coin lives at a REAL contract
  // address rather than the zero sentinel (Celo, Cronos, Stable — see
  // NATIVE_TOKEN_BY_CHAIN_ID): the API answers a zeroAddress query with THAT
  // chain's native row, verified live as `celo`, `cro` and `usdt0`. Those
  // addresses never arrive here anyway — `isNativeToken(addr, chainId)` at the
  // top of this function consults the same map and normalizes them to the
  // NATIVE sentinel on the way in.
  //
  // Which is load-bearing rather than incidental: Cronos' native address
  // resolves to USDC on this API, so an address-based lookup would price CRO
  // (~$0.06) as a dollar stablecoin. Keep native identified by the sentinel,
  // never by its address.
  const plainErc20 = touchedPlain.filter((t) => t.contractAddress !== NATIVE)
  const wantsNative = touchedPlain.some((t) => t.contractAddress === NATIVE)
  const lookupAddresses = wantsNative && plainErc20.length === 0
    ? [zeroAddress]
    : plainErc20.map((t) => t.contractAddress)
  if (lookupAddresses.length > 0) {
    try {
      const fresh = await fetchKeyringTokens(chainId, lookupAddresses)
      const freshByKey = {}
      // ERC20s match by address, as everywhere else. The chain's native row is
      // the ADDRESSLESS one — the same "no address ⇒ native" rule
      // withSnapshotDiscovery uses when it re-keys the API list.
      let nativeKeyring = null
      fresh.forEach((k) => {
        if (k?.address) freshByKey[buildMetaKey(chainId, lowerCase(k.address))] = k
        else if (!nativeKeyring) nativeKeyring = k
      })

      // How far that addressless row can be trusted depends on how it arrived.
      //
      // The guarantee is NOT that one row comes back — the API appends this
      // chain's native row to EVERY response, even for an address it does not
      // know (verified: `…dead`, and the literal string `notanaddress`, both
      // answer with it). What a zeroAddress query does is match no ERC20, so
      // the addressless row is the only thing left — and an addressless row is
      // this chain's native by construction. Identity therefore comes from the
      // request, not from a symbol comparison.
      //
      // That distinction matters because the stored symbol does NOT come from
      // this API: it is Moralis' / Alchemy's / getChainInfo's, and they
      // disagree (Polygon reports `MATIC` long after the API moved to `pol`).
      // The API is not even self-consistent in case — 'eth' on Optimism but
      // 'ETH' on Unichain, both verified live. Gating on a symbol match would
      // fail SHUT on any such mismatch, freezing native's price permanently:
      // the exact bug this block exists to fix, re-entered through a side door.
      //
      // When native merely rides along on an ERC20 lookup the request proves
      // nothing about it, so the symbol check stays as the confirming signal —
      // the same rule findKeyringMatch applies on the discovery paths.
      const nativeIsExact = lookupAddresses.length === 1 && lookupAddresses[0] === zeroAddress
      const nativeSymbol = lowerCase(nativeKeyring?.symbol || nativeKeyring?.auditGoplus?.token_symbol || '')
      const matchesNative = (t) => {
        if (!nativeKeyring) return false
        if (nativeIsExact) return true
        return !!nativeSymbol && lowerCase(t.symbol) === nativeSymbol
      }

      tokens = tokens.map((t) => {
        const k = t.contractAddress === NATIVE
          ? (matchesNative(t) ? nativeKeyring : null)
          : freshByKey[t.metaKey]
        if (!k) return t
        // Native is only re-priced when it was actually touched by this pass —
        // it is in `tokens` on every refresh, and re-pricing an untouched row
        // would quietly widen a targeted refresh into something it isn't.
        if (t.contractAddress === NATIVE && !(updates[t.metaKey] || addedMetaKeys.has(t.metaKey))) return t
        // Only a POSITIVE quote replaces what we have. A zero/absent price means
        // the API had nothing to say this time — keeping the last known price is
        // what stops an outage from zeroing a row and letting the UI's dust
        // filter swallow it, exactly as commitChainTokens' own fallback does.
        const priceUSD = toNumber(k.price)
        if (!(priceUSD > 0)) return t
        // The 24h change rides along: the detail screen's hero % and the change
        // row read it from this same entry, so refreshing the price while leaving
        // a day-old percentage beside it just moves the disagreement.
        //
        // Guarded on the RAW field, not on toNumber's output: toNumber maps a
        // missing/unparseable value to 0, which is indistinguishable from a real
        // flat 0% — writing it would silently zero a good percentage whenever the
        // API omits the field. An explicitly sent 0 still lands.
        const rawChange = k.price_change_percentage_24h
        const hasChange = rawChange !== undefined && rawChange !== null && rawChange !== '' &&
          Number.isFinite(Number(rawChange))
        return {
          ...t,
          priceUSD,
          valueUSD: (t.balanceFormatted || 0) * priceUSD,
          ...(hasChange ? { priceChange24hPct: Number(rawChange) } : {})
        }
      })
    } catch {
      // Best-effort, same contract as the vault block: the row keeps its last
      // known price rather than losing its value to a flaky API.
    }
  }

  tokens.sort((a, b) => (b.valueUSD || 0) - (a.valueUSD || 0))
  const totalUSD = tokens.reduce((sum, t) => sum + (t.valueUSD || 0), 0)

  // `lastSyncedAt` is deliberately NOT bumped here. It records when the account's
  // WHOLE list was last synced (every active chain, every token) — that is what
  // isStaleForActiveChains and the focus/open re-fetch gates read. This pass only
  // re-read the handful of tokens the caller named on ONE chain, so stamping
  // `now` would claim a full sync that never happened and keep a genuinely stale
  // list (other chains, other tokens) looking fresh after every send/swap.
  ReduxService.setAccountTokenList({
    ...currentList,
    [address]: { ...(entry || {}), tokens, totalUSD }
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

  // On a FULL refresh, record what this run COVERED and how it went, so consumers
  // can lazily re-fetch. Skipped for filtered (subset) refreshes since they don't
  // cover the whole active set.
  //
  // `syncedChainIds` deliberately records the chains the refresh ATTEMPTED, not
  // the ones that succeeded: it exists to detect a chain being added/removed on
  // the Network screen, and putting only successes in it would make a failing
  // chain indistinguishable from a chain-list change — which re-triggers on every
  // commit and loops for as long as the outage lasts. Failures get their own
  // marker so the retry can be rate-limited instead (isStaleForActiveChains).
  const stampRefreshOutcome = (failedChainIds) => {
    if (!isFullRefresh) return
    const list = ReduxService.getAccountTokenList()
    // Every chain failed on an account with nothing cached yet → no entry exists
    // to stamp, but the attempt still has to be recorded or the retry cooldown
    // has no starting point to measure from.
    const base = list[address] || { tokens: [], totalUSD: 0 }
    ReduxService.setAccountTokenList({
      ...list,
      [address]: {
        ...base,
        syncedChainIds: activeChainIds,
        failedChainIds,
        lastAttemptAt: Date.now()
      }
    })
  }

  // Resolves to null on success, or to the chainId that couldn't be read — the
  // caller needs to know WHICH chains are missing, not just that something went
  // wrong, so the outcome is reported as a value instead of being swallowed.
  // skipFetchOnChainForHiddenSymbols: this is the balance list, where a hidden
  // token's symbol is never rendered — so it doesn't earn an on-chain `symbol()`
  // read.
  const fetchAndCommit = (chainId) =>
    fetchChainTokens(chainId, address, false, { skipFetchOnChainForHiddenSymbols: true })
      .then((tokens) => {
        commitChainTokens(address, chainId, tokens)
        return null
      })
      .catch(() => Number(chainId))

  const fastChains = chainIds.filter(isFastChain)
  const slowChains = chainIds.filter((id) => !isFastChain(id))

  // Fire the slow chains without awaiting — they commit progressively in the
  // background. If there are no fast chains, wait on the slow ones instead so
  // the loading indicator still has something to track.
  const blocking = fastChains.length > 0 ? fastChains : slowChains
  const background = fastChains.length > 0 ? slowChains : []

  // A full refresh that arrives while one is already queued or in flight for
  // this address joins it instead of doubling the request count.
  if (isFullRefresh) {
    const inFlight = pendingFullRefresh.get(address)
    if (inFlight) return inFlight
  }

  // Flag this account as loading (consumed by the home account list icon) BEFORE
  // queuing, so a row that is waiting its turn says so instead of showing a
  // momentary zero. The flag is cleared only once EVERY chain settles —
  // including the slow background ones — even though this function returns
  // earlier (after the fast chains) to keep the caller's indicator snappy.
  ReduxService.setTokenLoading(address, true)

  // Only a FULL refresh queues: a targeted refresh (after a send / swap) is a
  // single chain the user is waiting on, and must not sit behind a home-screen
  // balance sweep.
  const runBlocking = () => Promise.all(blocking.map(fetchAndCommit))
  const blockingResults = isFullRefresh ? accountSweepLimit(runBlocking) : runBlocking()
  const backgroundResults = Promise.all(background.map((chainId) => (
    isFullRefresh ? backgroundChainLimit(() => fetchAndCommit(chainId)) : fetchAndCommit(chainId)
  )))

  // Runs in the SAME tick the sweep settles in, never a microtask later: until
  // the entry is released, a new refresh for this address joins the promise that
  // just resolved and returns without fetching anything.
  const finish = () => {
    ReduxService.setTokenLoading(address, false)
    // Released only once the background chains are done too — releasing after
    // the fast ones would let a second sweep of this same account start while
    // the first is still committing.
    if (isFullRefresh) pendingFullRefresh.delete(address)
  }

  // fetchAndCommit reports a failure as a value and never rejects, so plain
  // Promise.all is safe here and keeps the per-chain outcomes in order. The
  // catch is a backstop, not an expected path: if anything above threw
  // unexpectedly, the loading flag the home row spins on must still clear and
  // the pending entry must still be released — a leaked one would leave this
  // account permanently unrefreshable.
  Promise.all([blockingResults, backgroundResults])
    .then(([blockingOutcomes, backgroundOutcomes]) => {
      // Stamp only after EVERY chain (incl. slow background) has settled, so the
      // coverage marker reflects a fully completed full-refresh.
      const failedChainIds = [...blockingOutcomes, ...backgroundOutcomes].filter((id) => id != null)
      stampRefreshOutcome(failedChainIds)
      finish()
    })
    .catch(finish)

  // Resolves when the FAST chains are done (see the doc comment above): the
  // caller's spinner stops early while the slow ones keep filling in.
  // Never rejects: callers (and anyone joining via pendingFullRefresh) get the
  // account entry as it stands, exactly as they did before this was queued.
  // A chain that failed is already reported through failedChainIds.
  const readEntry = () => ReduxService.getAccountTokenList()[address] || null
  const result = Promise.resolve(blockingResults).then(readEntry, readEntry)

  // Registered synchronously — nothing between the lookup above and this line
  // awaits, so two calls for the same address can never both get through.
  if (isFullRefresh) pendingFullRefresh.set(address, result)

  return result
}

// True when an account's cached tokens no longer match the current active EVM
// chain list — i.e. never synced, or a chain was added/removed since the last
// full refresh. Consumers use this to lazily re-fetch (on focus / on open)
// instead of refetching everything whenever the chain list changes. Order-
// insensitive compare since the active list isn't kept sorted.
export const isStaleForActiveChains = (entry, activeChainIds) => {
  const cooledDown = Date.now() - (entry?.lastAttemptAt || 0) >= FAILED_RETRY_COOLDOWN_MS

  // Nothing has ever landed for this account (never fetched, or every chain
  // failed on the way in). Retry — but no faster than the cooldown, so an outage
  // doesn't refetch on every focus.
  if (!entry?.lastSyncedAt) return cooledDown

  const synced = [...(entry.syncedChainIds || [])].map(Number).sort((a, b) => a - b)
  const active = [...(activeChainIds || [])].map(Number).sort((a, b) => a - b)
  if (synced.length !== active.length) return true
  if (synced.some((id, i) => id !== active[i])) return true

  // Chain list unchanged, but some chains couldn't be read last time — their
  // tokens are missing or frozen at old values, so this account IS stale. Gated
  // on the cooldown: the chains that did succeed keep committing and bumping the
  // entry, and without the gate each of those bumps would re-trigger the refresh.
  return (entry.failedChainIds || []).length > 0 && cooledDown
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
      // `hiddenByUser` records the intent so refreshes stop re-deriving this
      // token's visibility — see commitChainTokens.
      ? { ...t, isHidden: !!isHidden, hiddenByUser: !!isHidden, isManuallyShown: !isHidden }
      : t
  ))
  // Record the intent at ACCOUNT level too. The token object can be destroyed
  // (chain toggled off, balance drained to 0) and rebuilt later; this map is what
  // makes the choice survive that round-trip.
  const userHiddenKeys = { ...(entry.userHiddenKeys || {}), [metaKey]: !!isHidden }

  ReduxService.setAccountTokenList({
    ...list,
    [address]: { ...entry, tokens, userHiddenKeys }
  })

  // Refreshes skip the on-chain `symbol()` read for hidden tokens, so a token
  // being UNHIDDEN here may still be carrying the API's symbol. Resolve it now
  // rather than leaving a possibly-wrong ticker on screen until the next refresh.
  // Fire-and-forget: the toggle itself is synchronous and has already committed,
  // and resolveOnchainSymbols never throws. A cached symbol costs no RPC.
  if (!isHidden) {
    const token = tokens.find((t) => t.metaKey === metaKey)
    if (token && !token.isNative) resolveUnhiddenTokenSymbol(address, token)
  }
}

// Read one unhidden token's on-chain symbol and patch it into the entry. Re-reads
// the list at write time instead of closing over the array above, so a refresh
// that commits while the RPC is in flight isn't clobbered. Only the symbol field
// is touched, and only if the token is still there and still visible.
const resolveUnhiddenTokenSymbol = async (address, token) => {
  const [resolved] = await resolveOnchainSymbols(Number(token.chainId), [token])
  if (!resolved?.symbolOnchain) return

  const list = ReduxService.getAccountTokenList()
  const entry = list[address]
  if (!entry?.tokens) return
  const idx = entry.tokens.findIndex((t) => t.metaKey === token.metaKey && !t.isHidden)
  if (idx === -1) return

  // Only `symbol` is stored — `symbolOnchain` is a transient input field and
  // never persisted (see commitChainTokens).
  const tokens = [...entry.tokens]
  tokens[idx] = { ...tokens[idx], symbol: resolved.symbol }
  ReduxService.setAccountTokenList({ ...list, [address]: { ...entry, tokens } })
}
