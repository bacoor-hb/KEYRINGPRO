import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import BigNumber from 'bignumber.js'
import { Colors } from 'common/styles'
import I18n, { resolveLocale } from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import GlassView from 'frontend/Components/UI/GlassView'
import useSendTx, { TX_STATUS } from 'frontend/Hooks/useSendTx'
import { useX402FeeFor } from 'frontend/Hooks/useX402Fees'
import TxStatusTimeline from '../TxStatusTimeline'
import X402SignModal from '../X402SignModal'
import { runX402Gate } from './x402Gate'
import styles from './styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

// Cut `n` to `d` decimals through BigNumber so float artifacts can never leak
// into a displayed or derived value. Truncates and strips trailing zeros.
const toFixedDown = (n, d) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFixed() : ''
}

// Display a token amount truncated (no rounding) to 8 decimals, with grouping.
const fmt = (n, d = 8) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

// A USD amount as "$1,234.56". The core passes the RAW full-precision value; the
// app owns the display, so rounding to cents (ROUND_DOWN) and thousands grouping
// happen HERE. Returns null for anything unparseable or non-positive, so the
// caller renders no dollar figure rather than "$NaN"/"$0".
const fmtUsd = (n) => {
  const bn = BigNumber(n)
  if (!bn.isFinite() || bn.lte(0)) return null
  return `$${bn.toFormat(2, BigNumber.ROUND_DOWN)}`
}

// Keep a numeric input as a positive number string, no sign. A typed comma (some
// keyboards use it as the decimal mark) becomes a dot.
//   - integer fields (e.g. ERC-1155 editions): digits only, no dot at all.
//   - decimal fields (token/native amounts): a single dot, fraction capped to the
//     token's `decimals` — mirroring the Send Token screen.
const sanitizeAmount = (v, { decimals = 18, integer = false } = {}) => {
  if (integer) return String(v).replace(/[^0-9]/g, '')
  const out = String(v).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = out.indexOf('.')
  if (i === -1) return out
  // Single dot only, and clip the fraction to at most `decimals` places.
  const max = BigNumber(decimals).isFinite() ? BigNumber(decimals).toNumber() : 18
  const fraction = out.slice(i + 1).replace(/\./g, '').slice(0, max)
  return `${out.slice(0, i)}.${fraction}`
}

const isAddress = (v) => /^0x[0-9a-fA-F]{40}$/.test(String(v || '').trim())

// An address is one unbroken token, so nothing that isn't part of it is allowed
// in: every space, tab and newline is dropped as it is typed.
//
// The field is `multiline` (so a long 0x… wraps rather than scrolling off), and
// multiline TextInputs accept a literal Return — which would otherwise sit
// invisibly inside the value and make an otherwise correct address fail the
// `isAddress` test with nothing on screen to explain why.
//
// Applied to PASTED text too, which is the common case: addresses copied from
// an explorer or a chat message routinely carry a trailing newline or stray
// spaces. Stripping them here means the paste just works instead of erroring.
//
// The 42-char cap (0x + 40 hex) lives here rather than in the input's
// `maxLength` on purpose: maxLength truncates the RAW text, before any of this
// runs, so pasting " 0xabc…" would spend one of the 42 on the leading space and
// silently drop the address's last character — leaving a plausible-looking
// value that fails validation for no visible reason. Cutting after the strip
// counts only characters that survived.
const sanitizeAddress = (v) => String(v).replace(/\s/g, '').slice(0, 42)

// The chat agent hands out HEX chain ids ("0xa"), but every chain lookup in the
// app is keyed by the DECIMAL number — ViemWeb3 compares `chainId.toString()`
// against the catalog and getChainInfo indexes by the number, so "0xa" matches
// nothing. The RPC list then comes back EMPTY and viem dies inside fallback()
// with "transports[i] is not a function", which the shared services swallow into
// a 0/-1 and surface as "this transaction cannot be completed".
//
// Normalized HERE, at the edge of the chat flow, so the rest of the app keeps
// receiving the decimal ids it already expects — no shared helper is changed.
const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

/**
 * Shared renderer for the in-chat wallet-action forms (send native, send token,
 * approve, send NFT). Every one of them is the same shape — a few labelled
 * fields plus a submit — so they are described declaratively by `fields` and
 * rendered here rather than copied four times.
 *
 * Unlike AddLiquidityForm (which hands the intent back to the agent), these
 * forms EXECUTE: submitting signs and broadcasts the transaction locally via
 * `useSendTx`, then renders the shared `TxStatusTimeline` — the same
 * sign → confirm → done/error flow ConfirmAddLiquidityTx uses. The agent is
 * never asked to confirm; it already resolved everything it could, and the
 * remaining values are typed right here.
 *
 * A field is `{ key, label, type, placeholder, symbol, optional, integer }` where
 * `type` is 'amount' | 'address' | 'text'. `integer` (amount fields only) forces a
 * whole number — used for ERC-1155 editions, which can't be fractional; token/
 * native amounts stay decimal, capped to the token's `decimals`. Values already
 * resolved by the agent arrive in `parameters` and pre-fill the field.
 *
 * `buildTxs({ values, parameters, walletAddress })` returns the unsigned tx
 * array to broadcast — each action supplies its own encoder.
 *
 * `preCheck({ values, parameters, walletAddress, chainId, language })` is the
 * action's own first check, run on submit before anything is signed: it asks the
 * one on-chain question that action depends on (holding enough of the token,
 * owning the NFT) and resolves to an error string to stop, or null to go ahead.
 */
export default function WalletActionForm ({
  props,
  language,
  fields,
  submitLabel,
  buildTxs,
  preCheck,
  // This action's endpoint on the paid backend (see X402_PATH) — each form is
  // authorized, and priced, separately. Either a path string (GET) or
  // `{ path, method }`. Omitted → no gate, the form sends straight through, so
  // an action whose endpoint doesn't exist yet keeps working.
  x402Path,
  // Amount fields validate against this when given (the agent pre-computes a
  // gas-aware spendable balance for native sends).
  spendable,
  spendableSymbol,
  // USD value of the spendable balance (`spendable × unit price`), a plain
  // decimal string the core computed and passed through `parameters` — shown as
  // "(~$X)" next to the spendable amount. Absent when the core couldn't price
  // the token (or is an older build that doesn't send it): the line then shows
  // just the token amount, no dollar figure.
  spendableUsd,
  // Omit for a spendable that should show WITHOUT percentage shortcuts — a
  // count of NFT editions is not something you take 25% of.
  quickPercents,
  // Optional `({ values, parameters, chainId }) => { chainId, assetAddress, amount }`
  // describing the token this action SENDS — `amount` being the human figure,
  // NOT smallest units; the sheet scales it by the fee token's real on-chain
  // decimals, which it reads and the form does not have reliably.
  // Supplied only by forms that move a fungible token, because only the form
  // knows which of its fields that is. Handed to the x402 approval sheet, which
  // deducts it from the spendable balance when the fee happens to be charged in
  // the very same token — one balance can't fund both the transfer and the fee.
  spend,
  // Tx lifecycle plumbing, forwarded by MessageBubble — same set
  // ConfirmAddLiquidityTx receives.
  onResult,
  onStatusChange,
  onCopyHash,
  onPersist,
  // The AISearch screen container. The x402 approval opens as a screen-level
  // drawer through it — this form is nested inside a chat bubble, so a drawer
  // hosted here would be positioned against the bubble instead of the screen.
  screenRef
}) {
  const t = (key, opts) => tt(key, language, opts)
  const { chainId: rawChainId, chainName, walletAddress, parameters = {}, txState } = props
  // Decimal from here down: useSendTx, preCheck and the x402 gate all feed the
  // shared chain helpers, which only match on the number (see toChainId).
  const chainId = toChainId(rawChainId)

  // Seed each field from what the agent already resolved; the user fills the
  // rest. Once submitted, the values that were actually signed are persisted
  // into `txState` and take priority — otherwise coming back to the chat would
  // re-seed from `parameters` and blank out everything the user typed, leaving
  // a completed tx sitting above empty fields.
  //
  // Seeded values go through the same per-type sanitizer as typed ones. They
  // otherwise bypass `setValue` entirely, and an address is the case that bites:
  // `isAddress` TRIMS before testing, so an agent value carrying a stray newline
  // validates fine and then reaches ethers untrimmed at signing time, where it
  // throws "invalid address" — a failure the user can neither see nor fix, on a
  // field that is usually locked.
  const [values, setValues] = useState(() =>
    fields.reduce((acc, f) => {
      const submitted = txState?.values?.[f.key]
      const seed = submitted != null
        ? String(submitted)
        : parameters[f.key] != null ? String(parameters[f.key]) : ''
      acc[f.key] = f.type === 'address' ? sanitizeAddress(seed) : seed
      return acc
    }, {})
  )
  const [touched, setTouched] = useState({})

  // Fields the AGENT resolved, locked so the user can't edit them. A contract
  // address is the one value in these forms the user has no way to sanity-check
  // by eye — a single altered character silently redirects the transfer to a
  // different token, and it's the field a fat-fingered tap in a long wrapped
  // 0x string is most likely to land in. When the agent resolved it (from the
  // symbol the user asked for) it is authoritative, so it's presented as a fact
  // rather than an input. A field the user has to type themselves is never
  // locked, so a token the agent couldn't resolve stays fully usable.
  //
  // Computed ONCE from the mount-time seed (hence useRef, not a live read of
  // `values`): the lock must reflect where the value CAME FROM, not what it
  // currently is. Deriving it from `values` would re-lock the field the moment
  // the user typed a valid address into it.
  const lockedFieldsRef = useRef(
    fields.reduce((acc, f) => {
      // `txState.values` is a previous submit of THIS form, so a value restored
      // from it was locked (or typed) on that earlier mount — only the agent's
      // own `parameters` count as an AI pre-fill.
      acc[f.key] = !!(f.lockWhenPrefilled && parameters[f.key] != null && String(parameters[f.key]) !== '')
      return acc
    }, {})
  )
  const isLocked = (f) => lockedFieldsRef.current[f.key]

  // Token decimals the agent resolved (Send Token / Approve carry it); the amount
  // field caps its fraction to this so the user can't type more precision than the
  // token supports. Defaults to 18 when absent (native / unknown).
  const amountDecimals = parameters.decimals != null ? Number(parameters.decimals) : 18

  // What this action costs in x402, read from the backend's own price list. This
  // drives BOTH the "※ Fee" line and whether the paid gate runs at all: priced →
  // charged, unpriced (or price list unreachable) → sends free. `feesLoading`
  // keeps submit disabled while the list is still in flight, so an action is
  // never sent free merely because the price hadn't arrived yet.
  const { fee: x402Fee, isLoading: feesLoading } = useX402FeeFor(x402Path)

  const setValue = (f, raw) => {
    let v = raw
    if (f.type === 'amount') v = sanitizeAmount(raw, { decimals: amountDecimals, integer: f.integer })
    // No whitespace or line breaks in an address — see sanitizeAddress.
    else if (f.type === 'address') v = sanitizeAddress(raw)
    // Integer text fields (e.g. an NFT token id — a uint256) accept digits only.
    else if (f.integer) v = String(raw).replace(/[^0-9]/g, '')
    setValues((prev) => ({ ...prev, [f.key]: v }))
    setTouched((prev) => ({ ...prev, [f.key]: true }))
  }

  const amountField = fields.find((f) => f.type === 'amount')
  const amountValue = amountField ? values[amountField.key] : null
  // An optional amount left blank means its default of 1 (ERC-1155 editions) —
  // so the balance check has a real number to weigh even when nothing is typed,
  // and a wallet holding 0 can't slip a default-1 send past an empty field.
  const effectiveAmount = amountValue || (amountField?.optional ? '1' : amountValue)
  const parsedAmount = BigNumber(effectiveAmount)
  const validAmount = parsedAmount.isFinite() && parsedAmount.gt(0)

  const spendableBn = BigNumber(spendable)
  const exceedsBalance =
    validAmount && spendableBn.isFinite() && parsedAmount.gt(spendableBn)

  // USD value of the amount being sent, shown next to the amount field's label —
  // the same "(~$X)" the add-liquidity form puts beside its own amount title.
  //
  // The core sends no unit price, only the pair it already computed
  // (`spendableUsd = spendable × price`), so the price is recovered by dividing
  // the two. Exact, because both sides come from that one multiplication.
  //
  // Everything about it is conditional on the core having priced the token: no
  // `spendableUsd` (an older core, an unpriced token, or an NFT edition count,
  // which passes none) leaves `unitPriceUsd` null and the label renders bare,
  // exactly as before. `gt(0)` on the divisor also keeps a zero spendable — a
  // drained wallet — from producing Infinity.
  const unitPriceUsd = (() => {
    const usd = BigNumber(spendableUsd)
    if (!usd.isFinite() || usd.lte(0)) return null
    if (!spendableBn.isFinite() || !spendableBn.gt(0)) return null
    return usd.div(spendableBn)
  })()
  const amountUsd = validAmount && unitPriceUsd ? parsedAmount.times(unitPriceUsd) : null

  // Per-field error. The `touched` gate only gags complaints about what the user
  // has not filled in yet, so an untouched form never opens covered in red. It
  // must NOT gag a bad VALUE: the agent pre-fills fields from `parameters`, and
  // such a value is never "touched" — gating it would disable submit with no
  // visible reason. So anything that judges the value itself reports right away.
  const fieldError = (f) => {
    const v = values[f.key]
    // A blank optional amount still sends its default of 1, so the balance is
    // the one thing worth checking on it — a wallet with 0 editions must not
    // pass just because the field was left alone.
    if (f.optional && !v) {
      return f.type === 'amount' && exceedsBalance ? t('insufficientBalance') : null
    }
    if (!v) return touched[f.key] ? t('walletActionFieldRequired') : null
    if (f.type === 'address' && !isAddress(v)) return t('walletActionInvalidAddress')
    if (f.type === 'amount') {
      const n = BigNumber(v)
      if (!n.isFinite() || n.lte(0)) return t('walletActionInvalidAmount')
      // Integer-only amounts (e.g. ERC-1155 editions) can't be fractional.
      if (f.integer && !n.isInteger()) return t('walletActionInvalidAmount')
      if (exceedsBalance) return t('insufficientBalance')
    }
    // Integer text field (e.g. NFT token id): a whole number ≥ 0 (0 is a valid
    // id). setValue already strips non-digits; this also guards agent pre-fills.
    if (f.type === 'text' && f.integer && !/^\d+$/.test(v)) return t('walletActionInvalidAmount')
    return null
  }

  const isFilled = (f) => {
    const v = values[f.key]
    // An optional field is "filled" when empty — but if the user DID type
    // something, it still has to be valid (a bad value must block submit).
    // Blank still implies the default of 1, so an amount whose default already
    // exceeds the balance blocks submit rather than sailing through untyped.
    if (f.optional && !v) return !(f.type === 'amount' && exceedsBalance)
    if (!v) return false
    if (f.type === 'address') return isAddress(v)
    if (f.type === 'amount') {
      const n = BigNumber(v)
      if (!n.isFinite() || !n.gt(0)) return false
      if (f.integer && !n.isInteger()) return false
      // An amount over the balance is invalid too — matches fieldError, which
      // shows "insufficient balance" here; without this submit stays enabled
      // under a visible error.
      if (exceedsBalance) return false
      return true
    }
    // Integer text field (NFT token id): all-digits, non-empty (0 allowed).
    if (f.type === 'text' && f.integer) return /^\d+$/.test(v)
    return true
  }

  // The x402 payment awaiting approval ({ typedData, display }) while the gate's
  // paid API call is in flight; null when nothing is pending. The gate parks its
  // `resolve` in the ref and the sheet hands back the signature (or null when
  // the user cancels), so the whole payment is one awaited step inside `confirm`.
  const [x402Req, setX402Req] = useState(null)
  const x402ResolveRef = useRef(null)

  const handleX402Resolve = useCallback((signature) => {
    const resolve = x402ResolveRef.current
    x402ResolveRef.current = null
    setX402Req(null)
    resolve?.(signature)
  }, [])

  // Has this form already settled its x402 fee?
  //
  // The payment settles before the backend answers and before the tx is signed,
  // so an attempt can cost the user the fee and still fail — a revert, an RPC
  // timeout, a 500 from the backend. Retrying must not charge them twice for the
  // same form, so the fact is remembered here and the gate skipped from then on.
  //
  // A plain flag, not keyed on the values being sent: paying once covers this
  // form for good, including a retry the user corrected a field in. That assumes
  // the backend prices an action per call rather than per authorized request; if
  // it ever starts matching the payment against the exact values it quoted, an
  // edited retry would come back 402 and this would need to key on them.
  //
  // Scoped to this one form (it lives in the message's own `txState`), not to the
  // wallet or the route: another message is a separate action and pays its own
  // fee. Seeded from the persisted state so it survives leaving the chat and
  // coming back — where losing it would be most expensive, since the user cannot
  // see that they already paid.
  //
  // Held in a ref ALONGSIDE the state: `gate` is called from inside the send flow
  // and must read the current value, but it is memoized on its deps, so a plain
  // state read would be the value captured when the closure was built.
  const [x402Paid, setX402Paid] = useState(!!txState?.x402Paid)
  const x402PaidRef = useRef(x402Paid)

  const markX402Paid = useCallback(() => {
    x402PaidRef.current = true
    // Drives the persist effect below, so the flag reaches `txState` without
    // waiting for the flow to finish — if the app dies mid-send, the user must
    // still not be charged again.
    setX402Paid(true)
  }, [])

  // Ask the backend to authorize this action, paying its x402 charge if it asks
  // for one. Runs inside the send flow AFTER the balance pre-check and the
  // gas/fee pre-flight — see the `gate` contract in useSendTx — so the user is
  // never asked to pay for a transaction that would have failed anyway.
  // Flat scalars only — these go on the query string. `values` is what the user
  // actually submitted (amount, to_address, contract_address, …) and takes
  // priority over the agent's original `parameters`.
  //
  // `rawChainId` on purpose: the decimal normalization above is for the app's
  // own chain lookups, while this goes on the wire to the backend, which has
  // been receiving the agent's hex id all along. Changing that silently is an
  // API change, so the query string keeps the form the server already expects.
  const gate = useCallback(({ verify, lendKey, noteFeeToken } = {}) => {
    // Already paid on an earlier attempt of this form, so a retry goes straight
    // through rather than charging twice for one action. Read from the ref so a
    // payment made earlier in THIS mount is seen too, not just one restored from
    // `txState`.
    //
    // Note this also means no key gets lent on such a retry — there is no payment
    // to sign, so nothing reads the card early and the send scans once, as it
    // would have anyway.
    if (x402PaidRef.current) return null

    return runX402Gate({
      // Re-estimate + re-check the fee on the Pay tap, on top of the pre-flight
      // that already ran before the gate. Only if BOTH pass is anything signed;
      // otherwise the send aborts with that reason and the user has paid nothing.
      verify,
      // Announced the moment the payment settles — before the backend's answer,
      // so a settled payment followed by a failure still counts as paid. The fee
      // token rides along to the send's post-success refresh: the charge can be
      // settled in a different token on a different chain from the transfer, so
      // that balance would otherwise be the one nothing re-reads.
      onPaid: (feeToken) => {
        markX402Paid()
        noteFeeToken?.(feeToken)
      },
      // The payment and the transaction are signed by the same account, so the key
      // read for the payment is handed back to the send — a keycard user taps the
      // card once for the whole action instead of twice.
      onKey: lendKey,
      path: x402Path,
      query: { action: props?.action, chainId: rawChainId, from: walletAddress, ...values },
      walletAddress,
      requestSignature: (request) => new Promise((resolve) => {
        x402ResolveRef.current = resolve
        // `spend` rides along so the sheet can set aside what this transfer is
        // already claiming, in case the fee is charged in the same token.
        // Resolved HERE, at gate time, against the values actually being sent —
        // computing it at render would capture a half-typed amount.
        // `chainId` (decimal) not `rawChainId`: the sheet matches it against the
        // challenge's own chain id numerically.
        setX402Req({
          ...request,
          spend: spend ? spend({ values, parameters, chainId }) : null
        })
      })
    })
  }, [x402Path, rawChainId, chainId, walletAddress, props?.action, values, parameters, spend, markX402Paid])

  // Tx lifecycle (sign → broadcast → confirm) lives in the shared hook, so this
  // form renders the same timeline as every other tx screen. `txState` is any
  // status/hash persisted into the message on a previous mount — seeding the
  // hook with it restores the timeline when the user leaves and returns to the
  // chat, instead of resetting to IDLE.
  //
  // `buildTxs` is read through a ref-free closure on purpose: the hook only
  // calls it at confirm time, by which point `values` is whatever the user last
  // typed (submit is disabled until the form validates).
  const { status, txHash, confirm, settledLive, restoredFromHistory, error } = useSendTx({
    from: walletAddress,
    chainId,
    initialStatus: txState?.status,
    initialTxHash: txState?.txHash,
    // The reason it failed, so coming back to a failed form still shows the
    // specific cause instead of the generic "the transaction failed".
    initialError: txState?.error,
    // Lets a COLD (NFC keycard) account sign: its key isn't on the device, so
    // it has to be scanned off the card at signing time, which needs the
    // screen's BaseContainer for the scan sheet. Hot accounts ignore this.
    nfcProxy: screenRef?.nfcProxy,
    buildTxs: () => buildTxs({ values, parameters, walletAddress }),
    fallbackError: t('txFailed'),
    onResult,
    // Refresh the sender's balances once the tx confirms so the chat's
    // balance-aware widgets (and the rest of the app) reflect what just moved.
    // Target the ERC-20 being sent when the form has one (contract_address) so
    // it's read directly over RPC; a native send has no contract and falls back
    // to a full single-chain refresh that also picks up the native balance.
    refreshBalanceOnSuccess: true,
    refreshTokenAddress: values?.contract_address,
    // Same closure-over-`values` reasoning as buildTxs: it only runs at confirm
    // time, when `values` is whatever the user last typed.
    preCheck: preCheck
      ? () => preCheck({ values, parameters, walletAddress, chainId, language })
      : undefined,
    // Simulate the tx and verify the fee is affordable before signing. Runs
    // silently inside "Sending", so a revert or an empty gas tank is caught
    // before it costs anything, without adding a step the user has to watch.
    preflight: true,
    // Backend authorization + its x402 payment, last thing before signing.
    //
    // The PRICE LIST is what switches this on: the gate runs only for an action
    // that both has an endpoint AND is quoted a fee in the backend's openapi.json
    // (see useX402FeeFor). A route the spec does not price — and every route at
    // all when the spec is unreachable — sends free, exactly as it would if the
    // action had no endpoint. That keeps the charge and the "※ Fee" line driven
    // by one source: if the user was never told a price, they are never charged.
    gate: x402Path && x402Fee ? gate : undefined,
    language
  })

  const isIdle = status === TX_STATUS.IDLE
  // Pre-send checks are running (balance, gas pre-flight, and the x402-paid
  // backend authorization with its approval sheet). Nothing is signed yet, so
  // the form stays in its pre-send shape — no status timeline — but it must not
  // be edited or re-submitted while the flow is in flight.
  const isGating = status === TX_STATUS.GATING
  // A failed attempt is the one settled state the user can still act on: nothing
  // was sent, so the values are still just a draft. The form comes back to life
  // (undimmed, editable, submittable) so they can fix whatever caused the
  // failure — a wrong address, too large an amount — and send again, instead of
  // being left with a dead form and only the timeline's retry.
  const isFailed = status === TX_STATUS.ERROR
  // "Still showing the form": idle, busy with the checks that precede signing,
  // or failed and back in the user's hands.
  const isPreSend = isIdle || isGating || isFailed
  // Editable whenever nothing is in flight — idle, or after a failure.
  const isEditable = isIdle || isFailed
  // `feesLoading` only blocks an action that HAS an endpoint: for one without,
  // the price list is irrelevant and there is nothing to wait for. Without this
  // guard a fast tap during the initial fetch would skip a fee that does exist.
  const canSubmit = fields.every(isFilled) && !exceedsBalance && !isGating &&
    !(x402Path && feesLoading)

  // Let the host (chat list) scroll to keep the latest status in view — but only
  // on a REAL status transition, never on a remount. FlatList unmounts offscreen
  // rows and remounts them as you scroll back over them, and a widget that has
  // already settled remounts straight into SUCCESS/FAIL (restored from the
  // persisted txState). Firing on mount made every such remount ask the list to
  // scroll to the bottom, so scrolling up over past send-token bubbles yanked
  // the user back down. Seeding the ref with the mount-time status means the
  // first run has nothing to report; only a later change does.
  //
  // GATING is skipped too: it renders no timeline, so there is nothing new to
  // scroll into view.
  const lastNotifiedStatusRef = useRef(status)
  useEffect(() => {
    // Retrying passes back through GATING, which clears the last-notified status
    // so a retry that fails the same way again still counts as a transition —
    // otherwise ERROR → GATING → ERROR would look unchanged and never scroll.
    if (isIdle || isGating) {
      lastNotifiedStatusRef.current = null
      return
    }
    if (lastNotifiedStatusRef.current === status) return
    lastNotifiedStatusRef.current = status
    onStatusChange?.()
  }, [status, isIdle, isGating, onStatusChange])

  // Persist the live status/hash — plus the values that were signed — back into
  // the message so both the timeline and the filled-in fields survive a remount.
  // Skip IDLE — there's nothing worth restoring, and it avoids clobbering a
  // persisted state on the first mount before confirm. GATING is skipped for the
  // same reason: it's a transient in-flight phase with no tx behind it, and
  // rehydrating into it would strand the form mid-check with no way to resume.
  //
  // EXCEPT once the fee has been paid: the payment settles DURING gating, so
  // waiting for the status to advance would lose it in exactly the case that
  // matters most — paid, then the app dies before the tx is signed. That flag
  // has to be written the moment it becomes true.
  useEffect(() => {
    if (!x402Paid && (isIdle || isGating)) return
    // `error` rides along so a restored failure still says WHY it failed, rather
    // than falling back to the generic "the transaction failed".
    onPersist?.({ status, txHash, values, x402Paid, error })
  }, [status, txHash, isIdle, isGating, values, x402Paid, error, onPersist])

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    confirm()
  }, [canSubmit, confirm])

  return (
    <View style={styles.card}>
      {/* Once the tx is on its way — and once it has succeeded — the form is
          just a record of what was signed: it dims and stops responding, letting
          the status timeline below carry the attention. Mirrors the Send Token
          screen's dimmed-form treatment. A FAILED tx is the exception: nothing
          was sent, so the form stays lit and editable for another attempt. */}
      <View
        style={[styles.formBox, !isPreSend && styles.formBoxSubmitted]}
        pointerEvents={isEditable ? 'auto' : 'none'}
      >
        {/* Header: what this form does + which chain it runs on */}
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            <View
              style={{
                flex: 1
              }}>
              <MyTextTicker variant='subTitle' fontWeight={700}>{submitLabel(t)}</MyTextTicker>
            </View>
            <View>
              {!!chainName && (
                <View style={styles.headerMeta}>
                  <View style={styles.tag}>
                    <MyText variant='small' className='text-medium'>{chainName}</MyText>
                  </View>
                </View>
              )}
            </View>

          </View>

          <View style={styles.divider} className='bg-box-small' />
        </View>

        {fields.map((f) => (
          <View
            pointerEvents={isLocked(f) ? 'none' : 'auto'}
            key={f.key}
            style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <View>
                <MyText variant='default' fontWeight='700'>{f.label(t)}</MyText>
              </View>
              {/* What the typed amount is worth, beside the label — mirroring the
                  add-liquidity amount title. Only on the amount field, and only
                  while the form is still editable: once broadcast the figure is
                  a stale quote of a price that has since moved. Renders nothing
                  when the core didn't price the token (see `unitPriceUsd`). */}
              <View
                style={{
                  flex: 1
                }}>
                {isPreSend && f.type === 'amount' && !!fmtUsd(amountUsd) && (
                  <MyTextTicker variant='small' className='text-low'>
                    (~{fmtUsd(amountUsd)})
                  </MyTextTicker>
                )}
              </View>

            </View>

            <GlassView
              effect='clear'
              // Address rows reserve a fixed two-line height so a long 0x address
              // that wraps never shifts the layout (mirrors the Send Token field).
              style={[styles.inputRow, f.type === 'address' && styles.addressRow]}
            >
              <TextInput
                style={[
                  f.type === 'address' ? styles.addressInput : styles.input,
                  // A locked field is not an input the user skipped — it's a
                  // resolved fact. Dimming it says so, and stops it reading as
                  // a field they failed to fill.
                  isLocked(f) && styles.lockedInput
                ]}
                className='text-white font-semibold'
                value={values[f.key]}
                onChangeText={(v) => setValue(f, v)}
                // Not editable once the tx is on its way (the values are what
                // was signed — visible for reference only), nor when the agent
                // resolved this field for the user (see lockedFieldsRef).
                editable={isEditable && !isLocked(f)}
                keyboardType={f.integer ? 'number-pad' : f.type === 'amount' ? 'decimal-pad' : 'default'}
                // Addresses are long — let them wrap onto multiple lines instead
                // of scrolling horizontally off the field. Their 42-char cap is
                // applied in sanitizeAddress, NOT with `maxLength`, so whitespace
                // can't eat into the allowance (see there).
                multiline={f.type === 'address'}
                // A multiline input would otherwise show a Return key and accept
                // the newline it inserts. Nothing follows the address in this
                // form, so the key just dismisses the keyboard instead.
                blurOnSubmit={f.type === 'address'}
                returnKeyType={f.type === 'address' ? 'done' : undefined}
                autoCapitalize='none'
                autoCorrect={false}
                placeholder={f.placeholder(t)}
                placeholderTextColor={Colors.TEXT_LOW}
              />
              {!!f.symbol && (
                <MyText className='text-medium font-medium'>{f.symbol}</MyText>
              )}
            </GlassView>

            {/* Validation only matters while the form is still on screen — a
                broadcast tx can't be fixed by a red hint. */}
            {isPreSend && (
              <View style={styles.errorSlot}>
                {!!fieldError(f) && (
                  <MyText variant='small' className='text-red-text' style={styles.errorText}>
                    {fieldError(f)}
                  </MyText>
                )}
              </View>
            )}

            {/* Quick-pick chips + spendable line sit under the amount field */}
            {isPreSend && f.type === 'amount' && spendable != null && (
              <View style={styles.amountExtras}>
                {!!quickPercents?.length && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.quickScroll}
                    contentContainerStyle={styles.quickRow}
                  >
                    {quickPercents.map((p) => (
                      <TouchableOpacity
                        key={p}
                        activeOpacity={0.7}
                        onPress={() =>
                          setValue(f, toFixedDown(spendableBn.times(p).div(100), amountDecimals))}
                      >
                        <GlassView interactive style={styles.quickChip}>
                          <MyText variant='small' className='font-semibold'>{p}%</MyText>
                        </GlassView>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.spendableRow}>
                  <MyText className='text-medium'>{t('spendable')}:</MyText>
                  <View style={styles.spendableValue}>
                    <MyTextTicker className='text-medium'>
                      {fmt(spendable)}{spendableSymbol ? ` ${spendableSymbol}` : ''}
                      {/* USD value of the spendable balance, when the core priced
                          it — a dim "(~$X)" after the token amount. */}
                      {fmtUsd(spendableUsd) && (
                        <MyText variant='small' className='text-low'> (~{fmtUsd(spendableUsd)})</MyText>
                      )}
                    </MyTextTicker>
                  </View>
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={styles.submitBlock}>
          {/* The x402 charge, stated before the user commits — the approval sheet
            is the second, authoritative confirmation. Only rendered once a real
            price is known, so a slow or unreachable spec shows nothing rather
            than a placeholder or an invented number. */}
          {isPreSend && !!x402Fee && (
            <MyText className='text-medium' style={styles.feeNotice}>
              {t('walletActionFeeNotice', { fee: x402Fee.label })}
            </MyText>
          )}

          {/* Stays mounted (disabled) through the pre-send checks, so paying the
            x402 fee doesn't make the button disappear before the tx is sent. */}
          {isPreSend && (
            <MyButton
              className='w-full'
              style={!canSubmit && styles.submitBtnDisabled}
              activeOpacity={0.8}
              disabled={!canSubmit}
              variant='primary'
              onPress={handleSubmit}
            >
              {/* Mentions a payment only when one is actually going to happen —
                  the same `x402Fee` that gates the charge, not merely having an
                  endpoint. An unpriced route (or an unreachable price list) sends
                  free, so promising to "Pay fee" there would be a lie; GATING is
                  then just the balance/gas checks, hence "Checking". */}
              <MyTextTicker fontWeight={700}>
                {isGating
                  ? (x402Fee ? t('walletActionPayingFee') : t('walletActionChecking'))
                  : isFailed
                    ? t('retry')
                    : x402Fee
                      ? t('walletActionPayFeeAndExecute')
                      : t('walletActionExecute')}
              </MyTextTicker>
            </MyButton>
          )}
        </View>
      </View>

      {/* Shared status timeline drives the sign → confirm → done/error flow.
          Hidden through IDLE and GATING: until the x402 payment and the backend
          authorization are done, nothing has been sent, so "Sending" would be a
          lie — and a cancelled payment must leave the form untouched. It DOES
          render on failure (even though the form is live again), because the
          reason it failed is the thing the user needs in order to fix it. */}
      {!isIdle && !isGating && (
        <TxStatusTimeline
          status={status}
          txHash={txHash}
          from={walletAddress}
          chainId={chainId}
          language={language}
          onCopyHash={onCopyHash}
          // No retry button here on purpose: the form above stays live after a
          // failure, so its own submit button is the retry — and unlike this
          // one it re-reads whatever the user just corrected.
          // The pre-flight's reason ("not enough for the fee", "can't be
          // completed") is far more useful than the generic failure copy, so
          // pass it through when we have one.
          errorMessage={error}
          // Only animate the success/fail result when it settled live this
          // mount; a state restored from history renders statically.
          animate={settledLive}
          // The Sending/Waiting intro markers animate on any live flow; only a
          // full restore-from-history renders them statically.
          animateIntro={!restoredFromHistory}
        />
      )}

      {/* x402 approval for the backend authorization call. Opens mid-send (the
          timeline is showing "Sending"); cancelling resolves the gate with no
          signature, which aborts before anything is signed or broadcast. */}
      <X402SignModal
        request={x402Req}
        walletAddress={walletAddress}
        onResolve={handleX402Resolve}
        screenRef={screenRef}
      />
    </View>
  )
}
