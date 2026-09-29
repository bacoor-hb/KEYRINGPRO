import BigNumber from 'bignumber.js'
import { useQuery } from 'react-query'
import Config from 'react-native-config'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { setX402Fees } from 'frontend/Components/ChatAgent/InitSuggestions/suggestionTree'

// The paid backend publishes its own price list in its OpenAPI document: every
// paid route carries an `x-payment-info.price` block. Reading it here is what
// keeps the pill labels honest — a price change on the server shows up in the app
// without a release, and there is no second copy of the number to drift.
const OPENAPI_PATH = '/openapi.json'

// "0.05" → "0.05", "3" → "3", "3.00" → "3". Trailing zeros are dropped so a
// whole-dollar fee reads as "3 USDC" rather than "3.00 USDC", but a genuine
// sub-cent price keeps its digits.
//
// A zero (or non-positive) amount returns null, i.e. NO fee entry — a $0 route
// is free, and "free" must look identical to "unpriced" everywhere: no pill
// suffix, and the gate skips so nothing is charged (see the gate switch in
// WalletActionForm and useX402FeeFor's "unpriced ⇒ free" contract). Dropping it
// here is the single place that keeps all three in agreement.
const trimAmount = (raw) => {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return String(n)
}

// The settlement token a route is charged in, from `x-payment-info.x-asset`.
//
// This is the ONLY machine-readable statement of which token actually leaves the
// wallet. The document's prose (`x-guidance`, each route's description) says
// "USDC on Base", but prose is not something to size an amount against — and it
// is already out of step with the spec, which currently names Base SEPOLIA
// (eip155:84532). Parsing the field means the app follows the server rather than
// a sentence someone forgot to update.
//
// `network` is CAIP-2 ("eip155:8453"); only the eip155 namespace is understood,
// since every chain this app transacts on is EVM. Anything else — a missing
// block, a malformed chain id, a non-EVM namespace — returns null, which the
// callers read as "we don't know what this is charged in" and therefore never
// deduct. Guessing here would silently shrink a user's Max on the wrong token.
const parseAsset = (asset) => {
  const [namespace, rawChain] = String(asset?.network || '').split(':')
  if (namespace !== 'eip155') return null

  const chainId = Number(rawChain)
  if (!Number.isFinite(chainId) || chainId <= 0) return null

  const address = asset?.address
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(address || ''))) return null

  // `decimals` scales the raw amount, so an absent or nonsensical one makes the
  // whole entry unusable rather than something to default.
  const decimals = Number(asset?.decimals)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null

  // The fee in the token's SMALLEST unit — the figure to subtract from a raw
  // balance without any decimal maths. Whole units only; a fractional one is not
  // a real amount.
  const amountRaw = BigNumber(String(asset?.amount ?? ''))
  if (!amountRaw.isFinite() || amountRaw.lte(0) || !amountRaw.isInteger()) return null

  return { chainId, address, decimals, amountRaw: amountRaw.toFixed() }
}

/**
 * Flatten the OpenAPI document into `{ [operationId]: label }`.
 *
 * Keyed by operationId rather than by path because that is the stable identifier
 * — the server can move `/api/send-nft` without the app's tree noticing, as long
 * as the operation keeps its id. Only fixed-price routes produce a label; a route
 * priced dynamically (`mode` other than `fixed`) has no number to show up front,
 * so it is skipped and its pill falls back to no fee text at all rather than
 * advertising a price that may not be what gets charged.
 */
const parseFees = (doc) => {
  const fees = {}
  const paths = doc?.paths || {}

  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods || {})) {
      const price = op?.['x-payment-info']?.price
      if (!price || price.mode !== 'fixed') continue

      const amount = trimAmount(price.amount)
      if (amount == null) continue

      const id = op?.operationId
      if (!id) continue

      fees[id] = {
        amount,
        currency: price.currency || 'USD',
        path,
        method: String(method).toUpperCase(),
        // What the charge is settled IN, when the spec says so — the token, its
        // chain, and the price already in smallest units. Null when the route
        // does not publish it (or publishes something unreadable), and every
        // caller treats that as "unknown", never as "not the same token".
        asset: parseAsset(op?.['x-payment-info']?.['x-asset'])
      }
    }
  }

  return fees
}

const getData = async () => {
  const base = Config.X402_SERVER_API
  if (!base) return {}

  const res = await fetch(`${base}${OPENAPI_PATH}`, {
    headers: { Accept: 'application/json' }
  })
  if (!res.ok) throw new Error(`${OPENAPI_PATH} failed (${res.status})`)

  return parseFees(await res.json())
}

/**
 * The x402 price list, refetched every time the hook mounts (i.e. each time a
 * page that uses it is entered), and shared by every caller.
 *
 * react-query dedupes on the key, so mounting this hook in several places at once
 * still costs one request; `refetchOnMount: 'always'` then re-runs it on the next
 * fresh mount so a price change on the server shows up on re-entry without a
 * release. `staleTime: 0` marks the data stale immediately so that mount refetch
 * actually fires. `cacheTime` is kept so the previous list is served instantly
 * while the refetch runs in the background — the pills don't flash empty. The
 * authoritative amount is re-quoted in the 402 challenge at pay time anyway (see
 * X402SignModal), so this copy only has to be right enough to set expectations
 * BEFORE the user commits.
 *
 * The fees are also pushed into the suggestion tree's module cache, because the
 * pill labels are rendered from deep inside a memoized list (MessageBubble) where
 * threading a prop down would mean re-rendering the whole thread. That push
 * notifies the mounted InitSuggestions, so pills already on screen pick up the
 * prices. Mounting this hook once — AISearch does — labels every level of the tree.
 *
 * A failure resolves to an empty map: the pills then render without a fee suffix
 * rather than blocking, and the approval sheet still shows the real price.
 *
 * @returns {{ fees: object, isLoading: boolean }}
 */
export default function useX402Fees () {
  const { data, isLoading } = useQuery(
    [REACT_QUERY_KEY.getX402Fees],
    getData,
    {
      staleTime: 0,
      cacheTime: Infinity,
      retry: 1,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      onSuccess: (fees) => setX402Fees(fees)
    }
  )

  return { fees: data || {}, isLoading }
}

/**
 * The fee entry for one endpoint, looked up the way the FORMS hold it.
 *
 * The map is keyed by operationId (the stable id — see parseFees), but a wallet
 * action carries its endpoint as `X402_PATH.sendToken` — a `{ path, method }`
 * pair, or a bare path string. Matching on both halves keeps two operations that
 * share a path under different verbs apart.
 *
 * THIS IS THE SWITCH FOR THE WHOLE PAID FLOW, not just the label: a route the
 * price list quotes runs the x402 gate and is charged; a route it does not quote
 * — including every route when the list is unreachable — sends free, with no
 * gate at all. So a `fee` of null must mean "resolved, and there is no charge",
 * never "we don't know yet", which is why `isLoading` is returned alongside it:
 * callers hold the action while the list is in flight rather than treating an
 * unresolved list as free. The authoritative amount is still re-quoted in the
 * 402 challenge at pay time (X402SignModal).
 *
 * @param {string|{path: string, method?: string}} [endpoint]
 * @returns {{ fee: object|null, isLoading: boolean }} `fee` is the entry
 *   (`{ amount, currency, path, method }`) or null when unpriced. Print it with
 *   `formatFeeLabel(fee, language)` — the entry holds no pre-rendered label.
 */
export function useX402FeeFor (endpoint) {
  const { fees, isLoading } = useX402Fees()

  const { path, method } = typeof endpoint === 'string'
    ? { path: endpoint, method: 'GET' }
    : { path: endpoint?.path, method: String(endpoint?.method || 'GET').toUpperCase() }

  // No endpoint at all — nothing to price, and nothing to wait for.
  if (!path) return { fee: null, isLoading: false }

  const fee = Object.values(fees).find((f) => f.path === path && f.method === method) || null
  return { fee, isLoading }
}
