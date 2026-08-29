import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'

// Half the slider thumb — pads the track so the thumb at either extreme stays
// inside the wrap instead of overlapping the label / card edge.
const SLIDER_PAD = sizeImageSquare(11)

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
    // Small gap: the slider wrap already reserves SLIDER_PAD on its right for the
    // thumb, so a large gap here reads as a hole between the bar and the label.
    gap: pixelByWidth(8),
    paddingHorizontal: pixelByWidth(16),
    paddingVertical: pixelByHeight(14)
  },
  gasLabel: {
    color: Colors.TEXT_LOW
  },
  gasSliderWrap: {
    flex: 1,
    paddingHorizontal: SLIDER_PAD,
    justifyContent: 'center'
  },
  // Measured child — trackWidth excludes the thumb padding above.
  gasSliderMeasure: {
    width: '100%'
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
    // FIXED width (not minWidth): the value now updates live while dragging and
    // changes width ("1x" -> "10.4x"); a growing label would shrink the flex:1
    // slider, re-measure trackWidth and make the bar/thumb jump under the finger.
    // Sized to fit the longest value ("9.8x Gwei") at the default 16.5px, so the
    // right-aligned text sits close to the slider without needing to shrink.
    width: pixelByWidth(86),
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
