import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, width, fontSize } from 'common/styles'
import { FIELD_MIN_HEIGHT } from 'frontend/Screen/TokenDetailScreen/Component/SendToken/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width(100),
    paddingBottom: pixelByHeight(24)
  },
  inputWrapperArea: {
    minHeight: FIELD_MIN_HEIGHT,
    alignItems: 'center'
  },
  inputTextArea: {
    height: 'auto'
  },
  input: {
    flex: 1,
    color: Colors.WHITE,
    fontSize: fontSize(16),
    lineHeight: pixelByHeight(22),
    padding: 0,
    minHeight: pixelByHeight(22)
  },
  clearBtn: {
    marginLeft: pixelByWidth(8),
    marginTop: pixelByHeight(2),
    padding: pixelByWidth(2)
  },
  clearCircle: {
    width: pixelByWidth(22),
    height: pixelByWidth(22),
    borderRadius: pixelByWidth(11),
    backgroundColor: Colors.BG_BOX_SMALL,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearMark: {
    color: Colors.TEXT_MEDIUM,
    fontSize: fontSize(12),
    lineHeight: fontSize('small')
  },
  // StatusMessage lays out its own icon + message row; we only add the top gap
  // and center it (matches RegisterAddress's error StatusMessage).
  errorRow: {
    alignItems: 'center',
    paddingTop: pixelByHeight(16)
  }
})

export default styles
