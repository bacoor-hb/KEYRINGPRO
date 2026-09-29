import BaseAPI from 'controller/API/BaseAPI'
import ReduxService from 'common/redux'
import { REDUX_KEY } from 'common/constants/redux'
import { SWAP_SERVICE_CONFIG } from 'common/constants/app'
import { PLATFORM_EXCHANGE } from 'common/constants/swap'

// The PROTOCOL's own explorer for a swap — deBridge's order page, Relay's
// transaction page — as opposed to the chain explorer the hash itself links to.
//
// A router swap is not finished when its transaction is mined: the chain
// explorer shows the tx that was sent to the router, while what the user asked
// for (the fill, the amounts actually exchanged, a refund if the route failed)
// is only visible in the protocol's own view. The Exchange screen has always
// linked both; this is the same pair of links for the in-chat swap flow, built
// from the same `SWAP_SERVICE_CONFIG` and the same i18n keys so the two stay
// worded and routed identically.

// `keyring-agent-core` names its providers 'relay' / 'debridge'; the app's
// `PLATFORM_EXCHANGE` spells the latter 'deBridge'. Every lookup here goes
// through the app's spelling, so a quote's provider is normalized on the way in
// rather than at each call site.
export const toPlatformExchange = (provider) => {
  const name = String(provider || '').toLowerCase()
  if (name === String(PLATFORM_EXCHANGE.deBridge).toLowerCase()) return PLATFORM_EXCHANGE.deBridge
  if (name === String(PLATFORM_EXCHANGE.relay).toLowerCase()) return PLATFORM_EXCHANGE.relay
  return null
}

/**
 * The protocol explorer URL for a settled swap, or null when it cannot be built.
 *
 * Mirrors `handleExplorer(TYPE_VIEW_EXPLORER.relayLink)` in the Exchange screen,
 * for the same-chain case this flow always runs:
 *   - Relay keys its page on the TX HASH, so the URL exists the moment the swap
 *     is broadcast — but the PAGE is only populated once Relay has indexed that
 *     hash, which is what `indexRelayTransaction` is for.
 *   - deBridge keys its page on the ORDER ID, which is not part of the quote —
 *     see `resolveDeBridgeRequestId`. Without one there is no page to open, so
 *     the caller must not render a link.
 */
export const getProtocolExplorerUrl = ({ provider, hash, requestId, chainId }) => {
  const platform = toPlatformExchange(provider)
  const baseUrl = platform && SWAP_SERVICE_CONFIG.providers[platform]?.linkExplorer
  if (!baseUrl || !hash) return null

  switch (platform) {
    case PLATFORM_EXCHANGE.relay:
      return `${baseUrl}/transaction/${hash}`
    case PLATFORM_EXCHANGE.deBridge:
      if (!requestId) return null
      return `${baseUrl}/same-chain-order?orderId=${requestId}&txHash=${hash}&chainId=${chainId}`
    default:
      return null
  }
}

/** The i18n key (under `v2.exchange`) naming the given provider's explorer. */
export const getProtocolExplorerLabelKey = (provider) => {
  switch (toPlatformExchange(provider)) {
    case PLATFORM_EXCHANGE.relay:
      return 'viewRelayExplorer'
    case PLATFORM_EXCHANGE.deBridge:
      return 'viewDeBridgeExplorer'
    default:
      return null
  }
}

// deBridge exposes a synthetic chainId for some networks (Story is 100000013 to
// deBridge, 1514 everywhere else). The tracking endpoint is addressed in THEIR
// numbering, so a real chainId is translated on the way out. Same mapping the
// Exchange path uses (`DebridgeAdapter.convertChainIdByDeBridge`), read from the
// same Redux setting; an unmapped chain passes through unchanged.
const toDeBridgeChainId = (chainId) => {
  const chainSupport = ReduxService.getReduxDataByKey(REDUX_KEY.settingExchangeRedux)?.chainSupport
  const chain = chainSupport?.find((c) => c.chainId?.toString() === chainId?.toString())
  return chain?.[`chainId_${PLATFORM_EXCHANGE.deBridge}`] ?? chainId
}

/**
 * The deBridge order id (`swapId`) for a broadcast same-chain swap.
 *
 * Unlike Relay's, deBridge's explorer page is keyed on an order id that the
 * QUOTE never carries — it only comes into existence once the swap is on-chain
 * and deBridge has indexed it, which is why the Exchange screen picks it up from
 * its post-broadcast poll rather than from the quote.
 *
 * This is that lookup, reduced to the one field the link needs: a couple of short
 * attempts rather than the Exchange path's full 60s status poll, because nothing
 * here BLOCKS on the answer — the swap is already settled and the only thing
 * waiting is a link. Indexing usually lands within a second or two of the
 * receipt; when it does not, the timeline simply shows the chain explorer alone,
 * which is exactly what it showed before.
 *
 * Never throws: a failed lookup is a missing link, not a failed swap.
 */
export const resolveDeBridgeRequestId = async ({ hash, chainId, attempts = 3, intervalMs = 2000 }) => {
  if (!hash || !chainId) return null

  const config = SWAP_SERVICE_CONFIG.providers[PLATFORM_EXCHANGE.deBridge]
  const baseUrl = config?.apiTrackingBaseUrl
  const accessToken = config?.accessToken
  if (!baseUrl) return null

  const url = `${baseUrl}/api/SameChainSwap/${toDeBridgeChainId(chainId)}/tx/${hash}?accesstoken=${accessToken}`

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await BaseAPI.getDataDebridge(url, null, true)
      const data = Array.isArray(res) ? res[0] : res
      // deBridge wraps its values as DTOs ({ stringValue, ... }); the swapId
      // comes back either wrapped or bare depending on the endpoint version.
      const swapId = data?.swapId
      const value = typeof swapId === 'object' && swapId !== null
        ? swapId.stringValue ?? swapId.numberValue ?? swapId.bigIntegerValue ?? null
        : swapId
      if (value) return String(value)
    } catch (e) {
      // Tracking is best-effort — fall through to the next attempt.
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }

  return null
}

// Relay filters everything it indexes on this key — the same value
// `RelayAdapter` sends from the Exchange path, so a swap made in chat lands in
// the same place as one made on the Exchange screen.
const RELAY_REFERRER_KEY = 'bacoor.io'

/**
 * Register a broadcast Relay swap with Relay's own indexer.
 *
 * Relay's explorer page is NOT a chain explorer: `/transaction/<hash>` resolves
 * against Relay's indexed requests, not against the chain. A tx Relay never
 * indexed therefore opens a page that loads and stays empty — which is what a
 * chat swap did, because only the Exchange path (`RelayAdapter.getInfoDetailTx`
 * → `indexingTransactions`) ever told Relay about its transaction.
 *
 * This is that same pair of calls, for the in-chat flow:
 *   - `/transactions/index` — index the hash on its chain.
 *   - `/transactions/single` — tie the hash to the quote's `requestId` and
 *     attribute it to the referrer.
 *
 * Both are sent together and neither is required to succeed: indexing is what
 * gives the LINK content, and a swap that is already mined is not made any less
 * settled by a tracking call that failed. Never throws, mirroring
 * `resolveDeBridgeRequestId` — the caller fires it without awaiting.
 */
export const indexRelayTransaction = async ({ requestId, chainId, hash, rawTransaction }) => {
  if (!hash || !chainId) return false

  const baseUrl = SWAP_SERVICE_CONFIG.providers[PLATFORM_EXCHANGE.relay]?.apiBaseUrl
  if (!baseUrl) return false

  const post = async (endpoint, body) => {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  }

  const calls = [post('/transactions/index', { chainId: `${chainId}`, txHash: hash })]

  // `/transactions/single` is keyed on the quote's requestId; without one there
  // is nothing to tie the hash to, so only the plain index call goes out.
  if (requestId) {
    calls.push(post('/transactions/single', {
      requestId,
      chainId: `${chainId}`,
      referrer: RELAY_REFERRER_KEY,
      tx: JSON.stringify({ ...(rawTransaction || {}), txHash: hash })
    }))
  }

  const results = await Promise.allSettled(calls)
  return results.some((r) => r.status === 'fulfilled')
}
