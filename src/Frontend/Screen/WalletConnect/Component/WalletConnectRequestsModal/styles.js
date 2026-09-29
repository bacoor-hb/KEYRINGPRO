import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'

// Half the slider thumb — pads the track so the thumb at either extreme stays
// inside the wrap instead of overlapping the label / card edge.
const SLIDER_PAD = sizeImageSquare(11)

// Height the pinned "Change account" footer takes: its top padding + the button
// (MyButton size 'small' = pixelByHeight(44)) + the home-indicator inset.
const FOOTER_PADDING_TOP = pixelByHeight(12)
const FOOTER_BUTTON_HEIGHT = pixelByHeight(44)
const FOOTER_HEIGHT = FOOTER_PADDING_TOP + FOOTER_BUTTON_HEIGHT + getSafeAreaValues().bottom

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

  // The space for the pinned (absolute) header belongs to the CONTENT container,
  // not to the ScrollView's own style. On Android, style padding offsets the
  // content but is NOT counted in the native scroll range, so the last
  // ~paddingTop px of a long list can never be scrolled into view (it stays
  // hidden behind the pinned "Change account" footer). iOS accounts for it,
  // which is why the bug is Android-only. Same pattern as the connect modal.
  bodyScroll: {
    flex: 1
  },
  body: {
    gap: pixelByHeight(14),
    paddingTop: getHeightHeaderDrawer() + pixelByHeight(8),
    paddingBottom: pixelByHeight(24)
  },
  // Applied on top of `body` only while the pinned footer is rendered: it floats
  // OVER the body, so the room it needs has to come from the content padding
  // (same reason as paddingTop above — Android leaves ScrollView style padding
  // out of the native scroll range, making the last rows unreachable).
  bodyFooterSpace: {
    paddingBottom: FOOTER_HEIGHT + pixelByHeight(24)
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

  // "Change account" action pinned at the bottom of the sheet. Absolute (like the
  // absolute TitleDrawer at the top) rather than a sibling below the ScrollView:
  // as a sibling it would cut the scroll body short and nothing could ever pass
  // behind it — the list has to scroll BEHIND the button's glass. The space it
  // covers is reserved in the scroll content via `bodyFooterSpace`.
  changeAccountFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: pixelByWidth(16),
    paddingTop: FOOTER_PADDING_TOP,
    paddingBottom: getSafeAreaValues().bottom
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
