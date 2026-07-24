import React, { useEffect, useRef } from 'react'
import { View } from 'react-native'
import { height, pixelByHeight } from 'common/styles'
import BigNumber from 'bignumber.js'
import I18n, { resolveLocale } from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyButton from 'frontend/Components/UI/MyButton'
import useSendTx, { TX_STATUS } from 'frontend/Hooks/useSendTx'
import GlassView from 'frontend/Components/UI/GlassView'
import TxStatusTimeline from '../TxStatusTimeline'
import styles from './styles'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

// Display truncated (no rounding) to 8 decimals via BigNumber, with grouping —
// matches AddLiquidityForm.
const fmt = (n, d = 8) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

const fmtPct = (n) => (n == null ? '—' : `${BigNumber(n).multipliedBy(100).decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed()}%`)

export default function ConfirmAddLiquidityTx ({ props, onResult, onStatusChange, onCopyHash, onPersist, language }) {
  const t = (key, opts) => tt(key, language, opts)

  const { chain, unsignedTx, summary, pool, range, txState } = props

  // Tx lifecycle (sign → broadcast → confirm) + status state live in the shared
  // hook; this screen only owns its confirmation form and forwards the result
  // with its own context (pool/range) attached. `txState` is any status/hash
  // persisted into the message on a previous mount — seed the hook with it so
  // leaving and returning to the chat restores the timeline instead of resetting.
  const { status, txHash, confirm, settledLive, restoredFromHistory } = useSendTx({
    from: unsignedTx.from,
    chainId: unsignedTx.chainId,
    initialStatus: txState?.status,
    initialTxHash: txState?.txHash,
    buildTxs: () => [{
      to: unsignedTx.to,
      data: unsignedTx.data,
      value: unsignedTx.value,
      valueNoConvert: unsignedTx.value || 0
    }],
    fallbackError: t('txFailed'),
    onResult: (res) => onResult?.({ ...res, unsignedTx, pool, range })
  })

  // Let the host (chat list) scroll to keep the latest status in view — but only
  // on a REAL status transition, never on a remount. FlatList remounts offscreen
  // rows as you scroll back over them, and a settled widget remounts straight
  // into SUCCESS/FAIL from its persisted txState; firing then would drag the
  // list back to the bottom while the user is reading. Seeding the ref with the
  // mount-time status makes the first run a no-op.
  const lastNotifiedStatusRef = useRef(status)
  useEffect(() => {
    if (status === TX_STATUS.IDLE) return
    if (lastNotifiedStatusRef.current === status) return
    lastNotifiedStatusRef.current = status
    onStatusChange?.()
  }, [status, onStatusChange])

  // Persist the live status/hash back into the message so it survives a remount
  // (navigate away → return). Skip IDLE — there's nothing worth restoring, and
  // it avoids clobbering a persisted state on the first mount before confirm.
  useEffect(() => {
    if (status === TX_STATUS.IDLE) return
    onPersist?.({ status, txHash })
  }, [status, txHash, onPersist])

  // ─── Confirmation summary (always visible) ─────────────────────────────────
  const renderForm = () => (
    <View
      style={{
        gap: pixelByHeight(8)
      }}>
      {/* Pool header */}
      <View className='flex flex-row' style={styles.poolHeader}>
        <View className='flex-1'>
          <MyTextTicker variant='subTitle' fontWeight={700}>
            {pool?.token0?.symbol}/{pool?.token1?.symbol}
          </MyTextTicker>
        </View>

        <View style={styles.poolMeta}>
          <GlassView style={styles.tag}>
            <MyText variant='small' className='text-medium'>{chain?.name}</MyText>
          </GlassView>
          {pool?.feePercent != null && (
            <GlassView style={styles.tag}>
              <MyText variant='small' className='text-medium'>{pool.feePercent}%</MyText>
            </GlassView>
          )}
        </View>
      </View>

      <View
        style={[styles.divider]}
        className='bg-box-small' />

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
          style={[styles.divider, {
            marginTop: height(0.5)
          }]}
          className='bg-box-small' />

        {/* Price range */}
        <MyText variant='small' className='font-semibold' style={styles.sectionTitle}>{t('priceRange')}</MyText>
        <View style={styles.rangeRow}>
          <View style={styles.rangeItem}>
            <MyText variant='small' className='text-low'>{t('min')}</MyText>
            <MyText className='font-semibold' style={styles.rangeValue}>{fmt(range?.minPrice)}</MyText>
          </View>
          <MyText className='text-low' style={styles.rangeSep}>→</MyText>
          <View style={styles.rangeItem}>
            <MyText variant='small' className='text-low'>{t('max')}</MyText>
            <MyText className='font-semibold' style={styles.rangeValue}>{fmt(range?.maxPrice)}</MyText>
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

        {status === TX_STATUS.IDLE && (
          <MyButton
            className='w-full'
            style={styles.ctaWrap}
            activeOpacity={0.8}
            variant='primary'
            onPress={confirm}
          >
            <MyText fontWeight={700}>{t('confirmAndSign')}</MyText>
          </MyButton>
        )}
      </View>

      {/* Shared status timeline drives the sign → confirm → done/error flow. */}
      {status !== TX_STATUS.IDLE && (
        <TxStatusTimeline
          status={status}
          txHash={txHash}
          from={unsignedTx.from}
          chainId={unsignedTx.chainId}
          language={language}
          onCopyHash={onCopyHash}
          onRetry={confirm}
          // Only animate the success/fail result when it settled live this
          // mount; a state restored from history renders statically.
          animate={settledLive}
          // The Sending/Waiting intro markers animate on any live flow; only a
          // full restore-from-history renders them statically.
          animateIntro={!restoredFromHistory}
        />
      )}
    </View>
  )
}

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <View>
      <MyText variant='small' className='text-medium' style={styles.rowLabel}>{label}</MyText>
    </View>
    <View
      style={{
        flex: 1,
        alignItems: 'flex-end'
      }}
    >
      <MyTextTicker variant='small' className='font-medium' style={styles.rowValue}>{value}</MyTextTicker>
    </View>
  </View>
)
