import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import I18n, { resolveLocale } from 'assets/Lang'
import images from 'assets/Image'
import { getUrlExplorerHash, handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import { handleOpenUrl } from 'common/function'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import timelineStyles from '../TxStatusTimeline/styles'
import { SWAP_STEP } from './useSwapFlow'
import { getProtocolExplorerUrl, getProtocolExplorerLabelKey, toPlatformExchange } from './protocolExplorer'
import { PLATFORM_EXCHANGE } from 'common/constants/swap'
import styles from './styles'

// Status timeline for the multi-transaction swap flow:
//
//     Approve [→ Approve]  →  Sending  →  Waiting  →  Success / Failed
//
// The shared `TxStatusTimeline` renders exactly one transaction, so it cannot
// show an approval and a swap as separate, separately-hashed nodes. This is the
// same visual language (step icons, connectors, hash rows, StatusMessage result)
// applied to a sequence — and it reuses the shared timeline's stylesheet so the
// two stay identical as that evolves. Deliberately a near-copy of
// SupplyStatusTimeline, which solves the same problem for approve → deposit.
//
// The Approve node is omitted entirely when the router already held enough
// allowance (or the source is native): nothing was approved, so showing a step
// for it would be a lie.
//
// There can be TWO approve nodes. A pay token that refuses to overwrite a
// non-zero allowance (USDT on Ethereum) is approved in two transactions — one
// resetting the allowance to 0, one granting the real one — and each is a
// separate transaction the user paid for, so each gets its own node with its own
// hash rather than being collapsed into one line whose hash points at only half
// of what happened.

export default function SwapStatusTimeline ({
  step,
  // Every approval this run broadcast, in order — usually one, two for the
  // zero-then-approve pair. `approveHash` is the single-hash shape this
  // component took before that was possible, still accepted so a run restored
  // from an older chat message renders.
  approveHashes,
  approveHash,
  swapHash,
  error,
  language,
  onCopyHash,
  chainId,
  walletAddress,
  // Which router executed this swap ('relay' / 'debridge') and, for deBridge, the
  // order id its explorer page is keyed on. Together they add the PROTOCOL's own
  // explorer link under the swap hash — the chain explorer shows the transaction
  // that reached the router, while the protocol's view is where the fill, the
  // amounts actually exchanged and any refund are visible. The same pair of links
  // the Exchange screen has always shown; absent either, only the chain hash is
  // rendered, exactly as before.
  provider,
  requestId,
  // What the user received, `{ amount, symbol }`, shown under a SUCCESS.
  // Rendered through the Exchange screen's own `receivedAmountOut` string so the
  // two read identically. Note the figure itself is still the QUOTE's estimate,
  // not a receipt reading — the Exchange path takes its number from the router's
  // tracking API, which this flow does not call.
  received,
  // Two switches, for the same reason the shared timeline has two: the step
  // markers and the settled result do not come alive at the same moment.
  //   • `animateIntro` — the Approve / Sending / Waiting markers. True on any
  //     live run; false only when the whole timeline is restored from history,
  //     so re-entering the chat doesn't replay their pop-in.
  //   • `animate` — the success/fail result, true only when it settled live this
  //     mount, so a rehydrated terminal state renders statically.
  animate = true,
  animateIntro = true
}) {
  // Flow strings live under `chatAgent`; the explorer hint is reused from the
  // send-token flow under `Initial`, same as the shared timeline does.
  const t = (key, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })
  const ti = (key) => I18n.t(`Initial.${key}`, { locale: resolveLocale(language) })

  const isError = step === SWAP_STEP.ERROR
  const isDone = step === SWAP_STEP.DONE
  const isApproving = step === SWAP_STEP.APPROVING
  const isApproved = step === SWAP_STEP.APPROVED
  const isSwapping = step === SWAP_STEP.SWAPPING

  const hashes = approveHashes?.length ? approveHashes : (approveHash ? [approveHash] : [])

  // The approve leg is part of THIS run only when it actually ran — either it is
  // in flight, or it left a hash behind.
  const hasApproveLeg = isApproving || hashes.length > 0
  // While the first approval is in flight there is no hash yet, but the node must
  // still render (as the shared timeline's hashless "check the explorer" state),
  // so an empty list becomes one pending node rather than none.
  const approveNodes = hashes.length > 0 ? hashes : [null]
  // The swap node appears as soon as the approval is CONFIRMED (APPROVED) —
  // which means an on-chain read has seen the allowance, not merely that the
  // approve was broadcast. Deliberately not gated on SWAPPING: between
  // confirmation and broadcast the flow is still working (estimating gas), and
  // keying the node on SWAPPING alone would leave the timeline visibly stalled on
  // a finished Approve step with nothing beneath it.
  //
  // The reverse gap — approve broadcast but allowance not yet visible — stays on
  // the Approve node as pending, because that is exactly what is happening; a
  // "Sending" node there would claim a swap that has not been signed.
  //
  // Still NOT shown for a run that failed before this point: a balance or
  // approval failure must not render a "Sending" step for a transaction that was
  // never broadcast.
  const showSwapNode = isApproved || isSwapping || !!swapHash || isDone
  const showResult = isDone || isError

  // The line under the result title, or undefined for a bare title.
  //
  //   • failure → why it failed, falling back to a generic reason so a failed
  //     card is never unexplained
  //   • success → what was received, when the quote gave an amount
  //
  // Worded through `v2.exchange.receivedAmountOut` — the SAME string the Exchange
  // screen puts under its own success — so the in-chat swap and the Exchange
  // drawer read identically.
  //
  // Also decides the layout below, since the two are the same question: a
  // StatusMessage with a second line centres its icon differently from one
  // without. Computed once so the text and the style can never disagree.
  const resultMessage = (() => {
    if (isError) return error || t('txFailedDesc')
    if (isDone && received?.amount) {
      return I18n.t('v2.exchange.receivedAmountOut', {
        amount: received.amount,
        symbol: received.symbol || '',
        locale: resolveLocale(language)
      })
    }
    return undefined
  })()

  // Between the swap being broadcast and its receipt coming back, the flow is
  // waiting on the chain. The shared timeline renders that gap as its own
  // "waiting for confirmation" node, and without it a swap would sit on a
  // finished-looking "Sending" step for the whole confirmation.
  //
  // Appears once the swap HAS a hash. `SWAPPING` alone is not enough: it starts
  // when the swap is handed to the signer, and until the hash comes back it is
  // the Sending node that is in flight. Showing Waiting then would put spinning
  // dots on two nodes at once, reading as two things happening simultaneously
  // when only one is.
  const isWaitingConfirm = isSwapping && !!swapHash && !isDone && !isError

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

  // The protocol explorer link, or null when there is nothing to link to.
  //
  // Only ever rendered under the SWAP hash, never the approval's: an approve is a
  // plain ERC-20 call that the router's own explorer knows nothing about.
  //
  // deBridge appears only once its order id has been resolved (a lookup that runs
  // after the receipt) — its page cannot be addressed without one. Relay's is
  // keyed on the tx hash, so it is there the moment the hash is.
  const protocolExplorer = (() => {
    const url = getProtocolExplorerUrl({ provider, hash: swapHash, requestId, chainId: Number(chainId) })
    const labelKey = getProtocolExplorerLabelKey(provider)
    if (!url || !labelKey) return null
    return {
      url,
      label: I18n.t(`v2.exchange.${labelKey}`, { locale: resolveLocale(language) }),
      icon: toPlatformExchange(provider) === PLATFORM_EXCHANGE.deBridge
        ? images.UIV2.icons.deBridgeExplorer
        : images.UIV2.icons.relayIcon
    }
  })()

  const renderProtocolExplorer = () => (
    <View style={styles.protocolExplorerRow}>
      <MyIcon variant='medium' uri={protocolExplorer.icon} />
      <TouchableOpacity activeOpacity={0.7} onPress={() => handleOpenUrl(protocolExplorer.url)}>
        <MyText className='text-brand'>{protocolExplorer.label}</MyText>
      </TouchableOpacity>
    </View>
  )

  // One timeline node, built as TWO stacked containers rather than one row:
  //
  //   ┌ head  ─ [icon] │ title + "approximate time"
  //   └ trail ─ [line] │ hash + copy, protocol link  (or the explorer hint)
  //
  // The same anatomy every chat timeline uses — the head/trail styles live in
  // the shared `TxStatusTimeline` stylesheet, so this, Supply and the shared
  // timeline itself stay identical. See that file for why the node is split.
  //
  // The connector is ALWAYS rendered, exactly as the shared timeline does it,
  // never gated on being the last node: a line that appeared only once the next
  // step arrived made the node visibly grow mid-flow, and the run's final node is
  // the StatusMessage result, which every step node connects down to anyway.
  const renderNode = ({ icon, title, hash, pending, copyable = true, showProtocolLink = false }) => (
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
          {hash ? (
            <>
              {renderHash(hash, copyable)}
              {showProtocolLink && protocolExplorer && renderProtocolExplorer()}
            </>
          ) : (
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
      {/* The balance check and the x402 gate deliberately have NO node here:
          nothing has been signed yet, so they are progress on the button
          ("Checking…"), not steps in the transaction history. */}

      {/* Leg 1..N — the ERC-20 approvals, shown only when they were needed. One
          node per transaction, so a token that needed its allowance zeroed first
          shows both hashes instead of hiding one of them. */}
      {hasApproveLeg && approveNodes.map((hash, index) => (
        <React.Fragment key={hash || `approve-${index}`}>
          {renderNode({
            // The same approve mark the Exchange screen's approve step uses, so
            // the legs are told apart at a glance instead of all reading as "send".
            icon: images.UIV2.icons.approve,
            title: t('supplyStepApprove'),
            hash,
            // Dots on the LAST approve node only, and for the whole step, hash or
            // no hash — they stop when the step does, which is the moment the
            // Sending node appears below. An earlier approve in the sequence has
            // already been confirmed on-chain, so leaving its dots running would
            // show two things happening at once.
            //
            // Not keyed on the hash: the flow records the hash and then stays in
            // APPROVING while it polls for the allowance to become visible
            // on-chain. That poll can run for a while, and dots that stopped at
            // the hash left the timeline looking finished and stuck.
            pending: isApproving && index === approveNodes.length - 1,
            // No copy button on the approval — it's a means to the swap, and the
            // hash is still tappable through to the explorer.
            copyable: false
          })}
        </React.Fragment>
      ))}

      {/* Leg 2 — the swap. Pending until its hash lands, at which point the dots
          move down to the Waiting node below: two nodes both showing dots would
          read as two things happening at once. */}
      {showSwapNode && renderNode({
        icon: images.UIV2.icons.icon_send_outline,
        title: t('sending'),
        hash: swapHash,
        pending: !swapHash && (isApproved || isSwapping),
        showProtocolLink: true
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

      {/* Terminal result — icon centred against the text either way. A lone title
          centres against the icon via the shared `statusResult`; when there IS a
          second line (the failure reason, or the estimated amount received) the
          icon centres on both lines together so the block reads as one unit. */}
      {showResult && (
        <StatusMessage
          variant={isDone ? 'success' : 'error'}
          title={isDone ? t('statusSuccess') : t('statusFailed')}
          titleConfig={{ className: isDone ? 'text-green' : 'text-red' }}
          message={resultMessage}
          // The received amount reads WHITE, like the Exchange screen's own
          // success line — it is the outcome the user came for, not a footnote.
          // A failure reason keeps StatusMessage's default medium: it is
          // secondary to the red title that already carries the bad news.
          messageConfig={isDone ? { className: 'text-white' } : undefined}
          style={resultMessage ? styles.statusResultWithMessage : timelineStyles.statusResult}
          autoplay={animate}
        />
      )}
    </View>
  )
}
