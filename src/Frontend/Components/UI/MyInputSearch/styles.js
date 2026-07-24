import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, getFontFamily, fontSize } from 'common/styles'

const createStyles = (isDarkMode, size) => {
  return StyleSheet.create({
    container: {
      gap: pixelByHeight(4),
      backgroundColor: Colors.BG_INPUT_FIELD,
      minHeight: pixelByHeight(46),
      borderRadius: pixelByHeight(24),
      paddingHorizontal: pixelByWidth(12)
    },
    contentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    inputWrapper: {
      position: 'relative',
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center'
      // borderBottomWidth: !isOutline ? 1.5 : 0,
      // borderBottomColor: isDarkMode ? Colors.BG_BOX_SMALL : 'rgba(0,0,0,0.1)',
      // paddingVertical: isOutline ? 0 : (isSmall ? pixelByHeight(8) : pixelByHeight(11))
    },
    textInput: {
      flex: 1,
      fontFamily: getFontFamily(),
      fontSize: fontSize('default'),
      color: isDarkMode ? Colors.WHITE : Colors.BLACK,
      padding: 0
    },
    rightElement: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    errorText: {
      fontSize: 12,
      color: Colors.RED_TEXT
      // paddingHorizontal: isOutline ? pixelByWidth(4) : 0
    }
  })
}

export default createStyles
