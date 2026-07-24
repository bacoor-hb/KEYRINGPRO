import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import I18n, { resolveLocale } from 'assets/Lang'
import images from 'assets/Image'
import { handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import { TX_STATUS } from 'frontend/Hooks/useSendTx'
import styles from './styles'

// Reusable status timeline for any EVM transaction flow. It is purely
// presentational: it reads the lifecycle state produced by `useSendTx` and
// renders two nodes — a "Sending" node (tx hash once broadcast, or an explorer
// hint while the hash is pending) and a result node that progresses from
// "Waiting for confirmation" → "Success" / "Failed".
// Two independent animation switches, because the intro markers and the settled
// result don't come alive at the same time:
//   • `animateIntro` — the Sending / Waiting step markers. True on any live flow
//     (default); pass false only when the whole timeline is restored from
//     history, so re-entering the chat doesn't replay their pop-in.
//   • `animate` — the settled success/fail result. True only when the tx settled
//     live this mount, so a rehydrated terminal state renders statically.
// They diverge while signing/confirming (intro animates, result not settled yet)
// and when resuming a persisted broadcast (intro static, result settles live).
export default function TxStatusTimeline ({ status, txHash, from, chainId, language, onCopyHash, onRetry, errorMessage, animate = true, animateIntro = true }) {
  // Flow strings live under `chatAgent`; the explorer hint + "waiting for
  // confirmation" strings are reused from the send-token flow under `Initial`.
  const t = (key, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })
  const ti = (key) => I18n.t(`Initial.${key}`, { locale: resolveLocale(language) })

  const hasHash = !!txHash
  const isSigning = status === TX_STATUS.SIGNING
  const isDone = status === TX_STATUS.DONE
  const isError = status === TX_STATUS.ERROR
  // The result node appears once the tx is broadcast (confirming) and after.
  const showResult = status === TX_STATUS.CONFIRMING || isDone || isError

  const resultTitleClass = isDone ? 'text-green' : isError ? 'text-red' : ''
  const resultTitle = isDone ? t('statusSuccess') : isError ? t('statusFailed') : ti('waitingCofirmation')

  const renderTxHash = () => (
    <View style={styles.hashRow}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.hashTextWrap}
        onPress={() => handleOpenExplorerHash(txHash, Number(chainId))}
      >
        <MyText variant='small' className='text-brand'>
          {txHash}
        </MyText>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.copyBtn}
        className='border border-box-small bg-input-field'
        onPress={() => txHash && onCopyHash?.(txHash)}
      >
        <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.statusWrap}>
      {/* Sending node */}
      <View style={styles.stepRow}>
        <View style={styles.stepLeft}>
          <TxStepIcon uri={images.UIV2.icons.icon_send_outline} animate={animateIntro} />
          <View style={styles.connector} className='bg-box-small' />
        </View>
        <View style={styles.stepBody}>
          <View style={styles.titleRow}>
            <MyText fontWeight={700}>{t('sending')}</MyText>
            {/* Animated dots while we wait for the broadcast hash. */}
            {isSigning && (
              <MyDotsLoading
                style={styles.titleDots}
                source={images.threeDotsWhiteLoading} />
            )}
          </View>
          <MyText variant='small' className='text-medium' style={styles.stepDesc}>{t('approxTime')}</MyText>

          {hasHash ? (
            renderTxHash()
          ) : (
            // No hash yet — point the user to the explorer as a fallback.
            <View style={styles.explorerHint}>
              <MyText variant='small' className='text-medium'>{ti('plsCheckExplorer')}</MyText>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenExplorerUserAddress(from, Number(chainId))}
              >
                <MyText variant='small' className='text-brand' style={styles.explorerLink}>{ti('checkingExplorer')}</MyText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Result node — waiting → success / failed. Success/Fail reuse StatusMessage
          (same DotLottie + subTitle as the RegisterAddress screen); the "waiting for
          confirmation" state keeps the static step-icon + bold title. */}
      {showResult && (
        isDone || isError ? (
          <StatusMessage
            variant={isDone ? 'success' : 'error'}
            title={resultTitle}
            titleConfig={{ className: resultTitleClass, variant: 'subTitle' }}
            // A caller-supplied reason (e.g. the pre-flight's "you need X more
            // to cover the fee") beats the generic "the transaction failed".
            message={isError ? (errorMessage || t('txFailedDesc')) : undefined}
            style={styles.statusResult}
            // Restored-from-history results show the final frame statically; a
            // live settle (or retry) plays the success/fail animation.
            autoplay={animate}
          />
        ) : (
          <View style={styles.stepRowCenter}>
            <View style={styles.stepLeft}>
              <TxStepIcon uri={images.UIV2.icons.icon_waiting_for_confirm_outline} animate={animateIntro} />
            </View>
            <View style={styles.stepBodyLast}>
              <View style={styles.titleRow}>
                <MyText fontWeight={700} className={resultTitleClass}>{resultTitle}</MyText>
                {/* Animated dots while waiting for the receipt to confirm. */}
                <MyDotsLoading
                  style={styles.titleDots}
                  source={images.threeDotsWhiteLoading} />
              </View>
            </View>
          </View>
        )
      )}

      {isError && (
        <MyButton
          className='w-full'
          style={styles.ctaWrap}
          activeOpacity={0.8}
          variant='primary'
          onPress={onRetry}
        >
          <MyText fontWeight={700}>{t('retry')}</MyText>
        </MyButton>
      )}
    </View>
  )
}
