import React, { useEffect, useRef, useState, useCallback } from 'react'
import { View } from 'react-native'
import { pixelByHeight } from 'common/styles'
import BigNumber from 'bignumber.js'
import I18n, { resolveLocale } from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyButton from 'frontend/Components/UI/MyButton'
import useSendTx, { TX_STATUS } from 'frontend/Hooks/useSendTx'
import TxStatusTimeline from '../TxStatusTimeline'
import X402SignModal from '../X402SignModal'
import { runX402Gate, X402_PATH } from '../WalletActionForm/x402Gate'
import { useX402FeeFor } from 'frontend/Hooks/useX402Fees'
import styles from './styles'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

// Display truncated (no rounding) to 8 decimals via BigNumber, with grouping —
// matches AddLiquidityForm.
const fmt = (n, d = 8) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

const fmtPct = (n) => (n == null ? '—' : `${BigNumber(n).multipliedBy(100).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed()}%`)

// The chat agent hands out HEX chain ids ("0xa"), but every chain lookup in the
// app is keyed by the DECIMAL number — ViemWeb3 compares `chainId.toString()`
// against the catalog and getChainInfo indexes by the number, so "0xa" matches
// nothing. The RPC list then comes back EMPTY and viem dies inside fallback()
// with "transports[i] is not a function", which the shared services swallow into
// a 0 and surface as "this transaction cannot be completed".
//
// Normalized HERE, at the edge of the chat flow, so the rest of the app keeps
// receiving the decimal ids it already expects (mirrors WalletActionForm).
const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

// How long the agent's quote stays good for. The unsignedTx is built against a
// pool state (price, tick, liquidity) that moves continuously, so a failure this
// long after the message was created is far more likely to be a stale quote than
// something the user can fix by tapping Retry — retrying the same calldata would
// just fail the same way. Past this age a failure is reported as "expired, ask
// again" and the retry path is closed, sending the user back to the agent for a
// freshly-built transaction.
const EXPIRY_MS = 45 * 1000

export default function ConfirmAddLiquidityTx ({ props, onResult, onStatusChange, onCopyHash, onPersist, language, screenRef, messageTimestamp }) {
  const t = (key, opts) => tt(key, language, opts)

  const { chain, unsignedTx, summary, pool, range, txState } = props
  // Decimal from here down: useSendTx, the pre-flight and the timeline all feed
  // the shared chain helpers, which only match on the number (see toChainId).
  const chainId = toChainId(unsignedTx.chainId)

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

  // Has this widget already settled its x402 fee?
  //
  // The payment settles before the backend answers and before the tx is signed,
  // so an attempt can cost the user the fee and still fail — a revert, an RPC
  // timeout, a 500 from the backend. Retrying must not charge them twice for the
  // same widget, so the fact is remembered here and the gate skipped from then
  // on. Scoped to this one message (it lives in its own `txState`), not to the
  // wallet or the route: another quote is a separate action and pays its own fee.
  //
  // Seeded from the persisted state so it survives leaving the chat and coming
  // back — where losing it would be most expensive, since the user cannot see
  // that they already paid.
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

  // What this costs in x402, read from the backend's own price list. Drives BOTH
  // the "※ Fee" line and whether the paid gate below runs at all: priced →
  // charged, unpriced (or price list unreachable) → confirms free. `feesLoading`
  // holds the confirm button while the list is in flight, so the position is
  // never added free merely because the price hadn't arrived yet.
  const { fee: x402Fee, isLoading: feesLoading } = useX402FeeFor(X402_PATH.addPool)

  // Ask the backend to authorize adding this position, paying its x402 charge if
  // it asks for one. Runs inside the send flow, last thing before signing — see
  // the `gate` contract in useSendTx — so the fee is only ever paid for a tx
  // that could actually execute.
  //
  // `unsignedTx.chainId` on purpose: the decimal normalization above is for the
  // app's own chain lookups, while this goes on the wire to the backend, which
  // has been receiving the agent's hex id all along. Changing that silently is
  // an API change, so the request keeps the form the server already expects.
  const gate = useCallback(({ verify, lendKey, noteFeeToken } = {}) => {
    // Already paid on an earlier attempt of this widget, so a retry goes straight
    // through rather than charging twice for one quote. Read from the ref so a
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
      // token rides along to the post-success refresh: the position's own chain
      // gets a full refresh (it moves two tokens), which covers a fee charged
      // there, but a fee settled on ANOTHER chain is outside it entirely.
      onPaid: (feeToken) => {
        markX402Paid()
        noteFeeToken?.(feeToken)
      },
      // The payment and the transaction are signed by the same account, so the key
      // read for the payment is handed back to the send — a keycard user taps the
      // card once for the whole action instead of twice.
      onKey: lendKey,
      path: X402_PATH.addPool,
      query: {
        action: props?.action,
        chainId: unsignedTx.chainId,
        from: unsignedTx.from,
        to: unsignedTx.to,
        amount: summary?.nativeIn,
        token0: pool?.token0?.address,
        token1: pool?.token1?.address
      },
      walletAddress: unsignedTx.from,
      requestSignature: (request) => new Promise((resolve) => {
        x402ResolveRef.current = resolve
        setX402Req(request)
      })
    })
  }, [props?.action, unsignedTx.chainId, unsignedTx.from, unsignedTx.to, summary?.nativeIn, pool?.token0?.address, pool?.token1?.address, markX402Paid])

  // The quote went stale and an attempt has already failed against it — the
  // widget is spent and the user has to ask the agent again. Restored from the
  // persisted txState so it survives leaving and returning to the chat.
  const [expired, setExpired] = useState(!!txState?.expired)

  // Is the quote past its window RIGHT NOW? Read only at settle time (see
  // onResult). Without a timestamp — an older persisted message from before this
  // field was plumbed through — nothing can be judged stale, so the widget keeps
  // its normal retry behavior rather than expiring everything by default.
  const isExpiredNow = useCallback(
    () => !!messageTimestamp && Date.now() - messageTimestamp > EXPIRY_MS,
    [messageTimestamp]
  )

  // Tx lifecycle (sign → broadcast → confirm) + status state live in the shared
  // hook; this screen only owns its confirmation form and forwards the result
  // with its own context (pool/range) attached. `txState` is any status/hash
  // persisted into the message on a previous mount — seed the hook with it so
  // leaving and returning to the chat restores the timeline instead of resetting.
  const { status, txHash, confirm, settledLive, restoredFromHistory, error } = useSendTx({
    from: unsignedTx.from,
    chainId,
    initialStatus: txState?.status,
    initialTxHash: txState?.txHash,
    // The reason it failed, so coming back to a failed widget still shows the
    // specific cause instead of the generic "the transaction failed".
    initialError: txState?.error,
    // Lets a COLD (NFC keycard) account sign: its key isn't on the device, so
    // it has to be scanned off the card at signing time, which needs the
    // screen's BaseContainer for the scan sheet. Hot accounts ignore this.
    nfcProxy: screenRef?.nfcProxy,
    buildTxs: () => [{
      to: unsignedTx.to,
      data: unsignedTx.data,
      value: unsignedTx.value,
      valueNoConvert: unsignedTx.value || 0
    }],
    fallbackError: t('txFailed'),
    onResult: (res) => {
      // Judge staleness at the instant the attempt SETTLED, not on a timer: a
      // quote sitting untouched must never expire itself on screen, and a
      // success is never stale no matter how long it took to confirm. Only a
      // failure that landed past the window counts.
      if (!res?.success && isExpiredNow()) setExpired(true)
      onResult?.({ ...res, unsignedTx, pool, range })
    },
    // Refresh the sender's balances once the position is added, so the amounts
    // spent are reflected everywhere. BOTH pool tokens are named because adding
    // liquidity moves two, and the refresh reads only what it is handed — the
    // native coin it adds on its own, having paid the gas.
    refreshBalanceOnSuccess: true,
    refreshTokenAddress: [pool?.token0?.address, pool?.token1?.address],
    // Simulate the tx and verify the fee is affordable BEFORE the gate runs, so
    // a position that would revert (or a wallet that can't cover gas) is caught
    // while it still costs nothing — the x402 fee is only ever paid for a tx
    // that can actually execute. Without this the user pays, then fails.
    preflight: true,
    // Backend authorization + its x402 payment, last thing before signing.
    //
    // The PRICE LIST is what switches this on: the gate runs only when the
    // backend's openapi.json actually quotes a price for this route (see
    // useX402FeeFor). Unpriced — or unreachable, so nothing is quoted at all —
    // means the position is added free, with no gate. That ties the charge to
    // the same source as the "※ Fee" line above the button: a user who was
    // never shown a price is never charged one.
    gate: x402Fee ? gate : undefined,
    language
  })

  const isIdle = status === TX_STATUS.IDLE
  // The pre-send checks (gas pre-flight, and the x402-paid backend authorization
  // with its approval sheet) are running. Nothing is signed yet, so the widget
  // stays in its pre-send shape — no timeline — but must not be re-submitted.
  const isGating = status === TX_STATUS.GATING
  const isFailed = status === TX_STATUS.ERROR

  // When the action button is on screen. It covers the failure case too, because
  // the retry is THIS button rather than one inside the timeline — that keeps it
  // in the boxed form, at the same place as the confirm button of every other
  // chat widget (WalletActionForm, SupplyFormShell), instead of floating below
  // the status block. An expired quote is the one failure with no way forward,
  // so it drops the button entirely and the timeline carries the "ask again".
  const showAction = (isIdle || isGating || isFailed) && !expired

  // Let the host (chat list) scroll to keep the latest status in view — but only
  // on a REAL status transition, never on a remount. FlatList remounts offscreen
  // rows as you scroll back over them, and a settled widget remounts straight
  // into SUCCESS/FAIL from its persisted txState; firing then would drag the
  // list back to the bottom while the user is reading. Seeding the ref with the
  // mount-time status makes the first run a no-op.
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

  // Persist the live status/hash back into the message so it survives a remount
  // (navigate away → return). Skip IDLE — there's nothing worth restoring, and
  // it avoids clobbering a persisted state on the first mount before confirm.
  // GATING is skipped for the same reason: it's a transient in-flight phase with
  // no tx behind it, and rehydrating into it would strand the widget mid-check.
  //
  // EXCEPT once the fee has been paid: the payment settles DURING gating, so
  // waiting for the status to advance would lose it in exactly the case that
  // matters most — paid, then the app dies before the tx is signed. That flag
  // has to be written the moment it becomes true.
  useEffect(() => {
    if (!x402Paid && (isIdle || isGating)) return
    // `expired` rides along so a spent quote stays spent across a remount —
    // otherwise coming back would restore the failure with a live Retry button
    // pointing at calldata already known to be stale. `x402Paid` likewise, so a
    // retry after a paid-then-failed attempt is not charged a second time. And
    // `error`, so a restored failure still says why rather than falling back to
    // the generic copy.
    onPersist?.({ status, txHash, expired, x402Paid, error })
  }, [status, txHash, isIdle, isGating, expired, x402Paid, error, onPersist])

  // ─── Confirmation summary (always visible) ─────────────────────────────────
  const renderForm = () => (
    <View
      style={{
        gap: pixelByHeight(8)
      }}>
      {/* Pool header */}
      <View style={styles.headerBlock}>
        <View className='flex flex-row' style={styles.poolHeader}>
          <View className='flex-1'>
            <MyTextTicker variant='subTitle' fontWeight={700}>
              {pool?.token0?.symbol}/{pool?.token1?.symbol}
            </MyTextTicker>
          </View>

          <View style={styles.poolMeta}>
            <View style={styles.tag}>
              <MyText variant='small' className='text-medium'>{chain?.name}</MyText>
            </View>
            {pool?.feePercent != null && (
              <View style={styles.tag}>
                <MyText variant='small' className='text-medium'>{pool.feePercent}%</MyText>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} className='bg-box-small' />
      </View>

      {/* Summary rows */}
      <View
        style={{
          gap: pixelByHeight(8)
        }}
      >
        <Row label={t('amount')} value={`${fmt(summary?.nativeIn)} ${summary?.nativeSymbol || 'ETH'}${summary?.nativeInUsd != null ? ` (~$${summary.nativeInUsd.toFixed(2)})` : ''}`} />
        <Row label={t('ratio')} value={`${fmtPct(summary?.ratio?.token0Percent)} ${pool?.token0?.symbol} / ${fmtPct(summary?.ratio?.token1Percent)} ${pool?.token1?.symbol}`} />
        <Row label={t('expectedAmount', { symbol: pool?.token0?.symbol || '' })} value={fmt(summary?.expectedToken0)} />
        <Row label={t('expectedAmount', { symbol: pool?.token1?.symbol || '' })} value={fmt(summary?.expectedToken1)} />
      </View>

      <View
        style={{
          gap: pixelByHeight(8)
        }}
      >
        <View
          style={styles.divider}
          className='bg-box-small' />

        {/* Price range */}
        <MyText>{t('priceRange')}</MyText>
        <View style={styles.rangeRow}>
          <View style={styles.rangeItem}>
            <MyText className='text-low'>{t('min')}</MyText>
            <MyText style={styles.rangeValue}>{fmt(range?.minPrice)}</MyText>
          </View>
          <MyText className='text-low' style={styles.rangeSep}>→</MyText>
          <View style={styles.rangeItem}>
            <MyText className='text-low'>{t('max')}</MyText>
            <MyText style={styles.rangeValue}>{fmt(range?.maxPrice)}</MyText>
          </View>
        </View>
      </View>

    </View>
  )

  return (
    <View style={styles.card}>
      {/* Boxed background wraps the form + confirm button only */}
      <View style={styles.formBox}>
        {renderForm()}
        <View style={styles.submitBlock}>
          {/* The x402 charge, stated before the user commits. Only while there is
            still something to commit to — once the attempt has failed the fee is
            either already settled (and the retry is free, see `gate`) or about to
            be quoted again, so repeating the price here would just be noise. */}
          {(isIdle || isGating) && !expired && !!x402Fee && (
            <MyText className='text-medium'>
              {t('walletActionFeeNotice', { fee: x402Fee.label })}
            </MyText>
          )}

          {/* Stays mounted (disabled) through the pre-send checks, so paying the
            x402 fee doesn't make the button disappear before the tx is sent, and
            comes back as the retry after a failure — keeping the action in the
            box, where every other chat widget puts it. An expired quote drops it
            entirely: the timeline below carries the "ask again" message, and
            there is nothing left to confirm here. */}
          {showAction && (
            <MyButton
              className='w-full'
              activeOpacity={0.8}
              // Held while the price list is in flight too: confirming during that
              // window would skip a fee that does exist (see feesLoading).
              disabled={isGating || feesLoading}
              variant='primary'
              onPress={confirm}
            >
              {/* Mentions a payment only when one will actually happen — the same
                `x402Fee` that gates the charge. Unpriced (or an unreachable
                price list) means this confirms free, so GATING is just the
                balance/gas checks and the label says "Checking". */}
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
          lie — and a cancelled payment must leave the form untouched. */}
      {!isIdle && !isGating && (
        <TxStatusTimeline
          status={status}
          txHash={txHash}
          from={unsignedTx.from}
          chainId={chainId}
          language={language}
          onCopyHash={onCopyHash}
          // No retry button here on purpose: the form above brings its own back
          // on failure, in the same place as its confirm button — a second one
          // down here would both duplicate it and sit outside the box. (An
          // expired quote has no retry at all: the calldata was built against a
          // pool state that has since moved, so it would fail the same way, and
          // the message below sends the user back to the agent instead.)
          // An expired quote explains itself — the underlying RPC/revert reason
          // is noise once the fix is "ask the agent again". Otherwise the
          // pre-flight's reason ("not enough for the fee", "can't be completed")
          // is far more useful than the generic failure copy.
          errorTitle={expired ? t('quoteExpired') : undefined}
          errorMessage={expired ? t('quoteExpiredDesc') : error}
          // Only animate the success/fail result when it settled live this
          // mount; a state restored from history renders statically.
          animate={settledLive}
          // The Sending/Waiting intro markers animate on any live flow; only a
          // full restore-from-history renders them statically.
          animateIntro={!restoredFromHistory}
        />
      )}

      {/* x402 approval for the backend authorization call. Opens during GATING;
          cancelling resolves the gate with no signature, which aborts before
          anything is signed or broadcast. */}
      <X402SignModal
        request={x402Req}
        walletAddress={unsignedTx.from}
        onResolve={handleX402Resolve}
        screenRef={screenRef}
      />
    </View>
  )
}

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <View>
      <MyText fontWeight='700'>{label}</MyText>
    </View>
    <View
      style={{
        flex: 1,
        alignItems: 'flex-end'
      }}
    >
      <MyTextTicker className='text-medium'>{value}</MyTextTicker>
    </View>
  </View>
)
