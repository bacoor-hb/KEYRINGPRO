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

const UIWidget = ({ action, onSend, onResult, onStatusChange, onCopyHash, onPersist }) => {
  const language = action.language
  // Tx lifecycle plumbing shared by every widget that signs and broadcasts.
  const txProps = { onResult, onStatusChange, onCopyHash, onPersist }
  switch (action.component) {
    case 'AddLiquidityForm':
      return <AddLiquidityForm props={action.props} onSend={onSend} language={language} />
    case 'ConfirmAddLiquidityTx':
      return <ConfirmAddLiquidityTx props={action.props} {...txProps} language={language} />
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
    case 'WalletNftList':
      return <WalletNftList props={action.props} />
    default:
      return null
  }
}

const MessageBubble = ({ message, onSend, onResult, onStatusChange, onCopyHash, onPersist, onSelectSuggestion, selectable }) => {
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

  return (
    <Animated.View style={[styles.row, isUser ? styles.rowUser : styles.rowBot, popStyle]}>
      <View style={isUser ? (hasUI ? styles.bubbleWithUI : undefined) : styles.botContainer}>
        {!!message.content && (
          isUser ? (
            <View style={[styles.bubble, styles.bubbleUser]}>
              <MyText
                selectable
              >{message.content}
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
              {message.content}
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
            // Scope persistence to THIS message + action index so the host can
            // write the tx state back onto the right uiAction.
            onPersist={onPersist ? (txState) => onPersist(message, idx, txState) : undefined}
          />
        ))}

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
  link: { color: Colors.BLUE5, textDecorationLine: 'underline' },
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
