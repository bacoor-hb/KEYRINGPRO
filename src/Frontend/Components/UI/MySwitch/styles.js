import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, getFontFamily } from 'common/styles'

const createStyles = (isDarkMode, variant, size) => {
  const isOutline = variant === 'outline'
  const isSmall = size === 'small'

  return StyleSheet.create({
    container: {
      width: '100%',
      gap: pixelByHeight(4)
    },
    contentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: !isOutline ? 1.5 : 0,
      borderBottomColor: isDarkMode ? Colors.BG_BOX_SMALL : 'rgba(0,0,0,0.1)',
      paddingVertical: isOutline ? 0 : (isSmall ? pixelByHeight(8) : pixelByHeight(11))
    },
    textInput: {
      flex: 1,
      fontFamily: getFontFamily(),
      fontSize: isSmall ? 14 : 16,
      color: isDarkMode ? Colors.WHITE : Colors.BLACK,
      padding: 0,
      height: isOutline ? undefined : '100%',
      minHeight: isOutline ? 0 : pixelByHeight(44)
    },
    rightElement: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    errorText: {
      fontSize: 12,
      color: Colors.RED_TEXT,
      paddingHorizontal: isOutline ? pixelByWidth(4) : 0
    }
  })
}

export default createStyles
