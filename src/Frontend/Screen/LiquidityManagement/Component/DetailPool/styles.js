import { StyleSheet } from 'react-native'
import { Colors, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare, width } from 'common/styles'

// Chart grid: 8 horizontal lines laid out as 8 equal flex rows, each line pinned
// to the bottom of its row. So the gaps are equal on any device with no pixel
// math, and the LAST line lands exactly on the container floor — which the chart
// (contentInset.bottom = 0) also rests on, so the price curve sits right on it.
// The last line is rendered darker (the chart baseline); the first 7 are faint.
export const GRID_LINE_COUNT = 8
// Fixed visible height of the chart/grid area.
const CHART_HEIGHT = 122

const styles = StyleSheet.create({
  container: {
    width: width(100),
    flex: 1,
    // Override MyViewPage's default horizontal padding — children pad themselves so the
    // range track can run edge-to-edge (with its own padding) without clipping the arrows.
    paddingHorizontal: 0,
    gap: pixelByHeight(8)
  },
  // Standard horizontal page padding, applied per child instead of on MyViewPage.
  sectionPadding: {
    paddingHorizontal: pixelByWidth(16)
  },
  flex1: {
    flex: 1
  },
  // Full-screen loading / empty state — fills the area below the header and centers
  // its content (dots loader, or the noData icon + label like the pool list empty).
  fullScreenState: {
    paddingVertical: pixelByHeight(50),
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: pixelByHeight(8)
  },
  emptyIcon: {
    marginBottom: pixelByHeight(8)
  },
  scrollContent: {
    paddingBottom: pixelByHeight(32)
  },
  section: {
    gap: pixelByHeight(12),
    paddingHorizontal: pixelByWidth(16)
  },
  rangeMeterBox: {
    paddingVertical: pixelByHeight(12)
  },
  fullRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: width(100) - pixelByWidth(16) * 2,
    flex: 1,
    justifyContent: 'space-between'
  },
  // Single track outline wrapping the three inner line segments (gray/white/gray) with
  // a 2px padding, so the surrounding border is one unbroken line. overflow:'visible' lets
  // the arrows (children, sitting just below the track) render past the rounded corners
  // without being clipped; the section's horizontal padding keeps the edge arrows (at
  // 0% / 100%) inside the drawer card.
  rangeTrackBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelByHeight(5),
    borderWidth: pixelByHeight(0.5),
    borderColor: '#4C515A',
    padding: pixelByHeight(2),
    overflow: 'visible'
  },
  rangeSegment: {
    flex: 1,
    borderRadius: pixelByHeight(5),
    height: pixelByHeight(5),
    backgroundColor: '#28292E'
  },
  imgIconToken: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small'),
    borderRadius: getSizeImgSquare('small') / 2,
    backgroundColor: Colors.BG_ICON_NO_BG
  },
  arrowRange: {
    width: sizeImageSquare(13),
    height: sizeImageSquare(13)
  },
  textStatusRange: {
  },
  rangePercentBig: {
  },
  rangePercentSmall: {
  },
  divider: {
    height: pixelByHeight(1),
    backgroundColor: Colors.BG_BOX_SMALL,
    marginVertical: pixelByHeight(22),
    // marginHorizontal (not padding) so the colored line itself insets to match the
    // sections, now that MyViewPage no longer pads the page horizontally.
    marginHorizontal: pixelByWidth(16)
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  chartWrap: {
    height: pixelByHeight(CHART_HEIGHT),
    overflow: 'hidden',
    position: 'relative'
  },
  chart: {
    flex: 1
  },
  // Full-height overlay split into GRID_LINE_COUNT equal flex rows; each line is
  // pinned to the bottom of its row, so the gaps are equal and the last line sits
  // exactly on the container floor (where the chart curve rests too).
  chartGridLines: {
    ...StyleSheet.absoluteFillObject
  },
  chartGridRow: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  chartGridLine: {
    height: pixelByHeight(1),
    backgroundColor: Colors.BG_BOX_SMALL,
    opacity: 0.3
  },
  // The 8th / bottom line is the chart baseline — brighter so it reads as the
  // floor the area fill rests on.
  chartGridLineFloor: {
    backgroundColor: Colors.BG_BOX_SMALL,
    opacity: 1
  }
})

export default styles
