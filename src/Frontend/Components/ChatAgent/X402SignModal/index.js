import React, { useState, useCallback, useEffect, useRef } from 'react'
import BigNumber from 'bignumber.js'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { View } from 'react-native'
import { ANIMATION_DRAWER } from 'common/constants/drawer'
import { Colors, getSizeImgSquare, pixelByHeight } from 'common/styles'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import Spinner from 'frontend/Components/Common/Spinner'
import { signX402 } from './signX402'
import usePaymentBalance from './usePaymentBalance'
import usePaymentToken from './usePaymentToken'
import styles from './styles'

// Truncate (never round up) to `d` places and group the digits — the same
// BigNumber formatter the other chat-agent widgets use, so an amount reads
// identically here and in the send/liquidity forms.
const fmt = (n, d = 8) => {
  const bn = BigNumber(String(n))
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

// `display.amount` arrives ALREADY scaled by the token's on-chain decimals() —
// the core reads symbol()/decimals() via multicall — so this only groups the
// digits and never re-divides.
//
// The symbol is NOT appended: the token icon sits beside this figure and the
// Spendable line below states it, so repeating it here only crowds the number.
// The exception is a token the core could not read (`decimals: null`), where the
// value is the RAW smallest-unit amount — showing that bare would read as a
// price that is wildly wrong, so it stays explicitly labelled.
const fmtAmount = (display) => {
  const { amount, asset, decimals } = display
  if (amount == null || amount === '') return ''
  if (decimals == null) return `${amount}${asset ? ` ${asset}` : ''} (raw)`.trim()
  // Keep every significant digit of a sub-cent price rather than rounding it to
  // 0, but never ask BigNumber for more places than the token actually has.
  return fmt(amount, Math.min(decimals, 18))
}

// How much of the FEE token the transaction being authorized is itself sending,
// in the fee token's smallest unit — or null when the two are unrelated.
//
// The fee and the transfer only collide when they are the same token on the same
// chain: sending 100 USDC while the x402 charge is also in USDC means one
// balance funds both, and the fee has to come out of what is left. Sending ETH
// while paying a USDC fee draws on two separate balances and reserves nothing.
//
// `spend` is `{ chainId, assetAddress, amount }` where `amount` is the HUMAN
// figure the user typed. It is scaled here, by `display.decimals` — the token's
// real on-chain `decimals()`, read by the core — and deliberately NOT by the
// form's own idea of the token's scale: the agent's `decimals` can be absent, in
// which case the form falls back to 18, and scaling 100 USDC (6dp) by 18 would
// reserve a trillion times the real amount and block a payment the user can
// easily afford. Since a deduction only happens for the SAME contract, the fee's
// decimals are by definition the right ones for the sent amount too.
const matchedSpendRaw = (spend, display) => {
  if (!spend || !display) return null
  const { chainId, assetAddress, amount } = spend
  if (amount == null || amount === '' || !assetAddress || !display.assetAddress) return null

  // Numeric compare: the challenge's chain id is decimal, the form's may be the
  // agent's hex ("0xa"), and a string compare would call those different and
  // skip a deduction that is actually needed.
  //
  // Both sides are checked for a real number FIRST. `display.chainId` is
  // explicitly nullable — the core leaves it null when it could not resolve the
  // chain — and `Number(null)` is 0, which would compare equal to a 0 from the
  // other side and reserve against a chain neither side actually identified.
  const feeChain = Number(display.chainId)
  const spendChain = Number(chainId)
  if (display.chainId == null || chainId == null) return null
  if (!Number.isFinite(feeChain) || !Number.isFinite(spendChain)) return null
  if (feeChain !== spendChain) return null

  if (String(assetAddress).toLowerCase() !== String(display.assetAddress).toLowerCase()) return null

  // No on-chain scale means the core could not read the token, and `amountRaw`
  // below would be scaled by a guess. usePaymentBalance already refuses to judge
  // a `decimals: null` challenge (it reports 'unknown'), so reserving nothing
  // here changes no verdict — it just avoids inventing a figure.
  if (display.decimals == null) return null

  const raw = BigNumber(String(amount))
    .shiftedBy(Number(display.decimals))
    // Whole smallest-units only — a fractional wei is not a real amount, and
    // ROUND_DOWN keeps this a reservation we know is not overstated.
    .decimalPlaces(0, BigNumber.ROUND_DOWN)
  // A blank or half-typed amount reserves nothing rather than NaN.
  if (!raw.isFinite() || raw.lte(0)) return null
  return raw.toFixed()
}

/**
 * The drawer's CONTENT — a payment notice, not a form: the fee token's icon and
 * the amount as the one big number, what's spendable, then pay/cancel.
 *
 * Deliberately height-free (no fixed height, no flex:1) so the hosting
 * BottomSheetView measures it and the sheet auto-fits: an unreadable balance
 * drops the Spendable line and the drawer is shorter to match.
 *
 * Owns the signing/error state itself. `openDrawer` SNAPSHOTS the element it is
 * given, so state lifted to the parent would never reach the mounted sheet
 * without re-pushing the whole drawer on every keystroke of it; keeping it here
 * means the drawer is pushed exactly once per request.
 */
const X402SignContent = ({ request, walletAddress, onSettle, onClose, nfcProxy }) => {
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')
  const display = request?.display || {}
  // Resolved by the core from the challenge, for either protocol version.
  const chainId = display.chainId

  // Icon + USD price for the fee token, from the Keyring catalog in one request.
  // The icon falls back to the unknown-token placeholder inside
  // TokenIconWithChain; the price drives the `(~$…)` estimate below.
  const { iconUrl, priceUSD } = usePaymentToken(chainId, display.assetAddress)

  // How much of the FEE token this transaction is itself about to move. Non-zero
  // only when the action sends the very token the fee is charged in (a USDC send
  // whose x402 charge is also in USDC) — then one balance has to cover both, and
  // the fee must be judged against what remains after the transfer. `spend`
  // describes the outgoing transfer and is supplied by the form that knows it;
  // the match is made here, where the fee's own token is finally known.
  const reservedRaw = matchedSpendRaw(request?.spend, display)

  // Does this wallet actually hold enough of the fee token to settle the charge,
  // once anything already committed to the transfer is set aside?
  const { status: balanceStatus, balance, reserved } = usePaymentBalance(display, walletAddress, reservedRaw)
  const insufficient = balanceStatus === 'insufficient'
  // Only a POSITIVELY-READ shortfall blocks. 'unknown' (unknown chain, RPC down)
  // leaves the button enabled — the facilitator is the real authority, and a
  // flaky RPC must not stop a payment the user can afford.
  const blocked = insufficient

  const approve = useCallback(async () => {
    setError('')
    setSigning(true)
    try {
      // Last-moment re-check of the transaction this payment is FOR, on the tap
      // itself. The caller already pre-flighted it (gas estimate + fee vs
      // balance), but that ran before this sheet opened, and the sheet then sat
      // here for as long as the user took to read it — unbounded, and the
      // longest wait in the flow. Gas and the wallet balance move meanwhile, so
      // the earlier verdict may no longer hold. Both must pass — the pre-flight
      // AND this — or the fee buys a transaction that then fails on-chain.
      //
      // Runs BEFORE signX402, so a failure costs nothing: no signature, no
      // payment, no gas.
      if (request?.verify) {
        const stale = await request.verify()
        if (stale) {
          // Settle with the reason rather than a bare null: to the gate a null
          // means "the user declined", which this is not, and the send would
          // then report the wrong cause. Closing is right — re-tapping Pay
          // would only re-run a check that just failed; the retry belongs on
          // the widget's own Retry, which rebuilds the whole flow.
          setSigning(false)
          onSettle({ error: stale })
          onClose()
          return
        }
      }

      // `request.onKey` is the send flow's `lendKey`, plumbed through by the form
      // that opened this sheet. Passing it on means a keycard user scans ONCE for
      // the payment and the transaction it authorizes, instead of twice.
      const signature = await signX402(request.typedData, walletAddress, nfcProxy, request.onKey)
      setSigning(false)
      onSettle(signature)
      onClose()
    } catch (e) {
      // Stay open on a failed signature so the user can read why and retry —
      // the core is still awaiting, so closing here would strand it.
      setSigning(false)
      setError(e?.message || I18n.t('v2.x402.couldNotSign'))
    }
  }, [request, walletAddress, onSettle, onClose, nfcProxy])

  const cancel = useCallback(() => {
    // Signing is already in flight and can't be taken back — ignore the tap.
    if (signing) return
    onSettle(null)
    onClose()
  }, [signing, onSettle, onClose])

  // Fiat worth of the spendable balance. Only shown when BOTH a balance and a
  // price were actually read — an estimate built on a missing price would be
  // "~$0.00" beside a balance that is worth something.
  const spendableUsd = balance != null && priceUSD != null
    ? BigNumber(balance).multipliedBy(priceUSD)
    : null

  // "Spendable: 5,254.94 USDC (~$5,254.94)" under the amount. Hidden entirely
  // when the balance could not be read — a blank or guessed figure next to a
  // price the user is about to pay would be worse than no line at all.
  //
  // The figure is NET of anything the transfer already claimed of this same
  // token — "spendable" meaning what is left for the FEE, which is what this
  // sheet is about. The label stays plain either way; the shortfall message
  // below is where the deduction gets explained, and only when it actually
  // costs the user something.
  const renderSpendable = () => {
    if (balanceStatus === 'unknown') return null
    return (
      <View style={styles.spendableRow}>
        <MyText className='text-medium'>
          {`${I18n.t('chatAgent.spendable')}:`}
        </MyText>
        {balanceStatus === 'loading' ? (
          <Spinner size={getSizeImgSquare('small')} type='Wave' color={Colors.TEXT_MEDIUM} />
        ) : (
          <MyText numberOfLines={1}>
            <MyText
              className='text-medium'
            >
              {`${fmt(balance, 6)} ${display.asset || ''}`.trim()}
            </MyText>
            {spendableUsd != null && (
              <MyText variant='small' className='text-low'>
                {` (~$${fmt(spendableUsd, 2)})`}
              </MyText>
            )}
          </MyText>
        )}
      </View>
    )
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('v2.wcPay.confirmation')}
        leftIcon={images.UIV2.icons.payConfirm}
      />

      <View
        style={{
          gap: pixelByHeight(12)
        }}
      >
        <MyText variant='subTitle' className='text-medium' fontWeight={700}>
          {I18n.t('v2.wcPay.paymentTokenQuantity')}
        </MyText>

        {/* Token icon + quantity. The icon carries the chain badge, which is now
            the only place the network is shown. */}
        <View style={styles.amountRow}>
          <TokenIconWithChain
            tokenIconUri={iconUrl}
            chainId={chainId}
          />
          <MyText variant='subTitle' fontWeight={700} style={styles.amountText} numberOfLines={1}>
            {fmtAmount(display)}
          </MyText>
        </View>
      </View>

      {renderSpendable()}

      {/* A positively-read shortfall, stated before the user signs. Without it
          the facilitator only rejects AFTER signing, as an opaque second 402
          ("invalid_exact_evm_insufficient_balance").

          When the shortfall is only there BECAUSE the transfer claimed the same
          token, say so: the user is looking at a wallet that visibly holds more
          than the fee, so the bare "not enough" reads as simply wrong. */}
      {insufficient && (
        <MyText variant='small' style={styles.errorText}>
          {reserved
            ? I18n.t('v2.x402.notEnoughAfterSend', { symbol: display.asset || '' })
            : I18n.t('v2.x402.notEnoughBalance', { symbol: display.asset || '' })}
        </MyText>
      )}

      {!!error && <MyText variant='small' style={styles.errorText}>{error}</MyText>}

      <View style={styles.buttons}>
        <MyButton
          size='small'
          variant='default'
          className='flex-1'
          label={I18n.t('Initial.cancel')}
          onPress={cancel}
          isDisable={signing}
        />
        <MyButton
          size='small'
          variant='primary'
          className='flex-1'
          label={I18n.t('v2.wcPay.pay')}
          onPress={approve}
          isLoading={signing}
          isDisable={signing || blocked}
        />
      </View>
    </MyViewPage>
  )
}

/**
 * Drawer driven by the core's inline x402 signer. While `chat()` is awaiting a
 * signature, the core calls the host signer, which surfaces this sheet. The user
 * approves → we sign the typed data with their wallet → resolve with the
 * signature; the core then re-calls the paid API and answers. Cancel → resolve
 * with null (the core reports the payment was declined).
 *
 * Renders nothing itself — it drives the SCREEN's drawer via `screenRef`
 * (AISearch's BaseContainer), like every other drawer in the app. That matters
 * because one call site is nested inside a chat message bubble: a drawer hosted
 * locally would be positioned against that bubble and open as a small sheet
 * pinned to the button, instead of sliding up from the bottom of the viewport.
 */
export default function X402SignModal ({ request, walletAddress, onResolve, screenRef }) {
  // Set once the awaiting signer has been resolved for the CURRENT request, so
  // the sheet's own onClose can't resolve it a second time.
  const resolvedRef = useRef(false)
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  // Resolve the awaiting signer exactly once per request. Guarded because both
  // the buttons and the sheet's onClose land here.
  //
  // `result` is a signature string (approved), null (cancelled / closed), or
  // `{ error }` when the last-moment re-check failed — passed through as-is for
  // the gate to tell apart.
  const settle = useCallback((result) => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    onResolveRef.current?.(result)
  }, [])

  const close = useCallback(() => {
    screenRef?.closeDrawer?.()
  }, [screenRef])

  // One push per request: the content owns its own signing/error state, so the
  // snapshot `openDrawer` takes of `children` stays valid for the sheet's whole
  // life and nothing has to be re-pushed while it is open.
  useEffect(() => {
    if (!request) return

    resolvedRef.current = false

    // Goes STRAIGHT to the drawer host rather than through
    // BaseContainer.openDrawer, which always supplies its screen-anchored
    // heightPopupDefault as the fallback height. Passing `null` explicitly is
    // what makes this sheet content-fit — BottomSheetView measures the children,
    // so a request without a description makes a shorter sheet. Same escape
    // hatch WalletConnectRequestHost uses for its signature drawer.
    screenRef?.drawer?.current?.openDrawer?.({
      animation: ANIMATION_DRAWER.SLIDE_FROM_BOTTOM,
      // A payment approval must not be dismissed by accident — the core is
      // blocked awaiting this signature, so closing goes through the buttons.
      enablePanDownToClose: false,
      // Belt and braces: whatever closes the sheet, the signer gets an answer
      // (a no-op once approve/cancel already settled it), so it never hangs.
      onClose: () => settle(null),
      children: (
        <X402SignContent
          request={request}
          walletAddress={walletAddress}
          onSettle={settle}
          onClose={close}
          // A COLD account signs the payment off its NFC card, which needs the
          // screen's BaseContainer for the scan sheet.
          nfcProxy={screenRef?.nfcProxy}
        />
      )
    }, null)
  }, [request, walletAddress, screenRef, settle, close])

  return null
}
