import { StyleSheet } from 'react-native'
import { Colors, fontSize, getSizeImgSquare, pixelByHeight, pixelByWidth, width } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: pixelByHeight(16)
  },
  headerWrap: {
    paddingHorizontal: pixelByWidth(0),
    marginBottom: pixelByHeight(0)
  },
  // Net-worth loading GIF, pinned to the bottom-right of the balance row so it
  // sits flush just above the divider line (the 1px divider sits at headerWrap's
  // bottom edge). Same size/treatment as the old Home screen.
  networthGifWrap: {
    position: 'absolute',
    right: 0,
    bottom: 1
  },
  networthGif: {
    width: width(12),
    height: width(12)
  },
  // Balance line — text (flex:1) + optional trailing offline icon, centered.
  // Use `gap` for spacing (not a margin on the icon): MyIcon/ImageRender applies
  // the icon `style` to both the overflow:hidden wrapper AND the inner image, so
  // a marginLeft on the icon would shift the image inside its clip box and cut it.
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  totalValue: {
    // flex:1 gives `autoFit` a bounded width to shrink into (a Text with no
    // bound would never trigger adjustsFontSizeToFit) while leaving room on the
    // row for the trailing offline icon.
    flex: 1,
    color: Colors.WHITE
    // fontSize: fontSize(32),
    // lineHeight: fontSize(40)
  },
  // While the net-worth GIF is shown (absolute, top-right), keep the balance text
  // from running under it so the auto-fit shrink targets the remaining width.
  totalValueWithGif: {
    paddingRight: width(12) + pixelByWidth(8)
  },
  // Offline: dim the (potentially stale) balance to Text_Low, matching the design.
  totalValueOffline: {
    color: Colors.TEXT_LOW
  },
  // "Update: ..." last-synced label — under the balance, Text_Low always.
  syncLabel: {
    color: Colors.TEXT_LOW
  },
  // noInternet icon — inline at the end of the balance row, tinted Text_Low.
  // No margin here (see balanceRow.gap) — margin would clip the image.
  offlineIcon: {
    tintColor: Colors.TEXT_LOW
  },
  divider: {
    height: 1,
    backgroundColor: Colors.BG_BOX_SMALL,
    marginTop: pixelByHeight(4)
  },
  listContent: {
    paddingBottom: pixelByHeight(8),
    flexGrow: 1
  },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: pixelByWidth(16),
    paddingTop: pixelByHeight(48),
    alignItems: 'center'
  },
  emptyIcon: {
    marginBottom: pixelByHeight(8)
  },
  emptyTitle: {
    fontSize: fontSize('small')
  },
  emptySpacer: {
    paddingVertical: pixelByHeight(50)
  },
  emptyHint: {
    color: Colors.TEXT_LOW,
    marginBottom: pixelByHeight(14)
  },
  footerWrap: {
    alignItems: 'center',
    paddingTop: pixelByHeight(16),
    paddingBottom: pixelByHeight(24)
  },
  // Swipe-left "Hide" action — yellow circular button + label below. Content
  // hugs the right edge so it sits flush with the row edge; bottom border
  // extends the row divider across the swipe area for a continuous line.
  // height:'100%' makes the action stretch to the swipeable container height
  // (which matches the row) — without it the action is shorter than `content`
  // (because MyText's lineHeight pads `content` taller) and its bottom border
  // sits above the row divider.
  swipeHideAction: {
    width: pixelByWidth(64),
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: pixelByWidth(0),
    gap: pixelByHeight(4),
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  swipeHideButton: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderRadius: getSizeImgSquare('large') / 2,
    backgroundColor: '#FFCB45CC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  swipeHideLabel: {
    color: Colors.TEXT_MEDIUM
  }
})

export default styles
