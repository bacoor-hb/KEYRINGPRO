import { StyleSheet } from 'react-native'
import { pixelByWidth, fontSize, Colors } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      gap: pixelByWidth(25)
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: pixelByWidth(4)
    },
    key: {
      width: pixelByWidth(50),
      height: pixelByWidth(50),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD
    },
    empty: {
      width: pixelByWidth(22),
      height: pixelByWidth(22)
    },
    icon: {
      width: pixelByWidth(22),
      height: pixelByWidth(22)
    },
    text: {
      fontSize: fontSize(22)
    }
  })
}

export default createStyles
