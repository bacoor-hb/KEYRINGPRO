import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import I18n, { resolveLocale } from 'assets/Lang'
import images from 'assets/Image'
import { getUrlExplorerHash, handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import timelineStyles from '../TxStatusTimeline/styles'
import { SUPPLY_STEP } from './useSupplyFlow'
import styles from './styles'

// Status timeline for the two-transaction supply flow:
//
//     Approve  →  Sending  →  Success / Failed
//
// The shared `TxStatusTimeline` renders exactly one transaction, so it cannot
// show an approval and a deposit as separate, separately-hashed nodes. This is
// the same visual language (step icons, connectors, hash rows, StatusMessage
// result) applied to a sequence of two — and it reuses the shared timeline's
// stylesheet so the two stay identical as that evolves.
//
// The Approve node is omitted entirely when the market already held enough
// allowance: nothing was approved, so showing a step for it would be a lie.

export default function SupplyStatusTimeline ({
  step,
  approveHash,
  supplyHash,
  error,
  language,
  onCopyHash,
  chainId,
  walletAddress,
  // `{ amount, symbol }` the deposit actually credited, read from its receipt
  // logs; null when it could not be derived. Only ever shown under a SUCCESS —
  // it is the settled outcome, not a running commentary.
  received,
  // Two switches, for the same reason the shared timeline has two: the step
  // markers and the settled result do not come alive at the same moment.
  //   • `animateIntro` — the Approve / Sending / Waiting markers. True on any
  //     live run; false only when the whole timeline is restored from history,
  //     so re-entering the chat doesn't replay their pop-in.
  //   • `animate` — the success/fail result, true only when it settled live
  //     this mount, so a rehydrated terminal state renders statically.
  animate = true,
  animateIntro = true
}) {
  // Flow strings live under `chatAgent`; the explorer hint is reused from the
  // send-token flow under `Initial`, same as the shared timeline does.
  const t = (key, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })
  const ti = (key) => I18n.t(`Initial.${key}`, { locale: resolveLocale(language) })

  const isError = step === SUPPLY_STEP.ERROR
  const isDone = step === SUPPLY_STEP.DONE
  const isApproving = step === SUPPLY_STEP.APPROVING
  const isApproved = step === SUPPLY_STEP.APPROVED
  const isSupplying = step === SUPPLY_STEP.SUPPLYING

  // The approve leg is part of THIS run only when it actually ran — either it is
  // in flight, or it left a hash behind.
  const hasApproveLeg = isApproving || !!approveHash
  // The deposit node appears as soon as the approval is CONFIRMED (APPROVED) —
  // which now means an on-chain read has seen the allowance, not merely that the
  // approve was broadcast. It is deliberately not gated on SUPPLYING: between
  // confirmation and broadcast the flow is still working (reading the vault's
  // share rate), and keying the node on SUPPLYING alone left the timeline
  // visibly stalled on a finished Approve step with nothing beneath it.
  //
  // The reverse gap — approve broadcast but allowance not yet visible — stays on
  // the Approve node as pending, because that is exactly what is happening; a
  // "Sending" node there would claim a deposit that has not been signed.
  //
  // Still NOT shown for a run that failed before this point: a pre-check or
  // approval failure must not render a "Sending" step for a transaction that was
  // never broadcast.
  const showSupplyNode = isApproved || isSupplying || !!supplyHash || isDone
  const showResult = isDone || isError

  // The line under the result title, or undefined for a bare title.
  //
  //   • failure → why it failed, falling back to a generic reason so a failed
  //     card is never unexplained
  //   • success → what was actually received, when the receipt gave it up
  //
  // Also decides the layout below, since the two are the same question: a
  // StatusMessage with a second line centres its icon differently from one
  // without. Computed once so the text and the style can never disagree.
  const resultMessage = (() => {
    if (isError) return error || t('txFailedDesc')
    if (isDone && received?.amount) {
      return t('supplyReceivedAmount', { amount: received.amount, symbol: received.symbol })
    }
    return undefined
  })()

  // Between the deposit being broadcast and its receipt coming back, the flow is
  // waiting on the chain — `useSupplyFlow` is inside `waitForReceipt`. The shared
  // timeline renders that gap as its own "waiting for confirmation" node, and
  // without it a supply sat on a finished-looking "Sending" step for the whole
  // confirmation, with nothing saying what it was waiting for.
  //
  // Appears once the deposit HAS a hash — the point the shared timeline calls
  // CONFIRMING. `SUPPLYING` alone is not enough: it starts at the moment the
  // deposit is handed to the signer, and until the hash comes back it is the
  // Sending node that is in flight (dots + explorer fallback). Showing Waiting
  // then would put spinning dots on two nodes at once, reading as two things
  // happening simultaneously when only one is.
  const isWaitingConfirm = isSupplying && !!supplyHash && !isDone && !isError

  // `copyable` is off for the approval: it is an intermediate step the user
  // rarely needs to keep, and the row then holds just the tappable hash.
  const renderHash = (hash, copyable) => (
    <View style={timelineStyles.hashRow}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={timelineStyles.hashTextWrap}
        onPress={() => handleOpenExplorerHash(hash, Number(chainId))}
      >
        <MyText className='text-brand'>{hash}</MyText>
      </TouchableOpacity>
      {copyable && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={timelineStyles.copyBtn}
          className='border border-box-small bg-input-field'
          onPress={() => hash && onCopyHash?.(getUrlExplorerHash(hash, Number(chainId)))}
        >
          <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
        </TouchableOpacity>
      )}
    </View>
  )

  // One timeline node, built as TWO stacked containers rather than one row:
  //
  //   ┌ head  ─ [icon] │ title + "approximate time"
  //   └ trail ─ [line] │ hash  (or the explorer hint)
  //
  // The same anatomy every chat timeline uses — the head/trail styles live in
  // the shared `TxStatusTimeline` stylesheet, so this, Swap and the shared
  // timeline itself stay identical. See that file for why the node is split.
  //
  // The connector is ALWAYS rendered, exactly as the shared timeline does it —
  // never gated on being the last node. Two reasons it has to stay put: a line
  // that appeared only once the next step arrived made the node visibly grow
  // mid-flow, and the run's final node is the StatusMessage result, which every
  // step node is connected down to anyway.
  //
  // This node also deliberately does NOT switch its row and body styles the way
  // the shared timeline does for its last node: those swaps change height and
  // alignment, so a node that stopped being last would jump. Every node here
  // keeps one layout for its whole life.
  const renderNode = ({ icon, title, hash, pending, copyable = true }) => (
    <View>
      {/* Head — the marker and the words it labels, nothing else. */}
      <View style={timelineStyles.stepHeadRow}>
        <View style={timelineStyles.stepLeft}>
          <TxStepIcon uri={icon} animate={animateIntro} />
        </View>
        <View style={timelineStyles.stepBodyLast}>
          <View style={timelineStyles.titleRow}>
            <MyText fontWeight={700}>{title}</MyText>
            {pending && (
              <MyDotsLoading style={timelineStyles.titleDots} source={images.threeDotsWhiteLoading} />
            )}
          </View>
          <MyText className='text-medium'>
            {t('approxTime')}
          </MyText>
        </View>
      </View>

      {/* Trail — the connector in the icon's column, the hash beside it. */}
      <View style={timelineStyles.stepTrailRow}>
        <View style={[timelineStyles.stepLeft, timelineStyles.trailLeft]}>
          <View style={timelineStyles.trailConnector} className='bg-box-small' />
        </View>
        <View style={timelineStyles.trailBody}>
          {hash ? renderHash(hash, copyable) : (
            // Broadcast, but no hash back yet — point at the explorer, exactly as
            // the shared timeline does rather than leaving the node empty.
            <View style={timelineStyles.explorerHint}>
              <MyText className='text-medium'>{ti('plsCheckExplorer')}</MyText>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleOpenExplorerUserAddress(walletAddress, Number(chainId))}
              >
                <MyText className='text-brand' style={timelineStyles.explorerLink}>
                  {ti('checkingExplorer')}
                </MyText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  )

  return (
    <View style={timelineStyles.statusWrap}>
      {/* The pre-flight check deliberately has NO node here: nothing has been
          signed yet, so it is progress on the button ("Checking…"), not a step
          in the transaction history. Giving it a node also made the whole
          timeline shift the moment it disappeared. */}

      {/* Leg 1 — the ERC-20 approval, shown only when it was needed. */}
      {hasApproveLeg && renderNode({
        // The same approve mark the Exchange screen's approve step uses, so the
        // two legs are told apart at a glance instead of both reading as "send".
        icon: images.UIV2.icons.approve,
        title: t('supplyStepApprove'),
        hash: approveHash,
        // Dots for the WHOLE approve step, hash or no hash — they stop only when
        // the step does, which is the moment the Sending node appears below.
        //
        // Not keyed on the hash: `useSupplyFlow` sets `approveHash` and then
        // stays in APPROVING while it polls `waitForAllowance` for the approval
        // to become visible on-chain. That poll can run for a while, and dots
        // that stopped at the hash left the timeline looking finished and stuck
        // — a step showing a hash, nothing spinning, and no next node yet.
        //
        // No risk of two nodes spinning at once here: the Sending node only
        // mounts at APPROVED, by which point this one is no longer pending.
        pending: isApproving,
        // No copy button on the approval — it's a means to the deposit, and the
        // hash is still tappable through to the explorer.
        copyable: false
      })}

      {/* Leg 2 — the deposit. Pending until its hash lands, at which point the
          dots move down to the Waiting node below: two nodes both showing dots
          would read as two things happening at once. Matches the shared
          timeline, where the Sending node's dots are keyed on SIGNING alone. */}
      {showSupplyNode && renderNode({
        icon: images.UIV2.icons.icon_send_outline,
        title: t('sending'),
        hash: supplyHash,
        pending: !supplyHash && (isApproved || isSupplying)
      })}

      {/* Broadcast, now waiting on the receipt. Deliberately built inline rather
          than through `renderNode`: the shared timeline's waiting node is just
          icon + title + dots, with no "approx time" line and no hash row (the
          hash already sits on the Sending node right above it). */}
      {isWaitingConfirm && (
        <View style={timelineStyles.stepRowCenter}>
          <View style={timelineStyles.stepLeft}>
            <TxStepIcon uri={images.UIV2.icons.icon_waiting_for_confirm_outline} animate={animateIntro} />
          </View>
          <View style={timelineStyles.stepBodyLast}>
            <View style={timelineStyles.titleRow}>
              <MyText fontWeight={700}>{ti('waitingCofirmation')}</MyText>
              <MyDotsLoading style={timelineStyles.titleDots} source={images.threeDotsWhiteLoading} />
            </View>
          </View>
        </View>
      )}

      {/* Terminal result — icon centred against the text either way.
          A lone title centres against the icon via the shared `statusResult`,
          exactly as every other flow does. When there IS a second line — the
          failure reason, or the amount actually received — the icon centres on
          both lines TOGETHER so the block reads as one unit.

          The received line is best-effort: a success whose figure could not be
          read from the receipt renders as the bare "Success" it always did,
          rather than an empty second line or a guessed number. */}
      {showResult && (
        <StatusMessage
          variant={isDone ? 'success' : 'error'}
          title={isDone ? t('statusSuccess') : t('statusFailed')}
          titleConfig={{ className: isDone ? 'text-green' : 'text-red' }}
          message={resultMessage}
          style={resultMessage ? styles.statusResultWithMessage : timelineStyles.statusResult}
          autoplay={animate}
        />
      )}
    </View>
  )
}
