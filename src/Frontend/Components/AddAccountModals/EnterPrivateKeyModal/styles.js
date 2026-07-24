import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, width, fontSize, getSafeAreaValues, getFontFamily, getSizeImgSquare } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width(100),
    paddingBottom: getSafeAreaValues().bottom
  },
  // Dimmed look for the disabled (success-state) back button. Opacity lives on
  // <BtnBack>'s button root (has bg+border / liquid glass in both states, never
  // flattened) so toggling it across modes is Fabric-safe — see pitfall #2.
  backDisabled: {
    opacity: 0.4
  },
  // Icon size for the header back/account button (inside <BtnBack>).
  backIcon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },
  errorScroll: {
    flex: 1
  },
  errorScrollContent: {
    paddingLeft: getSizeImgSquare('large') + pixelByWidth(12),
    paddingBottom: pixelByHeight(24),
    gap: pixelByHeight(8)
  },
  inputBox: {
    minHeight: pixelByHeight(48),
    paddingTop: pixelByHeight(8),
    paddingBottom: pixelByHeight(12),
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  inputDisplay: {
    color: Colors.WHITE
  },
  inputPlaceholder: {
    color: Colors.TEXT_LOW
  },
  counter: {
    paddingTop: pixelByHeight(12),
    paddingBottom: pixelByHeight(12)
  },
  keypad: {
    marginTop: 'auto',
    paddingTop: pixelByHeight(8),
    gap: pixelByHeight(25)
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  keypadRowCentered: {
    justifyContent: 'space-between'
  },
  key: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderRadius: getSizeImgSquare('large'),
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.BG_INPUT_FIELD
  },
  keySpacer: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    backgroundColor: 'transparent'
  },
  keyText: {
    color: Colors.TEXT_MEDIUM,
    fontSize: fontSize(22),
    lineHeight: fontSize(22) * 1.5,
    fontFamily: getFontFamily(500)
  },
  keyIcon: {
    width: fontSize(22),
    height: fontSize(22)
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    paddingTop: pixelByHeight(8),
    paddingBottom: pixelByHeight(12)
  },
  errorParagraph: {
  },
  codeBox: {
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL,
    borderRadius: pixelByWidth(8),
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(10),
    marginTop: pixelByHeight(8)
  },
  codeBoxCentered: {
    alignItems: 'center'
  },
  codeText: {
    color: Colors.TEXT_MEDIUM,
    fontSize: fontSize('small'),
    lineHeight: pixelByHeight(20)
  }
})

export default styles
