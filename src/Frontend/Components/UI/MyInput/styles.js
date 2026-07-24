import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, getFontFamily, fontSize } from 'common/styles'

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
    contentContainerPrimary: {
      borderRadius: pixelByHeight(24),
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      paddingVertical: (isSmall ? pixelByHeight(8) : pixelByHeight(11)),
      paddingHorizontal: pixelByWidth(12),
      gap: pixelByWidth(6),
      height: isSmall ? pixelByHeight(40) : pixelByHeight(44)

    },
    inputWrapper: {
      position: 'relative',
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center'
    },
    inputWrapperDefault: {
      minHeight: pixelByHeight(46),
      borderBottomWidth: 1.5,
      borderBottomColor: Colors.BG_BOX_SMALL,
      paddingVertical: (isSmall ? pixelByHeight(8) : pixelByHeight(11))
    },
    inputWrapperPrimary: {

    },
    textInput: {
      flex: 1,
      fontFamily: getFontFamily(),
      fontSize: isSmall ? fontSize('small') : fontSize('default'),
      color: isDarkMode ? Colors.WHITE : Colors.BLACK,
      padding: 0,
      height: isOutline ? undefined : '100%'

    },
    rightElement: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    // Spacing for a left icon rendered inside the bordered wrapper (leftIconInside).
    leftIconInside: {
      marginRight: pixelByWidth(12),
      justifyContent: 'center'
    },
    errorText: {
      // fontSize: fontSize(15),
      color: Colors.RED_TEXT,
      paddingHorizontal: isOutline ? pixelByWidth(4) : 0
    },
    hintText: {
      // fontSize: fontSize(15),
      color: Colors.TEXT_LOW,
      paddingHorizontal: isOutline ? pixelByWidth(4) : 0
    }
  })
}

export default createStyles
