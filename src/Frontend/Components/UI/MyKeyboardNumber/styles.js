import { StyleSheet } from 'react-native'
import { pixelByWidth, fontSize, Colors, pixelByHeight, getFontFamily } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
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
}

export default createStyles
