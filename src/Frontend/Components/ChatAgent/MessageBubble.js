import React, { memo, useEffect, useRef } from 'react'
import { View, Platform, TouchableOpacity, Text } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Markdown from 'react-native-markdown-display'
import { pixelByWidth, pixelByHeight, Colors, fontSize, getFontFamily } from 'common/styles'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import GlassView from 'frontend/Components/UI/GlassView'
import AddLiquidityForm from './AddLiquidityForm'
import ConfirmAddLiquidityTx from './ConfirmAddLiquidityTx'
import SendNativeForm from './SendNativeForm'
import SendTokenForm from './SendTokenForm'
import SendNftForm from './SendNftForm'
import ApproveTokenForm from './ApproveTokenForm'
import SwapTokenForm from './SwapTokenForm'
import SupplyUsdcForm from './SupplyUsdcForm'
import LendingMarketList from './LendingMarketList'
import WalletNftList from './WalletNftList'
import InitSuggestions from './InitSuggestions'
import { getOptionsAt } from './InitSuggestions/suggestionTree'
import styles from './styles'

const formatTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

// Bot replies render as Markdown (bold / lists / clickable link titles). In
// selectable mode we override `textgroup` (the OUTER inline <Text> of each block)
// to be `selectable` — RN only honours `selectable` on the outermost Text, not
// nested ones. Links stay tappable via the default `link` rule, so users get both
// nice layout and copy/select.
const selectableMarkdownRules = {
  textgroup: (node, children, parent, styles) => (
    <Text key={node.key} style={styles.textgroup} selectable>
      {children}
    </Text>
  )
}

// Marker a reply may carry to say "render what follows BELOW the widgets".
// Must match MARKET_LIST_SPLIT in keyring-agent-core (marketButtons.ts) — the
// agent asks the model to emit this literal, and only that side can change it.
const SPLIT_MARKER = '[[LIST]]'

/**
 * Cut a bot reply into the part shown above the widgets and the part shown
 * below them.
 *
 * Only the lending market list asks for this today: a framing sentence belongs
 * before the list and the takeaway plus disclaimer belong after it, but the
 * model returns a single string that the bubble would otherwise render entirely
 * above the widget.
 *
 * Written to degrade safely, because the marker is model-produced and the model
 * does not always comply:
 *   - no marker (the overwhelming majority of replies) → everything stays above,
 *     exactly as before;
 *   - marker emitted more than once → split on the FIRST, and strip the rest, so
 *     a stray copy is never printed as raw text;
 *   - marker with nothing after it → the outro is empty and nothing renders.
 * The regex tolerates surrounding whitespace and the blank lines around it, so
 * the two halves never start or end with an orphaned newline.
 */
const splitAround = (content) => {
  if (typeof content !== 'string' || !content.includes(SPLIT_MARKER)) return [content, '']
  const [first, ...rest] = content.split(SPLIT_MARKER)
  // Any further markers were not asked for; drop them rather than show them.
  const tail = rest.join(' ')
  return [first.trim(), tail.trim()]
}

// A bubble only pops if it was appended while the screen was open. Restored
// history / seeded turns carry an old timestamp, so they mount already settled —
// otherwise every row would pop again as the inverted list recycles cells during
// a scroll back through the conversation.
const POP_FRESHNESS_MS = 1000

// Pivot offsets, in px, that fake a bottom-RIGHT transform-origin. Half the
// bubble's max width / a typical bubble height — exact values don't need to
// track the real measured size: the offset only has to bias the growth toward
// the composer corner, and it lands at 0 once scale reaches 1. Always rightward
// because only user bubbles animate, and those are right-aligned.
const BUBBLE_PIVOT_X = pixelByWidth(120)
const BUBBLE_PIVOT_Y = pixelByHeight(18)
// Extra upward drift at the start, so the bubble looks like it is being pushed
// up out of the input rather than just inflating in place.
const POP_RISE = pixelByHeight(10)

// iMessage's send animation: the bubble springs up from small, overshoots
// slightly, then settles. `damping` low enough to leave a visible bounce,
// `stiffness` high enough that it still feels snappy rather than floaty.
const POP_SPRING = {
  damping: 12,
  stiffness: 180,
  mass: 0.6,
  overshootClamping: false,
  reduceMotion: ReduceMotion.System
}

// Springs a just-sent USER bubble in from 70% scale + a small upward nudge,
// fading as it grows. Bot replies never animate: they stream in token by token,
// so a mount-time pop would fire on a nearly-empty bubble and then sit still
// while the text fills in — the motion would be attached to the wrong moment.
const usePopIn = (message, isUser) => {
  // Decided ONCE per mounted row: re-evaluating on every render would let a row
  // flip to "not fresh" mid-flight and freeze the animation half-played.
  const shouldPop = useRef(
    isUser && Date.now() - (message.timestamp || 0) < POP_FRESHNESS_MS
  ).current

  const progress = useSharedValue(shouldPop ? 0 : 1)
  const opacity = useSharedValue(shouldPop ? 0 : 1)

  useEffect(() => {
    if (!shouldPop) return
    progress.value = withSpring(1, POP_SPRING)
    // Opacity gets its own short timing curve — springing it too would make the
    // bubble visibly dip back toward transparent at the overshoot.
    opacity.value = withTiming(1, { duration: 140, reduceMotion: ReduceMotion.System })
  }, [shouldPop, progress, opacity])

  const style = useAnimatedStyle(() => {
    const scale = 0.7 + 0.3 * progress.value
    // Scale about the bubble's bottom-right corner, the way iMessage grows a
    // bubble out of the composer. Without this it would balloon from its centre.
    const pivotX = (1 - scale) * BUBBLE_PIVOT_X
    const pivotY = (1 - scale) * BUBBLE_PIVOT_Y
    return {
      opacity: opacity.value,
      transform: [
        { translateX: pivotX },
        { translateY: pivotY + (1 - progress.value) * POP_RISE },
        { scale }
      ]
    }
  })

  return style
}

const UIWidget = ({ action, onSend, onResult, onStatusChange, onCopyHash, onPersist, onPropsUpdate, screenRef, messageTimestamp }) => {
  const language = action.language
  // Tx lifecycle plumbing shared by every widget that signs and broadcasts.
  // screenRef rides along so a widget can open a screen-level drawer.
  const txProps = { onResult, onStatusChange, onCopyHash, onPersist, onPropsUpdate, screenRef }
  switch (action.component) {
    case 'AddLiquidityForm':
      return <AddLiquidityForm props={action.props} onSend={onSend} language={language} />
    case 'ConfirmAddLiquidityTx':
      // messageTimestamp: when the agent built this quote. The widget expires
      // itself once a failed attempt lands too long after it (see EXPIRY_MS).
      return <ConfirmAddLiquidityTx props={action.props} {...txProps} language={language} messageTimestamp={messageTimestamp} />
    // Wallet-action forms. Each collects what the agent could not resolve, then
    // signs and broadcasts the transaction itself — the agent is not asked to
    // confirm.
    case 'SendNativeForm':
      return <SendNativeForm props={action.props} {...txProps} language={language} />
    case 'SendTokenForm':
      return <SendTokenForm props={action.props} {...txProps} language={language} />
    case 'SendNftForm':
      return <SendNftForm props={action.props} {...txProps} language={language} />
    case 'ApproveTokenForm':
      return <ApproveTokenForm props={action.props} {...txProps} language={language} />
    // Swap / buy — one card, one payload. A buy and a swap are the same
    // transaction under two framings, so both tools ship this, differing only in
    // `intent` (which decides the wording and which x402 route is charged).
    //
    // Unlike every other widget here it can be TWO transactions (approve → swap),
    // which is why it drives its own flow and timeline. And unlike the confirm
    // card it replaced, it quotes on the FE for the amount currently on screen —
    // so no `messageTimestamp`: there is no agent-built quote left to go stale.
    case 'SwapTokenForm':
      return <SwapTokenForm props={action.props} {...txProps} language={language} />
    // Supplying USDC into a lending market. Like the forms above it signs and
    // broadcasts locally — but as an approve → deposit sequence, decided from
    // the market's current allowance at submit time.
    case 'SupplyUsdcForm':
      return <SupplyUsdcForm props={action.props} {...txProps} language={language} />
    case 'WalletNftList':
      // onSend is only used in picker mode ('which of these NFTs?'), where
      // tapping a card submits that NFT's prompt as the next turn.
      return <WalletNftList props={action.props} onSend={onSend} language={language} />
    // The lending-market shortlist. Rendered rather than written into the reply
    // because each market carries its OWN "More detail" button, and
    // `actionButtons` below can only stack under the whole message — see the
    // component's own notes.
    case 'LendingMarketList':
      return <LendingMarketList props={action.props} onSend={onSend} language={language} />
    default:
      return null
  }
}

const MessageBubble = ({ message, onSend, onResult, onStatusChange, onCopyHash, onPersist, onPropsUpdate, onSelectSuggestion, selectable, screenRef }) => {
  const isUser = message.role === 'user'
  const hasUI = message.uiActions && message.uiActions.length > 0
  const actionButtons = Array.isArray(message.actionButtons) ? message.actionButtons : []
  // Init-suggestion pills belonging to THIS message (see suggestionTree.js).
  // Stored as a PATH of node keys rather than the nodes themselves: messages are
  // persisted to storage, and the nodes hold functions (title/prompt) that would
  // not survive that round-trip. Resolving the path at render also means the
  // labels re-translate on a language switch.
  //
  // Distinct from actionButtons: those always send a prompt to the agent, while
  // a suggestion node may instead be a branch that drills down locally — so it
  // is routed through onSelectSuggestion rather than onSend.
  const suggestionPath = message.suggestionPath
  const popStyle = usePopIn(message, isUser)

  // A bot reply may be written in two parts, split by SPLIT_MARKER: the intro
  // renders above the widgets and the closing notes below them. See splitAround.
  const [intro, outro] = isUser ? [message.content, ''] : splitAround(message.content)

  return (
    <Animated.View style={[styles.row, isUser ? styles.rowUser : styles.rowBot, popStyle]}>
      <View style={isUser ? (hasUI ? styles.bubbleWithUI : undefined) : styles.botContainer}>
        {!!intro && (
          isUser ? (
            <View style={[styles.bubble, styles.bubbleUser]}>
              <MyText
                selectable
              >{intro}
              </MyText>
              <View style={styles.timestampRow}>
                <MyText variant='small' className='text-medium'>{formatTime(message.timestamp)}</MyText>
                <MyIcon uri={images.UIV2.icons.gray_check_Icon} style={styles.checkIcon} />
              </View>
            </View>
          ) : (
            // Bot replies: always Markdown (bold / lists / clickable link titles).
            // In selectable mode a custom text rule keeps the text long-press
            // selectable/copyable while link titles stay tappable.
            <Markdown style={mdStyles} rules={selectable ? selectableMarkdownRules : undefined}>
              {intro}
            </Markdown>
          )
        )}

        {/* UI widgets below the text */}
        {hasUI && message.uiActions.map((action, idx) => (
          <UIWidget
            key={idx}
            action={action}
            onSend={onSend}
            onResult={onResult}
            onStatusChange={onStatusChange}
            onCopyHash={onCopyHash}
            screenRef={screenRef}
            messageTimestamp={message.timestamp}
            // Scope persistence to THIS message + action index so the host can
            // write the tx state back onto the right uiAction.
            onPersist={onPersist ? (txState) => onPersist(message, idx, txState) : undefined}
            // Same scoping for a widget rewriting its OWN props — the swap
            // form's refreshed spendable balance, which lives on props rather
            // than in the tx state above.
            onPropsUpdate={onPropsUpdate ? (patch) => onPropsUpdate(message, idx, patch) : undefined}
          />
        ))}

        {/* The second half of a split reply — the takeaway and the caveats that
            belong AFTER a list, which is where a reader looks for them. Empty
            for every reply that carries no marker, i.e. almost all of them. */}
        {!!outro && (
          <Markdown style={mdStyles} rules={selectable ? selectableMarkdownRules : undefined}>
            {outro}
          </Markdown>
        )}

        {/* Action buttons below the reply (token / chain picks, etc.) — stacked
            one per row, each a colorless (clear) liquid-glass pill. */}
        {actionButtons.length > 0 && (
          <View style={styles.actionList}>
            {actionButtons.map((btn, idx) => (
              <TouchableOpacity
                key={`${btn.prompt}-${idx}`}
                activeOpacity={0.8}
                style={styles.actionBtnWrap}
                // The button's prompt is often synthetic English — pass its
                // language so the next turn's reply stays in the user's language.
                onPress={() => onSend(btn.prompt, btn.language)}
              >
                <GlassView interactive effect='clear' style={styles.actionBtn}>
                  <MyText style={styles.actionBtnText}>{btn.label}</MyText>
                </GlassView>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Init-suggestion pills for this message. They live IN the thread (not
            floating below it) so every level the user has drilled through stays
            on screen and stays tappable — tapping an older level again simply
            appends that branch as a new turn at the end. */}
        {suggestionPath && (
          <InitSuggestions
            options={getOptionsAt(suggestionPath)}
            path={suggestionPath}
            onSelect={onSelectSuggestion}
            // Set only when the menu was reached by TYPING, where the
            // conversation's language can differ from the app's. Absent on the
            // tap path, which stays on the app language.
            locale={message.suggestionLocale}
          />
        )}
      </View>
    </Animated.View>
  )
}

export default memo(MessageBubble, (prev, next) =>
  prev.message.timestamp === next.message.timestamp &&
  prev.message.content === next.message.content &&
  prev.message.uiActions === next.message.uiActions &&
  prev.message.actionButtons === next.message.actionButtons &&
  prev.message.suggestionPath === next.message.suggestionPath &&
  prev.message.suggestionLocale === next.message.suggestionLocale &&
  prev.selectable === next.selectable
)

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

// Markdown styles for the non-selectable mode (bold / lists / links). Dark-mode
// only. Plain object since it's passed whole to <Markdown>.
const mdStyles = {
  body: { color: Colors.WHITE, fontSize: fontSize(16.5), lineHeight: fontSize(16.5) * 1.5, fontFamily: getFontFamily() },
  paragraph: { marginTop: 0, marginBottom: pixelByHeight(8) },
  heading1: { color: Colors.WHITE, fontSize: fontSize(19), lineHeight: fontSize(19) * 1.5, fontFamily: getFontFamily(), marginTop: pixelByHeight(8), marginBottom: pixelByHeight(4) },
  heading2: { color: Colors.WHITE, fontSize: fontSize(17), lineHeight: fontSize(17) * 1.5, fontFamily: getFontFamily(), marginTop: pixelByHeight(8), marginBottom: pixelByHeight(4) },
  heading3: { color: Colors.WHITE, fontSize: fontSize(16), lineHeight: fontSize(16) * 1.5, fontFamily: getFontFamily(), marginTop: pixelByHeight(5) },
  strong: { color: Colors.WHITE },
  em: { fontStyle: 'italic' },
  link: { color: Colors.BRAND, textDecorationLine: 'underline' },
  bullet_list: { marginVertical: pixelByHeight(2) },
  ordered_list: { marginVertical: pixelByHeight(2) },
  list_item: { marginVertical: pixelByHeight(2) },
  code_inline: {
    backgroundColor: Colors.BG_BOX_SMALL,
    color: Colors.WHITE,
    borderRadius: 4,
    paddingHorizontal: 4,
    fontFamily: MONO
  },
  fence: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    color: Colors.WHITE,
    borderRadius: 8,
    padding: pixelByWidth(11),
    fontFamily: MONO,
    borderWidth: 0
  },
  code_block: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    color: Colors.WHITE,
    borderRadius: 8,
    padding: pixelByWidth(11),
    fontFamily: MONO,
    borderWidth: 0
  },
  blockquote: {
    backgroundColor: Colors.BG_BOX_SMALL,
    borderLeftColor: Colors.BLUE5,
    borderLeftWidth: 3,
    paddingHorizontal: pixelByWidth(11),
    marginVertical: pixelByHeight(4)
  }
}
