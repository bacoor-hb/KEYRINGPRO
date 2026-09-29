import BigNumber from 'bignumber.js'
import { decodeFunctionData } from 'viem'
import I18n, { resolveLocale } from 'assets/Lang'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { isNativeToken } from 'common/tokens'

// On-chain reads the swap/buy confirm flow depends on: the source balance the
// quote was built against, and the allowance that decides when the swap may be
// broadcast after its approval.
//
// Same conventions as WalletActionForm/preCheck.js and SupplyUsdcForm's
// supplyChecks.js — reads go through ViemWeb3 (inheriting the app's fallback RPC
// list), the hex chain id from the agent is normalized to a decimal, and a read
// that FAILS never blocks the swap on its own. Only a balance we positively read
// is allowed to fail the check; the gas pre-flight downstream stays the last
// gate.

const tr = (key, language, opts) =>
  I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })

// The agent hands out HEX chain ids ("0xa"); every chain lookup in the app is
// keyed by the DECIMAL number. Normalized at this boundary so the shared helpers
// keep receiving what they already expect (mirrors WalletActionForm).
export const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

// Print a balance in full — every decimal of it. It is the figure the user
// weighs "do I have enough?" against, so a truncated `1.234567` beside a real
// `1.2345678` reads as wrong. `toFixed()` with no argument never switches to
// exponential notation (unlike toString on very small numbers).
const fmtFull = (n) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.toFixed() : '0'
}

const ERC20_ALLOWANCE_ABI = [{
  name: 'allowance',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ],
  outputs: [{ name: '', type: 'uint256' }]
}]

const ERC20_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' }
  ],
  outputs: [{ name: '', type: 'bool' }]
}]

const client = (chainId) => {
  try {
    return ViemWeb3.getPublicClient(toChainId(chainId)) || null
  } catch (_err) {
    return null
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Pull `{ spender, value }` out of one approve transaction the agent built.
 *
 * The quote produces approvals in one of TWO shapes (see `buildApproveTxs` in
 * useSwapQuote), and they are not interchangeable:
 *
 *   - deBridge — a plain ERC-20 `approve(spender, value)` this side encoded, so
 *     the calldata decodes and both fields are known.
 *   - Relay — the provider's OWN approval payload, passed through untouched. It
 *     is usually still an `approve`, but nothing guarantees it: `to` may not even
 *     be the source token.
 *
 * So this decodes best-effort and returns null when it cannot, which is a
 * meaningful answer rather than a failure — the caller then waits on the
 * approval's RECEIPT instead of polling an allowance it has no spender for.
 * Never throws: the calldata is remote input.
 *
 * `value` is 0 for a ZEROING approve, which is a real leg and not a no-op: a
 * token that refuses to overwrite a non-zero allowance (USDT on Ethereum) can
 * only be re-approved after one. See `pendingApprovals`.
 */
export const decodeApprove = (approveTx) => {
  const data = approveTx?.data
  if (typeof data !== 'string' || !data.startsWith('0x')) return null
  try {
    const { functionName, args } = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data })
    if (functionName !== 'approve') return null
    const [spender, value] = args || []
    if (!spender) return null
    return { spender: String(spender), value: BigInt(String(value ?? 0)) }
  } catch (_err) {
    // Not an `approve` we can read (a provider's own router call, a permit2
    // payload, malformed calldata). The caller falls back to the receipt.
    return null
  }
}

/**
 * Current allowance `spender` holds over `owner`'s `token`, in smallest units.
 *
 * Null when it cannot be read — the caller treats that as "unknown", never as
 * zero: on the pre-send path an unreadable allowance must not cancel a swap that
 * would have worked, and on the post-approve poll it must not be mistaken for a
 * failed approval.
 */
export const readAllowance = async ({ chainId, owner, token, spender }) => {
  const c = client(chainId)
  if (!c || !owner || !token || !spender) return null
  try {
    const raw = await c.readContract({
      abi: ERC20_ALLOWANCE_ABI,
      address: token,
      functionName: 'allowance',
      args: [owner, spender]
    })
    return BigInt(String(raw))
  } catch (_err) {
    return null
  }
}

/**
 * Does the approve leg still need to run?
 *
 * The agent decided an approval was needed when it BUILT the quote, which can be
 * long before the user taps confirm — and in between the same allowance may have
 * been granted (another swap, another app, an earlier attempt of this very
 * widget that approved and then failed at the swap). Re-asking here is what
 * keeps a retry from paying for a redundant approval.
 *
 * Deliberately conservative in both unknown directions: no decodable spender, or
 * an unreadable allowance, both mean "run it". A redundant approve costs gas; a
 * skipped one reverts the swap after the user has already signed.
 */
export const needsApproval = async ({ chainId, owner, token, approveTx, amountRaw }) => {
  if (!approveTx) return false
  const decoded = decodeApprove(approveTx)
  if (!decoded) return true

  const want = parseRaw(amountRaw)
  // Nothing to measure against — the quote carried no raw amount — so trust the
  // agent's own decision to include the approval.
  if (want === null || want <= 0n) return true

  const allowance = await readAllowance({ chainId, owner, token, spender: decoded.spender })
  if (allowance === null) return true
  return allowance < want
}

/**
 * Which of the quote's approve legs still have to be sent, in order.
 *
 * A swap carries one approval in the ordinary case and TWO when the pay token
 * refuses to overwrite a non-zero allowance — USDT on Ethereum being the
 * canonical one, quoted as `approve(spender, 0)` then `approve(spender, amount)`.
 * Both are real transactions, and skipping the first makes the second revert.
 *
 * The whole list is re-examined against the live allowance for the same reason
 * `needsApproval` existed: the quote decided this when the message was built,
 * and a retry must not pay twice for work that already landed. Concretely, with
 * the current allowance A and the target amount:
 *
 *   - A already covers the spend → nothing to run, the swap can go straight out.
 *   - A is 0 → the zeroing leg is already satisfied and is dropped; only the
 *     real approve runs. This is exactly the retry-after-a-failed-swap case.
 *   - otherwise → every leg runs, as quoted.
 *
 * Conservative in both unknown directions, like `needsApproval`: an undecodable
 * approval or an unreadable allowance keeps every leg. A redundant approve costs
 * gas; a skipped one reverts the swap after the user has already signed.
 */
export const pendingApprovals = async ({ chainId, owner, token, approveTxs, amountRaw }) => {
  const list = (approveTxs || []).filter(Boolean)
  if (list.length === 0) return []

  const want = parseRaw(amountRaw)

  // The FINAL leg is the one that grants the real allowance; the ones before it
  // only clear the way. Its spender is what the live allowance is measured for.
  const target = decodeApprove(list[list.length - 1])
  if (!target || want === null || want <= 0n) return list

  const allowance = await readAllowance({ chainId, owner, token, spender: target.spender })
  if (allowance === null) return list
  if (allowance >= want) return []

  // Nothing left to zero, so drop any leg that would only set the allowance to a
  // value it already holds. Anything else — including a partial allowance that
  // still has to be cleared — keeps the full sequence.
  if (allowance === 0n) {
    const remaining = list.filter((tx) => {
      const decoded = decodeApprove(tx)
      // Undecodable stays: it may be a provider payload that does more than an
      // `approve`, and dropping it would silently skip work.
      return !decoded || decoded.value !== 0n
    })
    return remaining.length > 0 ? remaining : list
  }

  return list
}

/**
 * Poll `allowance` until `spender` can actually pull `amountRaw`.
 *
 * This is the gate between the approve and the swap, and it stands in for
 * waiting on the approval's receipt because it covers strictly more:
 *
 *  - A receipt comes from ONE RPC while the swap is broadcast through ViemWeb3's
 *    fallback pool of several. A node in that pool can be a block behind and
 *    still report the OLD allowance; a swap sent on that view reverts, having
 *    already charged the user for the approval.
 *  - It answers the question that actually matters ("can the router pull the
 *    funds?") rather than a proxy for it.
 *
 * One `eth_call` per attempt, settling the moment the node catches up — so the
 * common case returns in a tick or two rather than after a fixed wait. The
 * window must span the approve being MINED as well as propagating: 40 × 1.5s ≈
 * 60s, comfortably past a slow Ethereum block while still bounded. Matches
 * `waitForAllowance` in the supply flow.
 */
export const waitForAllowance = async ({
  chainId,
  owner,
  token,
  spender,
  amountRaw,
  attempts = 40,
  intervalMs = 1500
}) => {
  const want = parseRaw(amountRaw)
  if (want === null || want <= 0n || !spender) return false

  return waitForAllowanceValue({
    chainId,
    owner,
    token,
    spender,
    attempts,
    intervalMs,
    settled: (allowance) => allowance >= want
  })
}

/**
 * The same gate, for a leg whose target is not "at least the swap amount".
 *
 * The zeroing approve is the case that needs it: what proves IT landed is the
 * allowance reading exactly 0, which `waitForAllowance` would reject out of hand
 * (it takes a positive amount by construction). Sending the second approve
 * before the first is visible is what the whole two-step exists to avoid — the
 * token would reject it for the very same reason the reset was needed.
 *
 * `settled` receives the allowance as a BigInt and says whether the wait is over.
 * It is never called with null: an unreadable RPC is a transport hiccup, not an
 * answer, and polling continues.
 */
export const waitForAllowanceValue = async ({
  chainId,
  owner,
  token,
  spender,
  settled,
  attempts = 40,
  intervalMs = 1500
}) => {
  if (!spender || typeof settled !== 'function') return false

  for (let i = 0; i < attempts; i++) {
    const allowance = await readAllowance({ chainId, owner, token, spender })
    // `null` is an unreadable RPC, not a confirmed-zero allowance — keep trying
    // rather than declaring the approval failed on a transport hiccup.
    if (allowance !== null && settled(allowance)) return true
    if (i < attempts - 1) await sleep(intervalMs)
  }
  return false
}

/**
 * A smallest-unit decimal string → BigInt, or null when it is not one.
 *
 * The value comes from the agent over the wire, so every non-numeric shape has
 * to be survivable: BigInt() throws on '', '1.5', 'abc' and undefined alike, and
 * a throw here would take down the whole confirm.
 */
export const parseRaw = (value) => {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (!/^\d+$/.test(s)) return null
  try {
    return BigInt(s)
  } catch (_err) {
    return null
  }
}

/**
 * The swap's own first check: does the wallet still hold the source token it is
 * about to spend?
 *
 * Asked on-chain rather than trusting the quote, which resolved the balance when
 * the message was built and can be stale by the time the user taps confirm. The
 * generic gas pre-flight would catch a short balance too, but only as the
 * non-committal "this transaction cannot be completed" — estimateGasTxs swallows
 * the revert reason. Asking directly buys the specific figure.
 *
 * Returns null (go ahead) on anything it cannot positively read, so an RPC
 * outage never blocks a swap on its own.
 */
export const checkSwapBalance = async ({ chainId, from, token, amount, symbol, language }) => {
  const want = BigNumber(amount)
  if (!want.isFinite() || want.lte(0) || !from) return null

  const id = toChainId(chainId)
  // 'native' routes getBalanceToken down its getBalance path; an ERC-20 address
  // multicalls decimals + balanceOf. Converted either way, so the comparison is
  // in the same units the quote is stated in.
  const address = isNativeToken(token, id) ? 'native' : token
  if (!address) return null

  let have
  try {
    have = BigNumber(await ViemWeb3.getBalanceToken(id, from, address, true))
  } catch (_err) {
    // getBalanceToken THROWS on a failed read rather than resolving 0, so this
    // is the unreadable case — fall through to the gas pre-flight rather than
    // blocking on a transport failure.
    return null
  }

  // Zero is a REAL reading and must fail the check — an empty wallet is the
  // clearest case of not being able to fund the swap. Only an unparseable or
  // negative figure counts as "cannot tell".
  if (!have.isFinite() || have.lt(0)) return null
  if (have.gte(want)) return null

  return tr('walletActionNotEnoughBalance', language, {
    symbol: symbol || '',
    balance: fmtFull(have)
  })
}
