import { StyleSheet } from 'react-native'
import { Colors, getHeightHeader, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: pixelByHeight(24),
    // Reserve the floating (blur) header's height so the title/Overview start
    // below it while the list scrolls UNDER the blur. Matches Send/Received history.
    paddingTop: getHeightHeader(true)
  },
  divider: {
    height: pixelByHeight(1),
    backgroundColor: Colors.BG_BOX_SMALL,
    marginVertical: pixelByHeight(14)
  },
  card: {
    gap: pixelByHeight(8)
  },
  cardHidden: {
    opacity: 0.3
  },
  itemRow: {
    gap: pixelByHeight(4)
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    marginVertical: pixelByHeight(4)
  },
  tokenIcons: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  tokenIconOverlap: {
    marginLeft: -pixelByWidth(12)
  },
  pairNameBox: {
    flex: 1,
    overflow: 'hidden'
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  flex1: {
    flex: 1
  },
  feesCollected: {
    color: '#ecca62'
  },
  footerNote: {
    textAlign: 'center'
  },
  footer: {
    gap: pixelByHeight(14),
    paddingTop: pixelByHeight(14)
  },
  footerChains: {
    alignItems: 'center',
    gap: pixelByHeight(14)
  },
  chainIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  actionsBox: {
    // Explicit column width. Wider than the round button so the action label below
    // it isn't clipped (mirrors TokenList's 64px swipe column). Matches
    // SWIPE_ACTIONS_WIDTH so the translated panel slides fully into view.
    width: getSizeImgSquare('large') + pixelByWidth(32),
    flexDirection: 'column',
    alignItems: 'center',
    paddingLeft: pixelByWidth(32),
    gap: pixelByWidth(12),
    justifyContent: 'space-between',
    marginVertical: pixelByHeight(4)
  },
  action: {
    alignItems: 'center',
    gap: pixelByHeight(4),
    width: getSizeImgSquare('large'),
    justifyContent: 'center'
  },
  // Dimmed state for an action that is shown but has nothing to open (e.g. a
  // position with no initialHash) — keeps the column layout stable.
  actionDisabled: {
    opacity: 0.3
  },
  actionIcon: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderRadius: getSizeImgSquare('large') / 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loaderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: pixelByHeight(48)
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: pixelByHeight(8),
    paddingVertical: pixelByHeight(48)
  },
  emptyIcon: {
    marginBottom: pixelByHeight(8)
  },
  loader: {
    width: sizeImageSquare(64),
    height: sizeImageSquare(64)
  }
})

export default styles
