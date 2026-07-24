import { StyleSheet } from 'react-native'
import { getSizeImgSquare, pixelByHeight, pixelByWidth, width } from 'common/styles'
import { FIELD_MIN_HEIGHT } from 'frontend/Screen/TokenDetailScreen/Component/SendToken/styles'

const styles = StyleSheet.create({
  container: {
    width: width(100),
    paddingBottom: pixelByHeight(24)
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: pixelByWidth(12)
  },
  inputWrap: {
    flex: 1
  },
  // Reserve 2 lines (the 2-line placeholder height) and top-align the text so the
  // multiline field doesn't shrink from 2 lines to 1 when the user starts typing.
  inputWrapperArea: {
    minHeight: FIELD_MIN_HEIGHT,
    alignItems: 'flex-start'
  },
  pasteBtn: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  descBox: {
    paddingTop: pixelByHeight(6)
  },
  statusError: {
    alignItems: 'center',
    paddingTop: pixelByHeight(14)

  },
  // Success row: green badge + "Registered address", left-aligned and vertically centered.
  statusSuccess: {
    paddingTop: pixelByHeight(6),
    alignItems: 'center'
  }
})

export default styles
