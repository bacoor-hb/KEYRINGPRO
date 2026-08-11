import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, width, fontSize, getSafeAreaValues, getFontFamily } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width(100),
    paddingBottom: getSafeAreaValues().bottom
  },
  pinSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: pixelByHeight(14)
  },
  pinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: pixelByWidth(24)
  },
  errorText: {
    textAlign: 'center'
  },
  errorTextHidden: {
    opacity: 0
  },
  pinBox: {
    width: pixelByWidth(48),
    height: pixelByHeight(64),
    borderRadius: pixelByWidth(16),
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: pixelByHeight(64 / 3)
  },
  // Applied on top of pinRow / pinBox for codes longer than 4 digits, so a
  // 6-digit row still fits the narrowest supported screen (6 x 44 + 5 x 10 = 314).
  pinRowCompact: {
    gap: pixelByWidth(10)
  },
  pinBoxCompact: {
    width: pixelByWidth(44),
    height: pixelByHeight(58),
    paddingBottom: pixelByHeight(58 / 3)
  },
  pinDash: {
    width: pixelByWidth(13),
    height: pixelByWidth(2),
    borderRadius: pixelByWidth(1),
    backgroundColor: Colors.WHITE
  },
  pinDot: {
    width: pixelByWidth(12),
    height: pixelByWidth(12),
    borderRadius: pixelByWidth(6),
    backgroundColor: Colors.WHITE
  },
  keypad: {
    marginTop: 'auto',
    gap: pixelByWidth(6)
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: pixelByWidth(6)
  },
  key: {
    flex: 1,
    height: pixelByHeight(50),
    borderRadius: pixelByWidth(16),
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL,
    backgroundColor: Colors.BG_INPUT_FIELD,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keyBack: {
    flex: 1,
    height: pixelByHeight(50),
    alignItems: 'center',
    justifyContent: 'center'
  },
  keySpacer: {
    flex: 1,
    height: pixelByHeight(50),
    backgroundColor: 'transparent'
  },
  keyText: {
    color: Colors.TEXT_MEDIUM,
    fontSize: fontSize(22),
    lineHeight: fontSize(22) * 1.5,
    fontFamily: getFontFamily(500)
  },
  keyIcon: {
    width: fontSize(24),
    height: fontSize(24)
  }
})

export default styles
