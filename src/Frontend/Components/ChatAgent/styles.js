import { StyleSheet } from 'react-native'
import { pixelByWidth, pixelByHeight, Colors, sizeImageSquare, getSizeImgSquare } from 'common/styles'

const styles = StyleSheet.create({
  // ===== Action buttons (under a reply) =====
  // Stacked one per row; the border keeps a visible edge on both the native
  // glass (iOS 26) and the plain-View fallback.
  actionList: {
    // No container gap — buttons are spaced via per-row vertical padding
    // (actionBtnWrap). Horizontal room for the interactive glass press effect
    // comes from the list's own 16px inset (see AISearch listContent), so the
    // pills stay flush-aligned with the message text.
    marginTop: pixelByHeight(5)
  },
  // Vertical padding only: spaces the buttons apart and gives the glass press
  // animation room above/below. No horizontal padding — the pills align with
  // the message text edges.
  actionBtnWrap: {
    paddingVertical: pixelByHeight(3)
  },
  actionBtn: {
    // Border/fill come from GlassView's fallback (or the native glass edge) — no
    // own border here, otherwise it doubles up with GlassView's hairline.
    minHeight: sizeImageSquare(44),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: pixelByWidth(15),
    paddingVertical: pixelByHeight(10)
  },
  actionBtnText: {
    textAlign: 'center',
    color: Colors.WHITE
  },

  // ===== Bubble row =====
  row: {
    flexDirection: 'row',
    marginVertical: pixelByHeight(4),
    alignItems: 'flex-end'
  },
  rowUser: {
    justifyContent: 'flex-end'
  },
  rowBot: {
    justifyContent: 'flex-start'
  },
  // Bot reply: plain markdown text, takes the row width so it wraps naturally.
  botContainer: {
    flex: 1,
    paddingVertical: pixelByHeight(4)
  },

  // ===== User bubble =====
  bubble: {
    maxWidth: pixelByWidth(282),
    paddingHorizontal: pixelByWidth(13),
    paddingVertical: pixelByHeight(10),
    borderRadius: 20
  },
  bubbleUser: {
    backgroundColor: Colors.BG_BOX_SMALL,
    borderTopRightRadius: 0
  },
  // Timestamp + read-check icon, aligned to the bubble's right edge.
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: pixelByWidth(4)
  },
  checkIcon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },

  // ===== Bubble with embedded UI widget =====
  bubbleWithUI: {
    flex: 1,
    maxWidth: pixelByWidth(331)
  },

  // ===== Date separator (between days) =====
  dateSeparator: {
    alignItems: 'center'
    // marginVertical: pixelByHeight(10)
  },
  dateSeparatorText: {
    color: Colors.TEXT_MEDIUM
  },

  // ===== Typing indicator =====
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pixelByWidth(13),
    paddingVertical: pixelByHeight(10)
  },
  // Dots with no row margins/padding — for tight hosts like the round
  // jump-to-bottom button, which centers the content itself.
  typingBare: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  typingDot: {
    width: pixelByWidth(7),
    height: pixelByWidth(7),
    borderRadius: pixelByWidth(4),
    marginHorizontal: pixelByWidth(2),
    backgroundColor: Colors.GRAY1
  }
})

export default styles
