import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Keyboard, Platform, TextInput } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
// ScrollView from react-native-gesture-handler: it scrolls inside the gorhom
// sheet on Android (a plain RN ScrollView doesn't) AND, unlike gorhom's
// BottomSheetScrollView, its ref is a normal RN ScrollView with working
// scrollTo/scrollToEnd (needed for the keyboard auto-scroll below).
import { ScrollView } from 'react-native-gesture-handler'
import { KeyboardController, AndroidSoftInputModes } from 'react-native-keyboard-controller'
import BigNumber from 'bignumber.js'

import styles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyNumber from 'frontend/Components/UI/MyNumber'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import AutoFitAmountInput from '../Exchange/Components/AutoFitAmountInput'

import images from 'assets/Image'
import I18n from 'assets/Lang'
import { Colors, pixelByHeight } from 'common/styles'
import { formatInputNumberDecimal } from 'common/function'
import { getUrlExplorerHash } from 'common/chain'

import useDebounceValue from 'frontend/Hooks/useDebounceValue'

import { CircleButton, Field, HintRow } from './Components/FieldParts'
import MarketHeader from './Components/MarketHeader'
import WithdrawSteps from './Components/WithdrawSteps'
import useWithdrawFlow, { WITHDRAW_STEP, isBusyStep } from './useWithdrawFlow'
import {
  useWithdrawMarket,
  useWithdrawState,
  useWithdrawPreviewShares,
  useWithdrawFeeCheck
} from './useWithdrawQueries'
import { assetDecimalsOf, fromUnits } from './withdrawChecks'
import { SUPPORTED_WITHDRAW_TYPES, isShareBasedType } from './abis'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'

// Withdraw from a lending position.
//
// Reachable from TokenDetailScreen for any token the API tagged with a
// `yieldProtocol` AND whose market the core could resolve — the market is what
// says which of the five protocol families the position belongs to, and each
// takes a different call.
//
// DELIBERATELY NOT USDC-SPECIFIC. The CoinPool app this mirrors withdraws USDC
// only, so it can read the chain's stablecoin from a static per-chain map. Here
// the underlying is whatever `market.asset` reports — read on chain by core —
// so an aWETH position on Base withdraws WETH with WETH's own decimals, and any
// chain in `blockchainListRedux` works because every read and the broadcast go
// through the app's own ordered-RPC layer.

// NOTE: every amount here is rendered at FULL precision, never rounded or
// truncated to a fixed number of decimals. These are amounts the user is about
// to move: a shortened figure understates what they hold and stops agreeing
// with the value the Max button fills in.
//
// Two renderers, for two jobs:
//   - the amount / refund FIELDS use AutoFitAmountInput, which keeps a fixed
//     base font and scales the value down to fit the row (see minScale={0});
//   - the balance LINE uses MyNumber, for its thousand-grouping and its
//     smaller-decimal treatment. Its `fractionDigits={null}` is load-bearing —
//     see the comment at that call site.

// Delay before a typed amount reaches the share-preview read. Matches the
// Exchange / SwapAndSend drawers on this screen, which debounce their own
// quote requests by the same amount.
const PREVIEW_DEBOUNCE_MS = 500

const WithdrawToken = ({ _this }) => {
  const { token, lendingInfo, walletAddress, chainId, nfcProxy } = _this.withdrawContext || {}

  // The market as core resolved it — the identity every read and the tx encoding
  // below are keyed on.
  const market = useWithdrawMarket(lendingInfo, token)

  // The underlying being withdrawn — NOT assumed to be USDC or the token shown.
  const asset = market?.asset || null
  const assetSymbol = asset?.symbol || lendingInfo?.assetSymbol || ''
  // The UNDERLYING's icon, looked up in Pantograph by core. Falls back to the
  // receipt token's: they are the same asset either side of the wrapper, so a
  // token Pantograph doesn't index still gets a recognisable image rather than
  // the unknown-token placeholder. Null on both → TokenIconWithChain's own
  // placeholder.
  const assetIconUrl = asset?.logo || token?.iconUrl
  // Validated, never defaulted: core reports an unresolvable asset as NaN
  // decimals, and `?? 18` would neither catch that nor be right for a 6-decimal
  // vault. Null propagates into `isSupported` below, which disables the form.
  const assetDecimals = assetDecimalsOf(asset)
  // Whether the RECEIPT is denominated in something other than the underlying —
  // true for ERC-4626 vaults and for cross-chain sUSDS alike. The refund row and
  // its share scale key on this, not on `isVaultType`: sUSDS is share-based
  // without being 4626, and gating on the narrower test showed its refund row at
  // 1:1 with the typed amount.
  const isShareBased = isShareBasedType(market?.type)

  // Shares carry the VAULT's own decimals (usually 18), which are NOT the
  // underlying's (6 for USDC) — the "Refund amount" row is denominated in these,
  // so mixing the two would misreport it by orders of magnitude. The vault IS the
  // receipt token the screen is showing, so its own decimals are the right scale.
  const shareDecimals = Number.isInteger(Number(token?.decimals))
    ? Number(token.decimals)
    : assetDecimals

  // A market we cannot encode a call for — or cannot size, because its
  // underlying never resolved — must not offer a submit button.
  const isSupported =
    !!market && SUPPORTED_WITHDRAW_TYPES.includes(market.type) && assetDecimals !== null

  const [amount, setAmount] = useState('')
  // True only while the field holds the exact maximum. It is what selects the
  // "withdraw all" encoding, and it is cleared by any manual edit — so a user
  // who taps Max and then deletes a digit gets an ordinary partial withdrawal.
  const [isMax, setIsMax] = useState(false)

  // Closed drawer → stop the receipt poll (see useWithdrawFlow).
  const closedRef = useRef(false)
  useEffect(() => () => { closedRef.current = true }, [])

  // Android: while this drawer is mounted, tell the window to leave itself alone when the
  // keyboard opens (ADJUST_NOTHING) — the sheet stays perfectly put and OUR content scroll
  // below is the only thing that moves the focused input into view. setDefaultMode() hands
  // the window back to the app default (adjustPan) on unmount. Same pattern as SendToken.
  // No-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING)
    return () => KeyboardController.setDefaultMode()
  }, [])

  const scrollRef = useRef(null)
  // Live scroll offset, tracked via onScroll — the keyboard effect scrolls by a delta.
  const scrollOffsetRef = useRef(0)
  // Keyboard handling (mirrors SendToken): nothing auto-scrolls the focused input above the
  // keyboard inside the gorhom sheet, so we do it — reserve paddingBottom = keyboard height
  // for room, then scroll the focused input up ONLY when it is actually covered. The sheet
  // itself never moves (keyboardBehavior 'extend' + Android ADJUST_NOTHING); only the
  // content scrolls.
  const [kbPad, setKbPad] = useState(0)
  useEffect(() => {
    const isIOS = Platform.OS === 'ios'
    const showEvt = isIOS ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = isIOS ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, (e) => {
      const keyboardTop = e.endCoordinates?.screenY ?? 0
      setKbPad(e.endCoordinates?.height ?? 0)
      const focused = TextInput.State?.currentlyFocusedInput?.()
      if (!focused?.measureInWindow) return
      focused.measureInWindow((x, y, w, h) => {
        // Generous margin: measureInWindow (window coords) can sit below endCoordinates
        // .screenY (screen coords) by the status-bar height, so a small margin could
        // under-scroll and leave the input at the keyboard edge.
        const overlap = (y + h + pixelByHeight(40)) - keyboardTop
        if (overlap <= 0) return // input already above the keyboard
        // Defer so the reserved padding (setKbPad above) has grown the content first —
        // both platforms need the room before scrollTo, otherwise it clamps at the old
        // (shorter) max offset. iOS overlays the keyboard (no resize), so the padding is
        // its only source of scroll room.
        setTimeout(() => {
          scrollRef.current?.scrollTo?.({ y: scrollOffsetRef.current + overlap, animated: true })
        }, 50)
      })
    })
    const hideSub = Keyboard.addListener(hideEvt, () => setKbPad(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  // The position — balance, shares, and the Aave health-factor ceiling. No price
  // is passed: a debt-constrained ceiling is sized against Aave's own oracle,
  // read on chain alongside the rest of the position.
  const { state, loading: loadingState, refetch: loadState } = useWithdrawState({
    chainId,
    market,
    owner: walletAddress
  })

  // Gas, asked as soon as the position lands rather than at submit. A wallet
  // holding this position and no native coin cannot withdraw at all, and that is
  // true before the user types anything — so it is said up front, in the same
  // slot and the same words the submit-time check would eventually use.
  const { feeError } = useWithdrawFeeCheck({
    chainId,
    market,
    owner: walletAddress,
    asset,
    state
  })

  const {
    step,
    hash,
    error: flowError,
    execute
  } = useWithdrawFlow({
    market,
    asset,
    walletAddress,
    chainId,
    nfcProxy,
    isCancelled: () => closedRef.current,
    // A settled withdrawal changes the position, so re-read it — the balance
    // line and the ceiling both move.
    //
    // The amount is deliberately LEFT IN PLACE. On success the form is dimmed
    // behind the result timeline and the button is greyed out, so it reads as the
    // record of what was withdrawn; on failure the user needs the value they typed
    // still there to adjust and retry, and wiping it would make them re-enter the
    // whole thing.
    onResult: ({ success }) => {
      if (!success) return
      loadState()
    }
  })

  const busy = isBusyStep(step)

  // Pre-submit validation only speaks to an amount the user can still change.
  // Once a run has started it stops being true of anything they can act on: a
  // settled withdrawal re-reads the position, so emptying it turns "Insufficient
  // balance" and "nothing to withdraw" on over a form that is dimmed, locked and
  // reporting Success just below — a failure notice for the thing that worked.
  // ERROR is exempt: the form comes back editable there, so its guidance applies
  // again.
  const showFormValidation = step === WITHDRAW_STEP.IDLE || step === WITHDRAW_STEP.ERROR

  // The timeline renders BELOW the form, so on a short screen a run that has
  // just started is off-view — the user taps Withdraw and nothing visibly
  // happens. Every step change pulls the view to the bottom so the stage the
  // flow reached (and, at the end, the hash and the outcome) is what they see.
  //
  // IDLE is excluded: that is the pre-submit state and a reset, neither of which
  // has a timeline to show. The deferral lets the newly-rendered step row land
  // first, so the scroll targets the real content height rather than the
  // previous one.
  //
  // `hash` is a trigger in its OWN right, not just a step side-effect: it is set
  // after the broadcast returns while the step stays on WITHDRAWING for the whole
  // receipt wait, so the hash row appears with no step change behind it. Keyed on
  // step alone, the one line the user most wants during the wait — the tx they can
  // copy and open in an explorer — would grow the timeline off-screen unnoticed.
  useEffect(() => {
    if (step === WITHDRAW_STEP.IDLE) return
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd?.({ animated: true })
    }, 50)
    return () => clearTimeout(id)
  }, [step, hash])

  /**
   * The ceiling the form enforces.
   *
   * `safeMax` is set only when the position is collateral for an Aave loan, in
   * which case taking everything would liquidate the user — so it caps the field
   * below the raw balance. Everywhere else the balance itself is the ceiling.
   */
  const maxAmount = useMemo(() => {
    if (!state?.balance) return '0'
    if (state.safeMax === null || state.safeMax === undefined) return state.balance
    return BigNumber(state.safeMax).lt(state.balance) ? state.safeMax : state.balance
  }, [state])

  const hasBalance = BigNumber(state?.balance || 0).gt(0)

  // "Withdraw all" is only true when the amount is the whole POSITION — not
  // merely the whole allowance the health factor permits. A debt-capped max is a
  // partial withdrawal however the user arrived at it, so it must not be encoded
  // with the protocol's "all" sentinel, which would try to take the lot.
  const isWithdrawAll = useMemo(() => {
    if (!isMax || !hasBalance) return false
    return BigNumber(maxAmount).gte(state?.balance || 0)
  }, [isMax, hasBalance, maxAmount, state])

  // Typing must not fire an RPC read per keystroke: the preview below is keyed on
  // the amount, so it is the debounced value that reaches it. 500ms matches the
  // Exchange/SwapAndSend drawers on this screen.
  //
  // A full exit is exempt — its share figure comes from the position itself, not
  // from a preview — and so is a Max tap, which sets the field in one go rather
  // than a keystroke at a time. Feeding those through the delay would leave the
  // row visibly lagging a value the user did not type.
  const debouncedAmount = useDebounceValue(amount, PREVIEW_DEBOUNCE_MS)
  const previewAmount = isMax ? amount : debouncedAmount

  // Refund row: how much of the RECEIPT token the withdrawal burns. For a
  // rebasing receipt (Aave, Compound) that is 1:1 with the amount, so no read is
  // needed at all. Vaults are share-based, so the vault itself is asked — except
  // for a full exit, where the share balance already IS the answer.
  const { shares: previewShares, loading: loadingPreview } = useWithdrawPreviewShares({
    chainId,
    market,
    amount: previewAmount,
    decimals: assetDecimals,
    shareBalance: state?.shares ?? null,
    enabled: !isWithdrawAll
  })

  const refundShares = isWithdrawAll ? (state?.shares ?? null) : previewShares
  // Also true during the debounce window itself: the amount has changed but the
  // read has not started, and showing the previous amount's share figure there
  // would be wrong in exactly the way the spinner exists to avoid.
  const refundPending = isShareBased && !isWithdrawAll &&
    (loadingPreview || (!!amount && amount !== previewAmount))

  const onChangeAmount = (value) => {
    // Any manual edit takes the field off Max, so it stops meaning "everything".
    setIsMax(false)
    // Some keyboards / locales emit a comma as the decimal separator; the app
    // only supports '.', so normalize before parsing (matches SendToken).
    const normalized = String(value ?? '').replace(/,/g, '.')
    // `formatInputNumberDecimal` returns its input UNCHANGED when it isn't a
    // finite number, so on its own it lets '1.2.3', '-5' and pasted letters
    // straight into state: the field then shows junk the submit guard silently
    // rejects, with no error to explain the dead button. Strip to digits and a
    // single dot first, so only a well-formed decimal can ever be held.
    // Keep the FIRST dot and drop any later ones — '1.2.3' becomes '1.23'.
    // the withdrawal by ten off a single stray keystroke.
    // Dropping the first instead would turn it into '12.3', silently multiplying
    const digitsAndDots = normalized.replace(/[^\d.]/g, '')
    const firstDot = digitsAndDots.indexOf('.')
    const sanitized = firstDot === -1
      ? digitsAndDots
      : `${digitsAndDots.slice(0, firstDot + 1)}${digitsAndDots.slice(firstDot + 1).replace(/\./g, '')}`
    // With no resolved scale the field is unreachable anyway (the form is
    // disabled), so cap the fraction at 18 rather than pass null through.
    setAmount(formatInputNumberDecimal(sanitized, assetDecimals ?? 18))
  }

  const onPressMax = () => {
    if (busy || loadingState || !hasBalance) return
    setAmount(maxAmount)
    setIsMax(true)
  }

  const amountError = useMemo(() => {
    if (!amount) return null
    const parsed = BigNumber(amount)
    if (!parsed.isFinite() || parsed.lte(0)) return null
    if (parsed.gt(state?.balance || 0)) return I18n.t('v2.withdrawToken.insufficientBalance')
    // Over the health-factor ceiling but within the balance: a different problem
    // with a different fix, so it gets its own message.
    if (state?.hasDebt && BigNumber(maxAmount).lt(parsed)) {
      return I18n.t('v2.withdrawToken.exceedsSafeMax')
    }
    return null
  }, [amount, state, maxAmount])

  /**
   * The one line the error slot shows.
   *
   * The AMOUNT's own error wins when there is one: it is the problem the user
   * can fix from this screen, in the field their cursor is already in. The fee
   * warning is about the wallet, not the form, so it takes the slot only when
   * the amount itself is fine — and it shows with an empty field too, which is
   * the point of checking at open.
   */
  const displayError = amountError || feeError

  const disabled = useMemo(() => {
    // Settled run: there is nothing left to submit — the amount in the field has
    // already been withdrawn. The button stays on screen, greyed, as the record
    // of what just happened; the drawer is left via its own dismiss control.
    if (step === WITHDRAW_STEP.DONE) return true
    if (busy || loadingState || !isSupported || !hasBalance) return true
    if (amountError) return true
    // Short of gas → nothing to submit. The submit-time check would stop this
    // anyway, but only after a tap, a spinner, and an RPC round-trip that was
    // always going to end here.
    if (feeError) return true
    const parsed = BigNumber(amount)
    return !parsed.isFinite() || parsed.lte(0)
  }, [step, busy, loadingState, isSupported, hasBalance, amountError, feeError, amount])

  /**
   * The one button drives the whole flow, so what it does depends on where the
   * run got to:
   *   ERROR → retry straight away. The form came back editable and the amount
   *           the user typed is still in the field, so this submits it again
   *           (with whatever they just changed) rather than costing them a
   *           second tap to clear the failed run first.
   *   else  → submit.
   *
   * DONE has no branch: the button is disabled there (see `disabled`), so the
   * press never arrives. The drawer is closed with its own dismiss control.
   */
  const onPressSubmitButton = () => {
    if (disabled) return
    // Close the keyboard before the run starts: the form dims behind the result
    // timeline, so a keyboard left up would cover the very steps it reports.
    Keyboard.dismiss()
    // No reset() needed for a retry: `execute` already clears the previous run's
    // hash and error before it starts, and `fail()` released the in-flight guard
    // when the run errored.
    execute(amount, isWithdrawAll)
  }

  const onCopyHash = () => {
    if (!hash) return
    // The explorer URL rather than the bare hash: that is what the user actually
    // wants to paste, and it matches what the Send drawer copies.
    Clipboard.setString(getUrlExplorerHash(hash, chainId) || hash)
    _this.showAlert?.(
      I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }),
      '',
      { type: 'toast' }
    )
  }

  // ---- Render helpers ------------------------------------------------------

  const renderBalanceLine = () => (
    <View style={styles.balanceRow}>
      <MyText style={{ color: Colors.TEXT_MEDIUM }}>
        {I18n.t('v2.withdrawToken.withdrawable')}
      </MyText>
      {loadingState
        ? <MyDotsLoading source={images.threeDotsWhiteLoading} />
        : (
          // FULL precision, deliberately. This is a balance the user is about to
          // act on, so every digit they hold has to be visible — a truncated
          // figure would understate the position and, worse, disagree with the
          // amount the Max button fills in.
          //
          // `null`, NOT `undefined`: MyNumber declares `fractionDigits = 2` as a
          // DEFAULT PARAMETER, and defaults fire on undefined — so passing
          // undefined silently means "2 decimals", which rendered a 0.00004 WETH
          // balance as a flat "0". `null` skips the default and fails MyNumber's
          // `Number.isFinite` guard, which is what selects its keep-every-digit
          // path.
          // `maxAmount`, NOT `state.balance` — this line is labelled
          // "Withdrawable", so it must report what can ACTUALLY be taken out.
          // With a loan open against the position that is the health-factor
          // ceiling, well below the supplied balance; showing the balance there
          // both overstates it and disagrees with the figure the Max button
          // fills in, which is the same `maxAmount`.
          <MyNumber
            ticker
            value={maxAmount}
            fractionDigits={8}
            suffix={assetSymbol ? ` ${assetSymbol}` : ''}
            className='text-medium'
          />
        )}
    </View>
  )

  const renderAmountField = () => (
    <>
      <MyText variant='subTitle' className='text-medium' style={styles.sectionTitle}>
        {I18n.t('v2.withdrawToken.withdrawalAmount')}
      </MyText>
      {/* The UNDERLYING's icon — this row is denominated in the asset the user
          RECEIVES (USDC, WETH), not in the aToken / vault share they hold, so it
          has to carry the underlying's image. Core resolves it from Pantograph
          and falls back to the receipt token's when Pantograph doesn't know it. */}
      <Field
        leftIcon={<TokenIconWithChain tokenIconUri={assetIconUrl} chainId={chainId} style={styles.tokenIcon} />}
        rightButton={(
          <CircleButton
            label={I18n.t('v2.withdrawToken.max')}
            onPress={busy || loadingState || !hasBalance ? null : onPressMax}
          />
        )}
      >
        {/* minScale={0} matches the Send drawer: the value ALWAYS shrinks to fit
            rather than stopping at a readability floor and overflowing. That
            matters more here than there — a full-precision 18-decimal balance is
            the longest string this field can hold. */}
        <AutoFitAmountInput
          value={amount}
          onChangeText={onChangeAmount}
          keyboardType='numeric'
          minScale={0}
          disabled={busy}
          placeholder={I18n.t('v2.withdrawToken.amountPlaceholder')}
          placeholderStyle={styles.amountPlaceholder}
          textStyle={styles.amountInput}
        />
      </Field>
      {renderBalanceLine()}
      {/* Fixed-height reserve, so an error appearing or clearing never shifts the
          refund field below it (see `amountErrorSpace`). */}
      <View style={styles.amountErrorSpace}>
        {showFormValidation && !!displayError && (
          <HintRow
            className='text-red'
            text={displayError}
          />
        )}
      </View>
    </>
  )

  /**
   * The refund row's value cell: a spinner while a share preview is pending, the
   * figure once it lands, the placeholder when there is nothing to show.
   *
   * Rendered at FULL precision — this is the exact number of receipt tokens
   * leaving the wallet, so no digit of it is ours to drop.
   */
  const renderRefundValue = (value) => {
    if (refundPending) {
      return (
        <View style={styles.refundLoading}>
          <MyDotsLoading variant='small' source={images.threeDotsWhiteLoading} />
        </View>
      )
    }
    if (!value) {
      return (
        <MyText style={styles.amountRefundPlaceholder} numberOfLines={1}>
          0
        </MyText>
      )
    }
    // Read-only, but rendered through the SAME auto-fit input as the editable
    // field above so both rows share one type size and one shrink behaviour — a
    // plain Text here would sit at a fixed size and overflow on a long value
    // while the field above scaled to fit.
    //
    // `disabled` (not a Text) keeps the two visually identical; the value is
    // derived, so there is no onChangeText.
    return (
      <AutoFitAmountInput
        value={value}
        onChangeText={() => {}}
        disabled
        minScale={0}
        textStyle={styles.amountInput}
      />
    )
  }

  const renderRefundField = () => {
    // Share-based receipt (a vault, or cross-chain sUSDS) → a SHARE figure at
    // the receipt's own decimals. Rebasing receipt (Aave / Compound) → 1:1 with
    // the amount, so no conversion at all.
    //
    // Full precision: `fromUnits` does not round, and the auto-fit input scales
    // whatever length that produces rather than truncating it.
    const value = isShareBased
      ? (refundShares === null ? '' : fromUnits(refundShares, shareDecimals))
      : amount

    return (
      <>
        {/* No top margin: the 49px error reserve directly above already IS the
            gap (see `sectionTitleAfterError`). */}
        <MyText
          variant='subTitle'
          className='text-medium'
          style={[styles.sectionTitle, styles.sectionTitleAfterError]}
        >
          {I18n.t('v2.withdrawToken.refundAmount')}
        </MyText>
        <Field
          leftIcon={<TokenIconWithChain tokenIconUri={token?.iconUrl} chainId={chainId} style={styles.tokenIcon} />}
          // Names the RECEIPT token being burned — deliberately `token.symbol`,
          // not the underlying's. For a vault this row is a SHARE figure
          // (gtusdcf), which is a different unit and a different magnitude from
          // the USDC above it; unlabelled, the two numbers read as though they
          // disagree. Sits in the same slot the amount field gives its Max
          // button, so both rows keep one layout.
          rightButton={
            token?.symbol
              ? (
                <MyText className='text-white' style={styles.fieldSuffix}>
                  {token.symbol}
                </MyText>
              )
              : null
          }
        >
          {renderRefundValue(value)}
        </Field>
      </>
    )
  }

  const submitLabel = useMemo(() => {
    // DONE keeps the "Withdraw" label (greyed) rather than switching to a "Done"
    // that closes the drawer — the button reads as the action that was performed,
    // not as a second, different control appearing where the first one was.
    if (step === WITHDRAW_STEP.ERROR) return I18n.t('v2.withdrawToken.tryAgain')
    return I18n.t('v2.withdrawToken.withdraw')
  }, [step])

  // An empty field has nothing to submit, so the header stays bare until the user
  // has actually typed an amount.
  //
  // Keyed on `!amount` alone, NOT on `disabled`. A typed-but-rejected amount (over
  // the balance, over the health-factor ceiling) keeps the button on screen,
  // greyed, beside the red line that says why — pulling it out from under the user
  // at the same moment the error appears reads as the drawer breaking rather than
  // as a value to fix.
  //
  // Only in the pre-submit states. Once a run starts the button is the spinner,
  // and at DONE it is the greyed record of the withdrawal that just ran — neither
  // may be hidden by a field this flow deliberately never clears.
  const hideSubmitButton =
    !amount && (step === WITHDRAW_STEP.IDLE || step === WITHDRAW_STEP.ERROR)

  // The action lives in the drawer header (same slot Exchange uses for Execute),
  // so it stays reachable without scrolling past the form and the timeline.
  const renderSubmitButton = () => {
    if (hideSubmitButton) return null
    return (
      <MyButton
        variant='primary'
        label={submitLabel}
        isLoading={busy}
        // No state is exempt from `disabled` any more: ERROR re-submits, so it obeys
        // the same validation as a first attempt (retrying an amount that exceeds
        // the balance would only fail again), and DONE has nothing left to submit.
        isDisable={disabled}
        onPress={onPressSubmitButton}
      />
    )
  }

  // When the form is dimmed and untouchable:
  //
  //   - while the POSITION is still loading — there is no balance to size an
  //     amount against yet, so typing one would only be validated against
  //     nothing;
  //   - while a withdrawal is IN FLIGHT — a stray tap must not edit an amount
  //     that is already being signed; and
  //   - once it is DONE — the run is settled and the button is greyed out.
  //     Leaving the field live there would invite an edit that can no longer be
  //     submitted, against a balance that has just changed under it.
  //
  // ERROR is the one settled state that does NOT lock: it hands the form back so
  // the user can adjust the value they typed and retry.
  const isFormLocked = loadingState || busy || step === WITHDRAW_STEP.DONE

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <TitleDrawer
        leftIcon={images.UIV2.icons.withdraw}
        absolute
        hasBlur
        title={I18n.t('v2.withdrawToken.title')}
        rightElement={renderSubmitButton()}
      />
      {/* The sheet stays anchored (keyboardBehavior 'extend' + Android ADJUST_NOTHING);
          the keyboard effect above reserves kbPad and scrolls the focused input above
          the keyboard. */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, kbPad ? { paddingBottom: kbPad } : null]}
        keyboardShouldPersistTaps='handled'
        onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent?.contentOffset?.y ?? 0 }}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        <View
          style={isFormLocked ? styles.dimmedForm : null}
          pointerEvents={isFormLocked ? 'none' : 'auto'}
        >
          <MarketHeader
            token={token}
            lendingInfo={lendingInfo}
            contract={market?.contract}
            chainId={chainId}
          />
          {renderAmountField()}
          {renderRefundField()}
        </View>

        {/* The timeline stays visible for the whole run INCLUDING the settled
            states — it is what reports the hash and the outcome, so it must
            outlive the dimming above. */}
        {/* Stays visible through the settled states — it is what reports the
            hash and the outcome, so it must outlive the form dimming above. */}
        <WithdrawSteps
          step={step}
          hash={hash}
          error={flowError}
          busy={busy}
          chainId={chainId}
          walletAddress={walletAddress}
          onCopyHash={onCopyHash}
        />
      </ScrollView>
    </MyViewPage>
  )
}

export default WithdrawToken
