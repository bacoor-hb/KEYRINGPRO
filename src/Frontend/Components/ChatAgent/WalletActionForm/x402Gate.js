import {
  buildChallenge,
  encodeSignedHeader,
  displayFromChallenge,
  isPaymentRequired,
  readPaymentError
} from 'keyring-agent-core'
import Config from 'react-native-config'

// One endpoint per wallet action — each is priced and authorized separately by
// the backend. A form without an entry here skips the gate entirely.
//
// An entry is either a bare path (defaults to GET) or `{ path, method }`:
//
//   sendToken: '/api/send-token'                              → GET  ?a=1&b=2
//   sendToken: { path: '/api/send-token', method: 'POST' }    → POST {"a":1,"b":2}
//
// GET carries the action's fields on the query string; POST sends them as a JSON
// body instead (the URL then has no params). Both forms are replayed BYTE FOR
// BYTE after payment — same method, same URL, same body — because the server
// authorized that exact request and matches the payment against it.
export const X402_PATH = {
  sendToken: { path: '/api/send-token', method: 'GET' },
  sendNative: { path: '/api/send-native', method: 'GET' },
  sendNft: { path: '/api/send-nft', method: 'GET' },
  addPool: { path: '/api/add-pool', method: 'GET' },
  // The whole supply sequence — approve + deposit — is ONE authorization and one
  // charge, because it is one action to the user (see SupplyFormShell).
  supplyUsdc: { path: '/api/supply-usdc', method: 'GET' }
}

// Accept both entry shapes so existing string entries keep working.
const normalizeEndpoint = (endpoint) => {
  const { path, method } = typeof endpoint === 'string' ? { path: endpoint } : (endpoint || {})
  return { path, method: String(method || 'GET').toUpperCase() }
}

// Normalize a fetch Response into the shape `buildChallenge` reads: lowercased
// headers + a parsed body. The core's own ApiClient is deliberately NOT used
// here — AgentCore installs a GLOBAL 402 interceptor on the shared instance
// (the chat's inline signer), which would swallow the challenge and sign it
// behind our back. This flow owns its own modal, so it makes the call itself.
const toApiResponse = async (res) => {
  const headers = {}
  res.headers?.forEach?.((value, key) => { headers[String(key).toLowerCase()] = String(value) })

  const text = await res.text()
  let data = text
  try {
    data = JSON.parse(text)
  } catch (e) {
    // Not JSON — keep the raw text. The paid call answers with JSON, but the
    // error paths (and any proxy in between) may still hand back plain text.
  }

  return { ok: res.ok, status: res.status, statusText: res.statusText, data, headers, text }
}

// One request, GET or POST. `body` is already-serialized JSON (or null for GET)
// and is passed through UNCHANGED on the paid replay, so both attempts send
// identical bytes — the server matches the payment against the exact request it
// priced, and a re-serialized body could differ in key order.
const request = (url, { method, body, headers }) =>
  fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {})
    },
    ...(body != null ? { body } : {})
  }).then(toApiResponse)

// Append the action's fields as query params, skipping the empty ones so the URL
// only carries what the form actually resolved.
const withQuery = (url, params) => {
  const qs = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  if (!qs) return url
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`
}

// The go-ahead is the HTTP status alone: any 2xx authorizes the action. The body
// is not inspected — servers phrase success differently ({"status":"ok"}, a
// receipt object, an empty 204) and none of that should block the broadcast.
const isOk = (res) => res.status >= 200 && res.status < 300

const errorOf = (res, url) => {
  const d = res.data
  if (typeof d === 'string' && d.trim()) return d.trim()
  return d?.error || d?.message || `${url} failed (${res.status})`
}

/**
 * Ask the backend for permission to run this wallet action, paying for the call
 * with x402 when it asks to be paid.
 *
 *   call → 2xx             → resolve null (go ahead and broadcast)
 *   call → 402 + challenge → sign it in the modal → replay the SAME request with
 *                            the payment header → 2xx → null
 *
 * Works against both x402 protocol versions: the core detects whether the server
 * speaks v1 (challenge in the JSON body, paid with `X-PAYMENT`) or v2 (challenge
 * in the `PAYMENT-REQUIRED` header, paid with `PAYMENT-SIGNATURE`) and
 * `encodeSignedHeader` returns whichever header that server expects.
 *
 * Anything else (declined payment, non-2xx status, network error) resolves to an
 * error string, which the caller turns into an aborted send. Runs AFTER the
 * form's own preCheck and the gas/fee pre-flight, so the API is only ever paid
 * for a transaction that could actually execute.
 *
 * @param {string|object} path       This action's endpoint, e.g. `X402_PATH.sendToken`
 *                                   — a path string (GET) or `{ path, method }`
 * @param {object}   query           Action fields: query params on GET, JSON body on POST
 * @param {string}   walletAddress   Payer of the x402 charge (also the signer)
 * @param {Function} requestSignature  ({ typedData, display, verify }) =>
 *                                   Promise<signature|null|{ error }> — the
 *                                   signature when approved, null when cancelled,
 *                                   or `{ error }` when `verify` failed.
 * @param {Function} [verify]        Optional last-moment re-check of the underlying
 *                                   transaction. NOT called here — it is handed to
 *                                   the approval sheet, which runs it on the Pay
 *                                   tap, the last point before the payment is
 *                                   signed. Resolves to an error string to abort
 *                                   (nothing signed, nothing paid) or null to go
 *                                   ahead. The caller's earlier pre-flight is not
 *                                   enough on its own — it runs before the sheet
 *                                   opens, and the user's time in the sheet is
 *                                   unbounded.
 * @param {Function} [onPaid]        Called the moment a payment has been SETTLED,
 *                                   before this function returns and regardless of
 *                                   whether the paid replay then succeeded. That
 *                                   ordering is the point: settling is what costs
 *                                   the user money, and it happens strictly before
 *                                   the backend's answer, so a caller that wants to
 *                                   spare a retry a second charge has to learn about
 *                                   it here rather than from the return value. NOT
 *                                   called when the route was free, when the user
 *                                   cancelled, or when `verify` aborted — in all of
 *                                   those nothing was signed and nothing was paid.
 *
 *                                   Receives `{ chainId, assetAddress }` — the token
 *                                   the fee was actually settled in, which is NOT
 *                                   necessarily the action's own token or even its
 *                                   chain (a supply on Optimism can be paid for in
 *                                   USDC on Base). A caller refreshing balances after
 *                                   the action has no other way to know which token
 *                                   moved to cover the fee, so that balance would
 *                                   silently go stale.
 * @param {Function} [onKey]         Receives the private key the signer resolved for
 *                                   the payment, so the caller's send can sign the
 *                                   transaction with it instead of reading the key a
 *                                   second time — which for a COLD (keycard) account
 *                                   means a second card scan for what the user did as
 *                                   one action. Forwarded to the signer untouched; the
 *                                   key never lands in this module. Not called on a
 *                                   free route or a cancelled payment, since no key
 *                                   was read.
 */
export async function runX402Gate ({ path, query, walletAddress, requestSignature, verify, onPaid, onKey }) {
  const { path: endpointPath, method } = normalizeEndpoint(path)
  const isPost = method !== 'GET'
  const params = query || {}

  // Host of the paid backend that must authorize a wallet action before we
  // broadcast it. Each form supplies its own path (see X402_PATH below).
  const API_BASE = Config.X402_SERVER_API

  // GET puts the fields on the URL; POST puts them in a JSON body and leaves the
  // URL bare. Built ONCE and reused verbatim for the paid replay.
  const url = isPost ? `${API_BASE}${endpointPath}` : withQuery(`${API_BASE}${endpointPath}`, params)
  const body = isPost
    ? JSON.stringify(Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    ))
    : null

  const res = await request(url, { method, body })

  // Free / already authorized — nothing to pay for.
  if (res.status !== 402) return isOk(res) ? null : errorOf(res, url)

  // A 402 the core does not recognize as an x402 challenge (a quota error, a
  // proxy's own 402) is an ordinary failure, not something to open a sheet for.
  if (!isPaymentRequired(res)) return errorOf(res, url)

  // The challenge must describe the request the server actually priced —
  // including method and body — or the replay won't match what it authorized.
  const challenge = buildChallenge(res, { url, method, ...(body != null ? { body } : {}) }, walletAddress)

  // The facilitator rejects a payment whose recipient is the payer
  // ("self_send_not_allowed"), so a challenge whose `payTo` is this wallet can
  // never be settled. Catch it BEFORE the approval sheet: the user would
  // otherwise sign a payment that is guaranteed to fail. This means the server
  // is handing back the caller's own address as the recipient (typically by
  // echoing the request's `from`) instead of its treasury address.
  if (String(challenge.requirements?.payTo || '').toLowerCase() === String(walletAddress).toLowerCase()) {
    if (__DEV__) console.log('[x402] payTo === payer — server is not sending a treasury address', challenge.requirements)
    return 'Payment cannot be processed: the server asked this wallet to pay itself.'
  }

  // `displayFromChallenge` reads the payment token's symbol()/decimals() on-chain
  // (one multicall) to format the amount, so it MUST be awaited — handing the
  // modal the bare promise renders the payment sheet with no price at all.
  const display = await displayFromChallenge(challenge)

  // `verify` is handed to the SHEET rather than called here, because here is too
  // early: the sheet then sits open for as long as the user takes to read it,
  // and that wait — unbounded, and the longest part of the whole flow — would go
  // unchecked. The sheet runs it on the Pay tap instead, so the transaction is
  // re-estimated at the moment the payment is actually approved. See `approve`
  // in X402SignModal.
  const approval = await requestSignature({
    typedData: challenge.typedData,
    display,
    verify,
    // Passed straight through to the signer so the key it reads for THIS payment
    // can be reused to sign the transaction being authorized — one card scan for
    // one user action. See `lendKey` in useSendTx.
    onKey
  })

  // The sheet answers with either a bare signature string (approved) or, when
  // its own last-moment re-check failed, `{ error }` — the two must not collapse
  // into one "declined", or a transaction that went stale would be reported as
  // the user changing their mind. Nothing is signed or broadcast either way.
  if (approval && typeof approval === 'object' && approval.error) return approval.error
  const signature = typeof approval === 'string' ? approval : null
  // Cancelled the payment sheet — stop before anything is signed or broadcast.
  if (!signature) return 'Payment declined'

  // Same method, same URL, same body — only the payment header is added.
  const header = encodeSignedHeader(challenge, signature)
  const paid = await request(url, { method, body, headers: header })

  // Anything that is NOT a fresh 402 means the facilitator settled the payment:
  // the money has moved, whatever the backend then answered. A second 402 is the
  // one case where it did not — the facilitator refused it (see below) — so it
  // is excluded, since telling the caller "paid" there would let a retry skip a
  // charge that never happened.
  //
  // Announced BEFORE the success check on purpose: a settled payment followed by
  // a 500 is exactly the case this exists for — the user is out the fee and the
  // action still failed, so the retry must not charge them twice.
  // The fee token comes from the challenge the facilitator just settled against,
  // so it describes what actually left the wallet — `chainId` is already resolved
  // from either protocol version's `network` format by the core.
  if (paid.status !== 402) onPaid?.({ chainId: challenge.chainId, assetAddress: challenge.requirements?.asset })

  if (isOk(paid)) return null

  // A second 402 means the facilitator refused the payment rather than "you
  // still owe". The reason is never in the visible body — it rides in the
  // settlement receipt or the re-issued challenge, in a different place per
  // protocol version — so the core decodes it for us.
  const reason = readPaymentError(paid)
  if (__DEV__) {
    console.log('[x402] paid replay failed', {
      url,
      method,
      requestBody: body,
      status: paid.status,
      reason,
      body: paid.data,
      authorization: challenge.authorization,
      requirements: challenge.requirements,
      domain: challenge.typedData?.domain,
      signature
    })
  }
  return reason ? `x402 payment rejected: ${reason}` : errorOf(paid, url)
}
