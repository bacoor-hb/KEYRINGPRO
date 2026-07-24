import { StyleSheet } from 'react-native'
import { getSizeImgSquare, pixelByHeight, pixelByWidth, width } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    width: width(100),
    paddingBottom: pixelByHeight(24)
  },
  // Gray trailing chevron on each option row, matching the Home account rows.
  arrowRight: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small'),
    flexShrink: 0
  },
  optionList: {
    paddingTop: pixelByHeight(8)
  },
  infoBox: {
    paddingTop: pixelByHeight(16),
    paddingHorizontal: pixelByWidth(8),
    gap: pixelByHeight(12)
  },
  infoHeading: {
    lineHeight: pixelByHeight(22)
  },
  infoText: {
    lineHeight: pixelByHeight(22)
  }
})

export default styles
