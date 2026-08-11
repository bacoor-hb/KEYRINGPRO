// On-chain symbol resolution for token entries.
//
// ONE field, `symbolOnchain`, carries the contract's own ticker. It is filled
// from whichever source can answer, in this order:
//
//   1. The API already returned it → use it, no RPC at all. This is the path
//      that takes over entirely once the field ships server-side.
//   2. Otherwise → read `symbol()` from the contract: via Multicall3 where it's
//      deployed (viem batches the calls), throttled per-chain where it isn't.
//   3. Read failed / token has no `symbol()` → `symbolOnchain` stays undefined
//      and the caller falls back to its existing symbol. This is not an error;
//      plenty of real tokens (bytes32-symbol ones, proxies mid-upgrade) simply
//      can't answer.
//
// Because the answer always lands on the same field regardless of source, a
// consumer reads `symbolOnchain` alone and never needs to know which of the
// three produced it.
//
// A resolved entry gets the ticker written onto `symbol`, so every screen can
// render `token.symbol` directly without knowing this module exists. The balance
// pipeline then DROPS `symbolOnchain` before committing to Redux — it is an
// input field, not stored state, and `symbol` already carries the answer.
//
// Pass `{ keepSymbol: true }` to write only `symbolOnchain` — used by the
// raw-API-row callers (liquidity pools) that must leave the API's own fields
// intact and pick at the render site instead:
//
//   symbolOnchain || auditGoplus?.token_symbol || symbol

import pLimit from 'p-limit'
import { erc20Abi, isAddress } from 'viem'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { MULTICALL3_CHAIN_IDS } from 'common/constants/chain'
import { lowerCase } from 'common/function'
import { isNativeToken } from 'common/tokens'

// Chains without Multicall3 fall back to one eth_call per token. That is the
// path most at risk of a 429, so it is metered.
const CONCURRENT_READS_PER_CHAIN = 10

// Cap the work a single resolve can schedule. A wallet holding hundreds of
// airdropped tokens on a chain with no Multicall3 would otherwise turn one
// refresh into hundreds of metered eth_calls. Tokens beyond the cap keep
// `symbolOnchain` undefined — the same outcome as a failed read, which every
// consumer already handles.
const MAX_TOKENS_PER_RESOLVE = 400

// Per-chain limiter for the sequential (no Multicall3) path, created on first
// use for a chainId and reused after that.
const readLimiters = new Map()

const getLimiter = (chainId) => {
  const key = Number(chainId)
  if (!readLimiters.has(key)) readLimiters.set(key, pLimit(CONCURRENT_READS_PER_CHAIN))
  return readLimiters.get(key)
}

// Resolved symbols, keyed `chainId:address`. A token's on-chain symbol is
// immutable in practice, so a hit here skips the RPC entirely on every later
// refresh — which is what keeps this from adding a round-trip per refresh cycle
// for a wallet whose token set barely changes.
//
// Only SUCCESSFUL reads are stored. A failure is deliberately not cached: it is
// usually a transport error (RPC down, rate limited) rather than a property of
// the token, and caching it would freeze the fallback symbol in place for the
// rest of the session.
const symbolCache = new Map()

const cacheKey = (chainId, contractAddress) => `${Number(chainId)}:${lowerCase(contractAddress)}`

// viem decodes a `symbol()` return into a string. Anything else (a bytes32
// symbol decoded as hex, a reverted call surfacing as undefined) is rejected
// here rather than being written onto the entry — showing raw hex where a
// ticker belongs is worse than showing the listing's symbol.
const isUsableSymbol = (value) => typeof value === 'string' && value.trim().length > 0

// Symbol trace. Shows, per token, WHICH source supplied `symbolOnchain` — the
// API's own field, the session cache, or a fresh `symbol()` read — and flags the
// tokens where the contract DISAGREES with the listing symbol, which is the whole
// reason this module exists. Set to false to silence it.
//
// transform-remove-console strips console calls from release builds regardless,
// but gating on __DEV__ also skips building the strings.
const DEBUG_SYMBOL = false
const logSymbol = (...args) => { if (DEBUG_SYMBOL) console.log('[symbol]', ...args) }

// One line per token, only when the contract's answer differs from what the UI
// would otherwise have shown — those are the cases worth reading in a log.
const logResolved = (source, chainId, address, previous, next) => {
  if (!DEBUG_SYMBOL) return
  const differs = next !== previous
  logSymbol(
    `${source.padEnd(7)} chain ${chainId} ${address}: "${previous}" -> "${next}"${differs ? '  <-- DIFFERS' : ''}`
  )
}

// A contract address worth sending `symbol()` to. Native coins have no contract
// to ask — their symbol comes from chain metadata, which is already the
// authoritative source for them.
//
// `isNativeToken` is checked alongside the flag because callers outside the
// balance pipeline (the swap/bridge token pickers) pass raw API rows that mark
// native with a SENTINEL ADDRESS — zeroAddress, 'native', or the 0xeee… form —
// and carry no `isNative`. Trusting the flag alone would send `symbol()` to the
// zero address for every one of them.
const isReadableToken = (token, chainId) => {
  const address = token?.contractAddress
  if (!address || !isAddress(address)) return false
  if (token.isNative || isNativeToken(address, chainId)) return false
  return true
}

// Both read paths return a Map keyed by LOWERCASED address. Callers hand us
// addresses in whatever casing their source used — the Keyring list lowercases
// (transformMulticallEntry), Moralis rows and the token-list API return
// checksummed ones — and the same contract can therefore appear in two casings
// within one call. Keying on the lowercase form is what lets the lookup that
// applies the results find them regardless.
const symbolMapKey = (address) => lowerCase(address)

// Multicall3 path. The calls go to viem in ONE array and viem does the
// splitting: it chunks them by calldata bytes (its `batchSize`, 1024 by
// default) and fires the chunks itself. `symbol()` calldata is tiny and
// uniform, so that default already produces sensibly sized requests — no
// manual chunking here.
const readSymbolsViaMulticall = async (chainId, addresses) => {
  const out = new Map()

  let res
  try {
    res = await ViemWeb3.readMulticall(
      chainId,
      addresses.map((address) => ({ address, abi: erc20Abi, functionName: 'symbol' }))
    )
  } catch {
    // The whole read failed — every token keeps its existing symbol.
    return out
  }

  addresses.forEach((address, index) => {
    // ViemWeb3.readMulticall passes allowFailure: true, so a token without
    // `symbol()` comes back as a failed entry instead of throwing the batch away.
    const entry = res?.[index]
    if (entry?.status === 'success' && isUsableSymbol(entry.result)) {
      out.set(symbolMapKey(address), entry.result.trim())
    }
  })

  return out
}

// No Multicall3 on this chain — one throttled `symbol()` read per token.
const readSymbolsViaSequentialRpc = async (chainId, addresses) => {
  const out = new Map()
  const readLimit = getLimiter(chainId)

  await Promise.all(
    addresses.map((address) =>
      readLimit(async () => {
        try {
          const symbol = await ViemWeb3.readContract(chainId, {
            address,
            abi: erc20Abi,
            functionName: 'symbol'
          })
          if (isUsableSymbol(symbol)) out.set(symbolMapKey(address), symbol.trim())
        } catch {
          // Leaves symbolOnchain unset — see the module header.
        }
      })
    )
  )

  return out
}

// Read `symbol()` for a deduped address list and write every success into the
// session cache. Shared by both public entry points so the cap, the transport
// choice and the caching rule live in one place.
const readAndCacheSymbols = async (chainId, addresses) => {
  const capped = addresses.slice(0, MAX_TOKENS_PER_RESOLVE)
  if (capped.length === 0) return new Map()

  const symbols = MULTICALL3_CHAIN_IDS.has(chainId)
    ? await readSymbolsViaMulticall(chainId, capped)
    : await readSymbolsViaSequentialRpc(chainId, capped)

  symbols.forEach((symbol, address) => {
    symbolCache.set(cacheKey(chainId, address), symbol)
  })

  return symbols
}

// Fill in `symbolOnchain` for one chain's token entries and return a NEW array.
// Entries that already carry it (API-provided) are returned untouched; the rest
// get it from the session cache or a fresh `symbol()` read. A token that can't
// be resolved is returned exactly as it arrived, with `symbolOnchain` still
// unset — callers fall back to their own symbol for those.
//
// `shouldSkip(token)` opts a token out of the on-chain READ only. The API's
// `symbolOnchain` and the session cache still apply, since both are free. Used
// to skip hidden tokens, whose symbol is never rendered, so a wallet full of
// hidden spam doesn't pay an eth_call per token on every refresh. Skipped
// tokens are re-read for free the moment they become visible again.
//
// `keepSymbol: true` writes only `symbolOnchain` — see the module header. A
// token that can't be resolved comes back byte-for-byte as it arrived either way.
//
// Never throws: this is a display refinement layered on top of a token list
// that is already complete and correct. A failure here must not cost the user
// their balances, so every error path degrades to the existing symbol.
export const resolveOnchainSymbols = async (chainId, tokens, { shouldSkip, keepSymbol = false } = {}) => {
  if (!Array.isArray(tokens) || tokens.length === 0) return tokens
  // Callers that group by chain hand this over as a STRING (Object.entries keys
  // — see useFetchMulticallDetailToken). Normalized once here so every downstream
  // use (cache key, limiter, chain lookup, RPC) sees the same numeric id.
  chainId = Number(chainId)

  // The single place a resolved ticker is written onto an entry.
  const applyTo = (token, symbolOnchain) => (
    keepSymbol
      ? { ...token, symbolOnchain }
      : { ...token, symbol: symbolOnchain, symbolOnchain }
  )

  try {
    const pending = []
    const seen = new Set()

    // Pass 1 — resolve everything that costs nothing, and collect the addresses
    // that still need a read.
    const resolved = tokens.map((token) => {
      if (!token) return token

      // 1. The API answered.
      if (isUsableSymbol(token.symbolOnchain)) {
        const trimmed = token.symbolOnchain.trim()
        logResolved('api', chainId, token.contractAddress, token.symbol, trimmed)
        return applyTo(token, trimmed)
      }

      if (!isReadableToken(token, chainId)) return token

      // 2. Already read earlier this session.
      const cached = symbolCache.get(cacheKey(chainId, token.contractAddress))
      if (cached) {
        logResolved('cache', chainId, token.contractAddress, token.symbol, cached)
        return applyTo(token, cached)
      }

      // 3. Needs an on-chain read — unless the caller opted this token out.
      //    Checked AFTER the two free sources above so a skipped token still
      //    gets the API's symbol and any cached read.
      if (shouldSkip?.(token)) return token

      // Deduped: the same contract can appear more than once across a rebuilt list.
      const key = lowerCase(token.contractAddress)
      if (!seen.has(key)) {
        seen.add(key)
        pending.push(token.contractAddress)
      }
      return token
    })

    if (pending.length === 0) return resolved

    if (DEBUG_SYMBOL) {
      const via = MULTICALL3_CHAIN_IDS.has(chainId) ? 'multicall' : 'sequential rpc'
      const capped = pending.length > MAX_TOKENS_PER_RESOLVE
      logSymbol(
        `chain ${chainId}: reading symbol() for ${Math.min(pending.length, MAX_TOKENS_PER_RESOLVE)} token(s) via ${via}` +
        (capped ? ` (capped from ${pending.length})` : '')
      )
    }

    const symbols = await readAndCacheSymbols(chainId, pending)

    if (DEBUG_SYMBOL) {
      const attempted = Math.min(pending.length, MAX_TOKENS_PER_RESOLVE)
      logSymbol(`chain ${chainId}: ${symbols.size}/${attempted} read ok, ${attempted - symbols.size} kept the existing symbol`)
    }

    if (symbols.size === 0) return resolved

    // Pass 2 — apply the fresh reads. Looked up by the entry's own address
    // rather than by position, so the cap and the dedupe above can't misalign a
    // symbol onto the wrong token.
    return resolved.map((token) => {
      if (!token?.contractAddress) return token
      const symbolOnchain = symbols.get(symbolMapKey(token.contractAddress))
      if (!symbolOnchain) return token
      logResolved('onchain', chainId, token.contractAddress, token.symbol, symbolOnchain)
      return applyTo(token, symbolOnchain)
    })
  } catch {
    // Whatever went wrong, the caller's tokens are still valid — hand them back
    // with the symbols they arrived with.
    return tokens
  }
}

// Single-token flavour, for the surfaces that hold ONE raw Keyring/API row
// rather than a built token list (approve prompts, the add-token drawer).
//
// Returns the contract's ticker, or `undefined` when no source could answer —
// so a caller applies its own fallback with `?? existingSymbol` and never has to
// compare against a value it passed in.
export const resolveOnchainSymbolFor = async (chainId, contractAddress, symbolOnchain) => {
  if (isUsableSymbol(symbolOnchain)) {
    if (DEBUG_SYMBOL) logSymbol(`api     chain ${chainId} ${contractAddress}: "${symbolOnchain.trim()}" (single)`)
    return symbolOnchain.trim()
  }
  if (!chainId || !contractAddress) return undefined
  chainId = Number(chainId) // see resolveOnchainSymbols — callers may pass a string
  if (!isReadableToken({ contractAddress }, chainId)) return undefined

  const cached = symbolCache.get(cacheKey(chainId, contractAddress))
  if (cached) {
    if (DEBUG_SYMBOL) logSymbol(`cache   chain ${chainId} ${contractAddress}: "${cached}" (single)`)
    return cached
  }

  try {
    const symbols = await readAndCacheSymbols(chainId, [contractAddress])
    const symbol = symbols.get(symbolMapKey(contractAddress))
    if (DEBUG_SYMBOL) {
      logSymbol(
        symbol
          ? `onchain chain ${chainId} ${contractAddress}: "${symbol}" (single)`
          : `onchain chain ${chainId} ${contractAddress}: read failed, caller keeps its symbol (single)`
      )
    }
    return symbol
  } catch {
    return undefined
  }
}

// Test/debug hook: drops the in-memory cache so the next resolve re-reads.
export const clearOnchainSymbolCache = () => symbolCache.clear()
