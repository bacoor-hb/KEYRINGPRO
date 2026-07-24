import { StyleSheet } from 'react-native'
import { width, Colors, getHeightHeader, pixelByHeight, sizeImageSquare, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    paddingVertical: pixelByWidth(16),
    gap: pixelByHeight(14),
    // Reserve the floating (blur) header height so the title starts below it while
    // the tutorial scrolls UNDER the blur. Matches the registered PoolList.
    paddingTop: getHeightHeader(true)
  },
  title: {
    paddingBottom: pixelByHeight(4)
  },
  imgTutorial: {
    width: width(100) - pixelByWidth(16) * 2,
    height: width(100) - pixelByWidth(40) * 2
  },
  imgWrapper: {
    padding: pixelByWidth(8)
  },
  imgTutorialStep: {
    width: width(100) - pixelByWidth(16 + 8) * 2,
    height: width(100) - pixelByWidth(16 + 8) * 2
  },
  containerStep: {
    padding: pixelByWidth(8)
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: pixelByHeight(8)
  },
  stepTitle: {
    flex: 1,
    paddingLeft: pixelByWidth(16)
  },
  boxNumber: {
    // Colors below are local fallbacks — no matching Tailwind tokens exist.
    backgroundColor: '#383940',
    width: sizeImageSquare(24),
    height: sizeImageSquare(24),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999
  },
  textNumber: {
    color: Colors.TEXT_MEDIUM
  }
})

export default styles
