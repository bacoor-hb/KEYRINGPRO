import { StyleSheet } from 'react-native'
import { Colors, pixelByWidth, pixelByHeight, getSizeImgSquare } from 'common/styles'

const styles = StyleSheet.create({
  // No container gap — pills are spaced via each row's vertical padding, which
  // also leaves room for the interactive glass press animation.
  list: {
    marginTop: pixelByHeight(5)
  },
  btnWrap: {
    paddingVertical: pixelByHeight(3)
  },
  btn: {
    // Border/fill come from GlassView's fallback (or the native glass edge) —
    // adding one here would double up with GlassView's hairline.
    minHeight: getSizeImgSquare('large'),
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: pixelByWidth(15),
    paddingVertical: pixelByHeight(10)
  },
  btnText: {
    textAlign: 'center',
    color: Colors.WHITE
  }
})

export default styles
