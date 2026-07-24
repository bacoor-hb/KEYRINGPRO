import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  // No bg/radius here — the drawer wrapper renders MyLinearGradient + rounded-32.
  container: {
    flex: 1
  },

  // Header (avatar + name + disconnect)
  header: {
    height: pixelByHeight(64),
    // paddingHorizontal: pixelByWidth(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    flex: 1,
    marginRight: pixelByWidth(12)
  },
  avatar: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderRadius: getSizeImgSquare('large'),
    backgroundColor: Colors.BG_ICON_NO_BG
  },
  dappName: {
    color: Colors.WHITE,
    flexShrink: 1
  },
  disconnectBtn: {
    paddingHorizontal: pixelByWidth(11)
  },

  bodyScroll: {
    flex: 1,
    paddingTop: getHeightHeaderDrawer() + pixelByHeight(8)
  },
  body: {
    gap: pixelByHeight(14),
    // paddingTop: pixelByHeight(8),
    paddingBottom: pixelByHeight(24)
  },

  // URL rows
  urlSection: {
    alignSelf: 'stretch'
  },
  urlRow: {
    // flexDirection: 'row',
    // alignItems: 'center',
    // gap: pixelByWidth(12),
    paddingHorizontal: pixelByWidth(16)
  },
  urlRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    // Taller rows to match the design (~46) — uniform across URL + chains rows.
    minHeight: pixelByHeight(46),
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  urlText: {
    // color: Colors.TEXT_MEDIUM,
    // flex: 1
  },

  // Connected chains row — overlapping badges (design), horizontally scrollable.
  chainScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: pixelByHeight(2)
  },
  chainOverlap: {
    marginLeft: -pixelByWidth(6)
  },

  // Gas fee multiplier row
  gasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(14),
    paddingHorizontal: pixelByWidth(16),
    paddingVertical: pixelByHeight(14)
  },
  gasLabel: {
    color: Colors.TEXT_LOW
  },
  gasSliderWrap: {
    flex: 1,
    justifyContent: 'center'
  },
  sliderContainer: {
    height: pixelByHeight(20)
  },
  sliderTrack: {
    height: pixelByHeight(6),
    borderRadius: pixelByHeight(3),
    backgroundColor: Colors.BG_BOX_SMALL
  },
  sliderSelected: {
    backgroundColor: Colors.BRAND
  },
  sliderUnselected: {
    backgroundColor: Colors.BG_BOX_SMALL
  },
  sliderMarker: {
    // Nudge down so the thumb is vertically centered on the track (MultiSlider
    // renders the custom marker slightly high by default).
    marginTop: pixelByHeight(4),
    width: getSizeImgSquare('medium'),
    height: getSizeImgSquare('medium'),
    borderRadius: getSizeImgSquare('medium'),
    backgroundColor: Colors.WHITE
  },
  gasGwei: {
    color: Colors.TEXT_MEDIUM,
    minWidth: pixelByWidth(60),
    textAlign: 'right'
  },

  // Divider above the history list when no request precedes it — inset to the
  // card edges (cards use marginHorizontal 16).
  historyTopDivider: {
    height: 1,
    marginHorizontal: pixelByWidth(16),
    backgroundColor: Colors.BG_BOX_SMALL
  },

  // Empty state — bottom divider below the text, like the design.
  emptyWrap: {
    marginHorizontal: pixelByWidth(16),
    paddingVertical: pixelByHeight(50),
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  emptyText: {
    color: Colors.TEXT_LOW,
    textAlign: 'center'
  }
})

export default styles
