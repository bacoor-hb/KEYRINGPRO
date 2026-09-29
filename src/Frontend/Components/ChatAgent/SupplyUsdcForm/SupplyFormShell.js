import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import BigNumber from 'bignumber.js'
import I18n, { resolveLocale } from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import GlassView from 'frontend/Components/UI/GlassView'
import { useX402FeeFor } from 'frontend/Hooks/useX402Fees'
import { formatFeeLabel } from '../x402FeeLabel'
import { applyFeeReserve } from '../x402FeeReserve'
import X402SignModal from '../X402SignModal'
import { X402_PATH, runX402Gate } from '../WalletActionForm/x402Gate'
import SupplyStatusTimeline from './SupplyStatusTimeline'
import useSupplyFlow, { SUPPLY_STEP, isBusyStep } from './useSupplyFlow'
import styles from './styles'
import { useChatKeyboard } from '../KeyboardAware'
import { handleOpenExplorerUserAddress } from 'common/chain'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

const QUICK_PERCENTS = [25, 50, 75, 100]

// Keep a typed amount a positive decimal, no sign, fraction capped to the
// token's decimals. A typed comma (some keyboards use it as the decimal mark)
// becomes a dot. Mirrors the shared form's sanitizer.
const sanitizeAmount = (v, decimals = 6) => {
  const out = String(v).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = out.indexOf('.')
  if (i === -1) return out
  const fraction = out.slice(i + 1).replace(/\./g, '').slice(0, decimals)
  return `${out.slice(0, i)}.${fraction}`
}

// Truncate (never round up) to `d` places, with grouping. Rounding up a
// balance-derived figure would propose supplying more than the wallet holds.
export const fmt = (n, d = 6) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

const fmtUsd = (n) => {
  const bn = BigNumber(n)
  if (!bn.isFinite() || bn.lte(0)) return null
  return `$${bn.toFormat(2, BigNumber.ROUND_DOWN)}`
}

/**
 * Everything a USDC supply card does that is the SAME for every protocol: the
 * header, the approved contract, the amount field and its validation, the quick
 * picks, the yield estimate, the one Execute button and the two-leg timeline.
 *
 * Deliberately NOT built on the shared `WalletActionForm`. That component owns a
 * single transaction's lifecycle, while a supply is a two-transaction sequence
 * (approve → deposit) that has to present as ONE action: one Execute button, one
 * status timeline carrying both legs. It also needs fields no transfer has — the
 * market contract being authorized, the receipt-token preview, the yield
 * estimate — so it renders its own layout rather than bending a generic one.
 *
 * Tapping Execute runs the whole sequence (see `useSupplyFlow`): the allowance
 * is read, an approval is sent and WAITED ON only if it is short, then the
 * deposit goes out. A market that is already approved is a single transaction.
 *
 * ## The x402 gate
 *
 * Like the wallet actions, a supply is authorized by the paid backend before
 * anything is signed, and pays that call's x402 charge through the shared
 * approval sheet. It is ONE authorization for the whole sequence — approve and
 * deposit are one action to the user, so they are charged once, at the point
 * where the wallet is still untouched. The charge happens only when the backend
 * actually quotes a price for the route (`useX402FeeFor`), which is the same
 * thing that renders the "※ Fee" line: a user who was never shown a price is
 * never charged.
 *
 * ## What each protocol supplies
 *
 * The ONE thing that genuinely differs between Aave, Compound, Spark and Morpho
 * is what the depositor receives back, so that is the only thing a protocol
 * component owns. It passes `ReceivedRow` — a COMPONENT (not a render callback)
 * rendered with `{ amount, validAmount, isEditable, estimate, onEstimate }`
 * into the "Est. Received" slot: a 1:1 aToken figure for Aave, a live share
 * preview for a vault.
 *
 * `estimate`/`onEstimate` exist for the vault case only. A 1:1 protocol can
 * always re-derive its figure from the amount, but a vault's comes from a rate
 * read that is disabled once the card settles — so the row reports each quote
 * up here, this component persists it with the message, and hands it back on
 * the next mount. It stays labelled an estimate; what was actually minted is a
 * separate figure, parsed from the receipt and shown by the timeline.
 *
 * A component rather than a function because the vault variants need hooks (the
 * debounced `convertToShares` read) driven by the amount, and the amount is
 * state that lives here. Everything else stays in this one copy rather than
 * being duplicated per protocol and drifting.
 */
export default function SupplyFormShell ({
  props,
  language,
  onResult,
  onStatusChange,
  onCopyHash,
  onPersist,
  // The AISearch screen container. The x402 approval opens as a screen-level
  // drawer through it — this card is nested inside a chat bubble, so a drawer
  // hosted here would be positioned against the bubble instead of the screen.
  screenRef,
  ReceivedRow
}) {
  const t = (key, opts) => tt(key, language, opts)
  const { market, asset, walletAddress, chainId, chainName, prefillAmount, spendable, spendableUsd, txState } = props || {}

  const decimals = asset?.decimals ?? 6
  const symbol = asset?.symbol || 'USDC'
  // The deposit contract, tappable through to the chain's own explorer. Without
  // an address the line renders as plain text rather than a dead tap, because a
  // link that goes nowhere is worse than no link.
  const contractAddress = market?.contract
  // blockchainListRedux is keyed by NUMERIC chainId, but this card receives it
  // as string|number (same reason useSupplyFlow normalizes with toChainId) — a
  // string key misses the entry, and the explorer helper silently degrades to
  // copying the address instead of opening the scan page.
  const scanChainId = Number(chainId)

  // Restore what was submitted on a previous mount (the chat persists it), so
  // returning to the conversation shows the amount that was actually supplied
  // rather than an empty field above a finished timeline.
  const [amount, setAmount] = useState(() =>
    txState?.amount != null ? String(txState.amount) : (prefillAmount ? String(prefillAmount) : '')
  )
  const [touched, setTouched] = useState(false)

  // The last figure the "Est. Received" row quoted, for protocols that read it
  // off-chain rather than deriving it from the amount (vaults — see
  // `ReceivedRow` above). Restored from the message so a settled card keeps the
  // estimate it was submitted against instead of re-quoting at today's rate.
  const [estimate, setEstimate] = useState(() => txState?.estimate ?? null)

  // What a supply costs in x402, read from the backend's own price list. This
  // drives BOTH the "※ Fee" line and whether the paid gate runs at all: priced →
  // charged, unpriced (or price list unreachable) → supplies free. `feesLoading`
  // keeps the button disabled while the list is in flight, so an action is never
  // sent free merely because the price hadn't arrived yet.
  const { fee: x402Fee, isLoading: feesLoading } = useX402FeeFor(X402_PATH.supplyUsdc)

  // The payment awaiting approval ({ typedData, display }) while the gate's paid
  // call is in flight; null when nothing is pending. The gate parks its
  // `resolve` in the ref and the sheet hands back the signature (or null when
  // the user cancels), so the whole payment is one awaited step inside the flow.
  const [x402Req, setX402Req] = useState(null)
  // Keeps the amount field visible above the keyboard while typing. No-op when
  // this card is rendered outside the chat thread.
  const { scrollInputIntoView } = useChatKeyboard()
  const amountGroupRef = useRef(null)

  const x402ResolveRef = useRef(null)

  // Has this card already settled its x402 fee?
  //
  // The payment settles before the backend answers and long before the deposit
  // is mined, so a run can easily cost the user the fee and still fail — a
  // reverted approve, an RPC timeout, a 500 from the backend. Retrying must not
  // charge them twice for the same card, so the fact is remembered here and the
  // gate skipped on every later attempt.
  //
  // A plain flag, NOT keyed on the supply amount: paying once covers this card
  // for good, including a retry the user re-typed a different amount into. That
  // is a deliberate choice — it assumes the backend prices a supply per call
  // rather than per authorized figure. If it ever starts matching the payment
  // against the exact amount it quoted, an edited retry would come back 402 and
  // this would have to become amount-aware again.
  //
  // Scoped to this one card (it lives in the message's own `txState`) and not to
  // the wallet or the route: it is authorization for this one supply, not a
  // credit balance. Another message asking for another supply pays its own fee.
  //
  // Seeded from the persisted state so it survives leaving the chat and coming
  // back — where losing it would be most expensive, since the user cannot see
  // that they already paid. `x402PaidAmount` / `x402PaidForAmount` are earlier
  // shapes of this field (it used to store the amount); any value there means
  // paid, so history written by those builds still skips the charge.
  //
  // Held in a ref ALONGSIDE the state: `gate` is called from inside the flow and
  // must read the current value, but it is memoized on its deps, so a plain
  // state read would be the value captured when the closure was built.
  const [x402Paid, setX402Paid] = useState(() =>
    !!(txState?.x402Paid ?? txState?.x402PaidForAmount ?? txState?.x402PaidAmount)
  )
  const x402PaidRef = useRef(x402Paid)

  const markX402Paid = useCallback(() => {
    x402PaidRef.current = true
    // Drives the persist effect below, so the flag reaches `txState` without
    // waiting for the run to finish — if the app dies mid-supply, the user must
    // still not be charged again.
    setX402Paid(true)
  }, [])

  const handleX402Resolve = useCallback((signature) => {
    const resolve = x402ResolveRef.current
    x402ResolveRef.current = null
    setX402Req(null)
    resolve?.(signature)
  }, [])

  // Ask the backend to authorize this supply, paying its x402 charge when it
  // asks for one. Runs inside the flow after the balance/gas pre-check and
  // before the approval — see the `gate` contract in useSupplyFlow.
  //
  // Flat scalars only: these go on the query string. `amount` is closed over,
  // which is safe because the field is frozen from the moment Execute is tapped
  // — the card is inert through the checks (see `isEditable`) — so what is
  // authorized is what the flow goes on to supply.
  const gate = useCallback(({ verify, lendKey, noteFeeToken } = {}) => {
    // Already paid on an earlier attempt of this card, so a retry goes straight
    // through rather than charging twice for one card. Read from the ref so a
    // payment made earlier in THIS mount is seen too, not just one restored
    // from `txState`.
    //
    // Note this also means no key gets lent on such a retry — there is no payment
    // to sign, so nothing reads the card early and the flow resolves the key once
    // itself, as it would have anyway.
    if (x402PaidRef.current) return null

    return runX402Gate({
      verify,
      // The fee token rides along to the post-supply refresh: the charge can be
      // settled in a different token on a different chain from the supply, so
      // that balance would otherwise be the one nothing re-reads.
      onPaid: (feeToken) => {
        markX402Paid()
        noteFeeToken?.(feeToken)
      },
      // The payment and both transaction legs are signed by the same account, so
      // the key read for the payment is handed back to the flow — a keycard user
      // taps once for the whole supply instead of three times.
      onKey: lendKey,
      path: X402_PATH.supplyUsdc,
      query: {
        action: 'supply_usdc',
        chainId,
        from: walletAddress,
        protocol: market?.protocol,
        market_type: market?.type,
        market_contract: market?.contract,
        contract_address: asset?.address,
        amount
      },
      walletAddress,
      requestSignature: (request) => new Promise((resolve) => {
        x402ResolveRef.current = resolve
        // What this supply is about to move, so the sheet can set it aside
        // before judging whether the fee is covered — the fee is settled in
        // USDC, which is the very token being supplied, so one balance would
        // otherwise look able to fund both. Human amount on purpose: the sheet
        // scales it by the fee token's real on-chain decimals.
        setX402Req({
          ...request,
          spend: { chainId, assetAddress: asset?.address, amount }
        })
      })
    })
  }, [chainId, walletAddress, market, asset, amount, markX402Paid])

  const { step, approveHash, supplyHash, error, received, execute } = useSupplyFlow({
    market,
    asset,
    walletAddress,
    chainId,
    language,
    onResult,
    // The PRICE LIST is what switches the charge on: a route the backend's
    // openapi.json quotes runs the gate and is charged; a route it does not
    // quote — including every route when the spec is unreachable — supplies
    // free. That keeps the charge and the "※ Fee" line driven by one source: if
    // the user was never told a price, they are never charged.
    gate: x402Fee ? gate : undefined,
    // Lets a COLD (NFC keycard) account supply: its key isn't on the device, so it
    // has to be scanned off the card at signing time, which needs the screen's
    // BaseContainer for the scan sheet. Hot accounts ignore this.
    nfcProxy: screenRef?.nfcProxy,
    initialState: txState
  })

  const parsed = BigNumber(amount)
  const validAmount = parsed.isFinite() && parsed.gt(0)

  // The wallet's own figure, before the x402 fee. Kept separate because the unit
  // price below is recovered by dividing it into `spendableUsd`, and those two
  // must stay the exact pair the core multiplied.
  const grossSpendableBn = BigNumber(spendable)

  // A supply moves the market's asset, so that is what the fee can collide with.
  // Reserves nothing unless the charge is settled in this very token on this very
  // chain — see x402FeeReserve.
  const {
    spendable: netSpendable,
    reserved: feeReserved
  } = applyFeeReserve(spendable, x402Fee, { chainId, address: asset?.address })

  // Everything that SIZES or JUDGES the amount uses the net figure: the
  // percentage chips, the ceiling, and the submit gate. Supplying 100% of a USDC
  // balance while the fee is also charged in USDC leaves nothing to settle it,
  // so 100% has to mean "all but the fee" or the card offers an amount that
  // cannot execute.
  const spendableBn = BigNumber(netSpendable)
  const exceedsBalance = validAmount && spendableBn.isFinite() && parsed.gt(spendableBn)

  // What the typed amount is worth, shown beside the "Amount" label — the same
  // "(~$X)" the wallet action and add-liquidity cards put next to theirs.
  //
  // No unit price comes down from the core, only the pair it already computed
  // (`spendableUsd = spendable × price`), so the price is recovered by dividing
  // the two. Exact, since both sides come from that one multiplication.
  //
  // Renders nothing whenever the token wasn't priced (no `spendableUsd`, an
  // older core), and `gt(0)` on the divisor keeps a drained wallet from
  // producing Infinity.
  const unitPriceUsd = (() => {
    const usd = BigNumber(spendableUsd)
    if (!usd.isFinite() || usd.lte(0)) return null
    // The GROSS balance on purpose — `spendableUsd` was computed from it, so
    // only that pair recovers the true unit price.
    if (!grossSpendableBn.isFinite() || !grossSpendableBn.gt(0)) return null
    return usd.div(grossSpendableBn)
  })()
  const amountUsd = validAmount && unitPriceUsd ? parsed.times(unitPriceUsd) : null

  // Dollar value of what is actually spendable, re-derived from the unit price
  // rather than reusing `spendableUsd` — which prices the gross balance and
  // would overstate a figure the fee has been taken out of. Falls back to the
  // core's own value when nothing was reserved.
  const netSpendableUsd = feeReserved && unitPriceUsd
    ? spendableBn.times(unitPriceUsd)
    : spendableUsd

  // Not memoized: `t` closes over `language` and is rebuilt each render, so a
  // memo here would either be stale on a language switch or never hit.
  const fieldError = (() => {
    if (!amount) return touched ? t('walletActionFieldRequired') : null
    if (!validAmount) return t('walletActionInvalidAmount')
    if (exceedsBalance) return t('insufficientBalance')
    return null
  })()

  const busy = isBusyStep(step)
  // The timeline appears once a transaction actually exists — CHECKING is still
  // pre-flight and reports on the button, not as a step.
  const showTimeline = step !== SUPPLY_STEP.IDLE && step !== SUPPLY_STEP.CHECKING
  // Two animation switches, mirroring the shared `TxStatusTimeline`, because the
  // step markers and the settled result don't come alive at the same moment.
  //
  // "Restored" means the timeline was ALREADY settled on this component's first
  // render — not merely that a previous run left something persisted. A card
  // that comes back from an interrupted run starts at IDLE, so when the user
  // runs it again that IS live and must animate.
  const restoredSettledRef = useRef(step === SUPPLY_STEP.DONE || step === SUPPLY_STEP.ERROR)

  // Step markers (Approve / Sending / Waiting). Latched on the first render that
  // shows the timeline and then held, because `TxStepIcon` captures `animate` at
  // mount: a value that changed mid-flow would animate later nodes differently
  // from the ones above them.
  const animateRef = useRef(null)
  if (showTimeline && animateRef.current === null) animateRef.current = !restoredSettledRef.current
  const animateIntro = animateRef.current ?? true

  // The success/fail result, which is a separate question: did it settle in
  // front of the user THIS mount? A card restored already-settled renders its
  // result statically, but one that settles while being watched plays the
  // animation — including a retry, whose result is live even though the card
  // itself was restored.
  const settledLive = !restoredSettledRef.current
  const isSettled = step === SUPPLY_STEP.DONE
  // A failed attempt is the one settled state still worth acting on: nothing was
  // supplied, so the card comes back to life for another try.
  const isFailed = step === SUPPLY_STEP.ERROR
  const isEditable = step === SUPPLY_STEP.IDLE || isFailed
  // "Still showing the form": idle, running the pre-flight checks that precede
  // signing, or failed and back in the user's hands. Mirrors WalletActionForm's
  // `isPreSend` — once the first transaction is actually signed the button
  // unmounts and the timeline below takes over, rather than leaving a dead
  // disabled control sitting above a live flow.
  const isPreSend = step === SUPPLY_STEP.IDLE || step === SUPPLY_STEP.CHECKING || isFailed
  // `feesLoading` blocks submit until the price list resolves — without it a
  // fast tap during the initial fetch would skip a fee that does exist.
  const canSubmit = validAmount && !exceedsBalance && !busy && !isSettled && !feesLoading

  // Let the chat list keep the newest status in view — but only on a real
  // transition, never on a remount.
  //
  // The list unmounts offscreen rows and remounts them on scroll-back, and a
  // settled card remounts straight into DONE/ERROR from its persisted state.
  // Firing then would ask the list to scroll to this card every time the user
  // scrolled up past it. Seeding the ref with the mount-time step means the
  // first run has nothing to report; only a later change does.
  const lastNotifiedStepRef = useRef(step)
  useEffect(() => {
    if (step === SUPPLY_STEP.IDLE) return
    if (lastNotifiedStepRef.current === step) return
    lastNotifiedStepRef.current = step
    onStatusChange?.()
  }, [step, onStatusChange])

  // Persist enough to restore the card: the amount that was signed, both hashes,
  // the outcome — including the failure reason, without which a restored error
  // would render "Failed" with no explanation, and the amount actually received,
  // which is read from a receipt this card will not fetch again — and whether the
  // fee is already paid, so a retry is not charged twice.
  //
  // Skipped while idle (nothing worth restoring) and while CHECKING (a transient
  // pre-flight phase with no transaction behind it, which the restore path
  // ignores anyway) — EXCEPT once the fee has been paid. The payment settles
  // during CHECKING, so waiting for the step to advance would lose it in exactly
  // the case that matters most: paid, then the app dies before the approve is
  // signed. That flag has to be written the moment it becomes true.
  useEffect(() => {
    if (!x402Paid && (step === SUPPLY_STEP.IDLE || step === SUPPLY_STEP.CHECKING)) return
    onPersist?.({ step, approveHash, supplyHash, error, received, amount, estimate, x402Paid })
  }, [step, approveHash, supplyHash, error, received, amount, estimate, x402Paid, onPersist])

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    execute(amount)
  }, [canSubmit, execute, amount])

  const apy = market?.apyPercent
  const earningsPerYear = validAmount && apy != null
    ? BigNumber(amount).times(apy).div(100).toFixed()
    : null

  return (
    <View style={styles.card}>
      {/* Dims only once something has actually been signed — from then on the
          card is a record of what was sent and the timeline below carries the
          attention. It stays lit through CHECKING (nothing is committed yet)
          but is already inert, so the pre-flight can't be re-submitted or
          edited underneath itself. Mirrors WalletActionForm. */}
      <View
        style={[styles.formBox, !isPreSend && styles.formBoxSubmitted]}
        pointerEvents={isEditable ? 'auto' : 'none'}
      >
        {/* Header: what this card does + the chain it runs on */}
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              {/* "Supply USDC" — the token comes from the asset actually being
                  supplied rather than a hardcoded "USDC". */}
              <MyTextTicker variant='subTitle' fontWeight={700}>
                {t('supplyTitle', { symbol })}
              </MyTextTicker>
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

        {/* The contract the user authorizes and deposits into — stated, not
            hidden, because approving it is what the first transaction does. */}
        <View style={styles.fieldGroup}>
          <View className='flex flex-row'>
            <MyText variant='default' fontWeight='700'>
              {t('supplySendToContract')}
            </MyText>
          </View>
          {/* Tapping the contract opens it on the chain's block explorer. On a
              chain with no explorer configured the helper copies the address
              instead. Without an address it stays a non-interactive line — same
              text, no tap target, so nothing looks pressable that isn't. */}
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={!contractAddress}
            onPress={() => handleOpenExplorerUserAddress(contractAddress, scanChainId)}
          >
            <MyText className={contractAddress ? 'text-brand' : 'text-medium'}>{contractAddress}</MyText>
          </TouchableOpacity>

        </View>

        {/* Amount */}
        <View
          // Scroll anchor: the group, so the label and the (~$x) line come up
          // with the field rather than the field alone.
          ref={amountGroupRef}
          style={styles.fieldGroup}
        >
          <View style={styles.labelRow}>
            <View>
              <MyText variant='default' fontWeight='700'>{t('supplyAmount')}</MyText>
            </View>
            {/* What the typed amount is worth, beside the label — mirroring the
                wallet action card. Only while the card is still pre-send: once
                the supply is signed the figure is a stale quote of a price that
                has since moved. Nothing renders when the token wasn't priced. */}
            <View
              style={{
                flex: 1
              }}>
              {isPreSend && !!fmtUsd(amountUsd) && (
                <MyTextTicker variant='small' className='text-low'>
                  (~{fmtUsd(amountUsd)})
                </MyTextTicker>
              )}
            </View>
          </View>
          <GlassView effect='clear' style={styles.inputRow}>
            {/* The field always carries the FILLED style (18/bold) and never
                renders a native placeholder. The hint is an overlaid <MyText>
                instead.

                Why not `placeholder` + a conditional style: the native view
                clears its text on the keystroke, while `setAmount('')` only
                reaches this style a frame later — so on delete the placeholder
                was painted once at 18/bold before snapping to the small style.
                Swapping `fontFamily` (Geist-Bold <-> Geist-Regular are separate
                files) made it worse by forcing a native font reload on the same
                view. Holding one style on the input removes both effects: the
                hint is a sibling that simply mounts/unmounts. */}
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, styles.inputFilled]}
                className='text-white '
                value={amount}
                onChangeText={(v) => {
                  setAmount(sanitizeAmount(v, decimals))
                  setTouched(true)
                }}
                editable={isEditable}
                keyboardType='decimal-pad'
                autoCapitalize='none'
                autoCorrect={false}
                // The chat thread's window never pans for the keyboard (the
                // composer is lifted by its own transform), so an in-bubble
                // field has to ask to be scrolled into view itself.
                onFocus={() => scrollInputIntoView(amountGroupRef)}
              />
              {!amount && (
                <MyText
                  className='text-low'
                  style={styles.inputPlaceholder}
                  pointerEvents='none'
                  numberOfLines={1}
                >
                  {t('enterAmount')}
                </MyText>
              )}
            </View>
            <MyText className='text-medium font-medium'>{symbol}</MyText>
          </GlassView>

          {/* Validation only matters while the card is still on screen — a
              broadcast supply can't be fixed by a red hint. Kept through
              CHECKING (not just while editable) so the reserved slot doesn't
              collapse the layout the instant the user taps Execute. */}
          {isPreSend && (
            <View style={styles.errorSlot}>
              {!!fieldError && (
                <MyText variant='small' className='text-red-text' style={styles.errorText}>
                  {fieldError}
                </MyText>
              )}
            </View>
          )}

          {/* Quick-pick chips + spendable line sit under the amount field.
              Gated with the error slot above, so the whole block leaves at the
              same moment the transaction is signed rather than mid-flow. */}
          {isPreSend && spendable != null && (
            <View style={styles.amountExtras}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickScroll}
                contentContainerStyle={styles.quickRow}
              >
                {QUICK_PERCENTS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    activeOpacity={0.7}
                    onPress={() => {
                      setAmount(spendableBn.times(p).div(100).decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed())
                      setTouched(true)
                    }}
                  >
                    <GlassView interactive style={styles.quickChip}>
                      <MyText variant='small' className=''>{p}%</MyText>
                    </GlassView>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.spendableRow}>
                <MyText className='text-medium'>{t('spendable')}:</MyText>
                <View style={styles.spendableValue}>
                  <MyTextTicker className='text-medium'>
                    {/* The NET figure — the same one the chips divide and the
                        validator allows, so the card never shows one ceiling and
                        enforces another. */}
                    {fmt(netSpendable)} {symbol}
                    {fmtUsd(netSpendableUsd) && (
                      <MyText variant='small' className='text-low'> (~{fmtUsd(netSpendableUsd)})</MyText>
                    )}
                  </MyTextTicker>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Est. Received — the one row each protocol fills in for itself. */}
        <View style={styles.fieldGroup}>
          <View className='flex flex-row'>
            <MyText variant='default' fontWeight='700'>{t('supplyEstReceived')}</MyText>
          </View>
          <View
            style={[styles.panelRow, {
              backgroundColor: '#CCD4FF0A'
            }]}>
            {/* `isEditable` lets a vault skip its preview read on a card that is
                settled or replaying from history — see `useSharePreview`.
                `estimate`/`onEstimate` let a protocol that QUOTES its figure
                (a vault) keep the last quote across that gap, instead of
                falling back to the deposited amount. */}
            <ReceivedRow
              amount={amount}
              validAmount={validAmount}
              isEditable={isEditable}
              estimate={estimate}
              onEstimate={setEstimate}
            />
          </View>
        </View>

        {/* Est. Earnings */}
        <View style={styles.fieldGroup}>
          <View className='flex flex-row'>
            <MyText variant='default' fontWeight='700'>{t('supplyEstEarnings')}</MyText>
          </View>
          <View style={styles.earningsBox} className='bg-input-field'>
            <View style={styles.earningsRow}>
              <MyText className='text-medium'>{t('supplyCurrentApy')}</MyText>
              <MyText className='font-medium'>
                {apy == null ? '—' : `${BigNumber(apy).toFixed(2)}%`}
              </MyText>
            </View>
            <View style={styles.earningsRow}>
              <View>
                <MyText className='text-medium'>{t('supplyEarningsPerYear')}</MyText>
              </View>
              <View
                style={{
                  flex: 1,
                  alignItems: 'flex-end'
                }}
              >

                <MyTextTicker className='font-medium'>
                  {earningsPerYear ? `~$${fmt(earningsPerYear, 2)}` : '—'}
                </MyTextTicker>
              </View>

            </View>
          </View>
        </View>

        {/* The x402 charge, stated before the user commits — the approval sheet
            is the second, authoritative confirmation. Only rendered once a real
            price is known, so a slow or unreachable spec shows nothing rather
            than a placeholder or an invented number.
            Kept up even when the fee for this amount is already settled: the
            price of the action has not changed, and the skip is silent (see
            `gate`) — the user simply isn't charged again on the retry. */}
        <View style={styles.submitBlock}>
          {isPreSend && !!x402Fee && (
            <MyText className='text-medium' style={styles.feeNotice}>
              {t('walletActionFeeNotice', { fee: formatFeeLabel(x402Fee, language) })}
            </MyText>
          )}

          {/* Stays mounted (disabled) through the pre-flight checks so the card
              doesn't lose its action while they run, then unmounts as soon as the
              first transaction is signed — from there the timeline below is what
              reports progress, and a dead button above it is just noise. */}
          {isPreSend && (
            <MyButton
              className='w-full'
              style={!canSubmit && styles.submitBtnDisabled}
              activeOpacity={0.8}
              disabled={!canSubmit}
              variant='primary'
              onPress={handleSubmit}
            >
              {/* Mentions a payment whenever the route is priced. A fee already
                  settled by an earlier attempt is deliberately NOT reflected here:
                  the label describes what the action costs, and the skip is a
                  silent saving on the retry rather than a change of price. An
                  unpriced route (or an unreachable price list) supplies free, so
                  promising to "Pay fee" there would be a lie; CHECKING is then
                  just the balance/gas pre-check, hence "Checking". */}
              <MyTextTicker fontWeight={700}>
                {busy
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

      {/* Approve → Sending → Waiting → Success/Failed.
          Hidden through IDLE and CHECKING: until something is actually signed
          there is no transaction to show, and mounting an empty timeline only to
          fill it a moment later made the card jump. The pre-flight reports
          itself on the button instead. */}
      {showTimeline && (
        <SupplyStatusTimeline
          step={step}
          approveHash={approveHash}
          supplyHash={supplyHash}
          error={error}
          language={language}
          chainId={chainId}
          walletAddress={walletAddress}
          onCopyHash={onCopyHash}
          received={received}
          // The settled result animates only when it settles in front of the
          // user; a card restored already-finished renders it statically.
          animate={settledLive}
          // A fixed value for the whole run: `TxStepIcon` captures it at mount,
          // so a prop that flipped as the flow advanced would make each newly
          // mounted node animate differently from the ones above it.
          animateIntro={animateIntro}
        />
      )}

      {/* x402 approval for the backend authorization call. Opens during the
          pre-send checks, before the approval transaction; cancelling resolves
          the gate with no signature, which aborts the whole sequence before
          anything is signed or broadcast. */}
      <X402SignModal
        request={x402Req}
        walletAddress={walletAddress}
        onResolve={handleX402Resolve}
        screenRef={screenRef}
      />
    </View>
  )
}
