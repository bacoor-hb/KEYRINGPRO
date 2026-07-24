import { StyleSheet } from 'react-native'
import { Colors, getHeightHeader, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    paddingTop: getHeightHeader(true)
  },
  contentContainer: {
    flexGrow: 1
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: pixelByHeight(24)
  },
  formSection: {
    paddingTop: pixelByHeight(4)
  },
  titlePage: {
    paddingVertical: pixelByHeight(12),
    color: Colors.WHITE
  },
  inputGroup: {
    gap: pixelByHeight(14),
    marginBottom: pixelByHeight(14)
  },
  hintText: {
    color: Colors.TEXT_LOW,
    paddingLeft: pixelByWidth(36),
    paddingTop: pixelByHeight(8)
  },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: pixelByWidth(12),
    marginTop: pixelByHeight(4)
  },
  agreeText: {
    flex: 1,
    color: Colors.TEXT_MEDIUM,
    lineHeight: pixelByHeight(22)
  },
  leftIconWrapper: {
    width: getSizeImgSquare('large'),
    alignItems: 'center',
    justifyContent: 'center'
  }
})

export default styles
