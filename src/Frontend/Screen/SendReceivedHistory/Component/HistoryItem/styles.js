import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, Colors, DarkColors, sizeImageSquare, getSizeImgSquare } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      paddingTop: pixelByHeight(14),
      paddingBottom: pixelByHeight(14),
      gap: pixelByHeight(8)
      // marginBottom: pixelByHeight(14)
    },
    itemRow: {
      gap: pixelByHeight(4)
    },
    accountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    avatar: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      borderRadius: getSizeImgSquare('small'),
      backgroundColor: isDarkMode ? DarkColors.GREEN : Colors.GREEN
    },
    valueList: {
      gap: pixelByHeight(14)
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8),
      position: 'relative'
    },
    containerIconChain: {
      position: 'absolute',
      bottom: sizeImageSquare(-3),
      right: sizeImageSquare(-3)
    }
  })
}

export default createStyles
