import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, DarkColors, getSizeImgSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      paddingTop: pixelByHeight(14),
      paddingBottom: pixelByHeight(14),
      gap: pixelByHeight(8)
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
      backgroundColor: DarkColors.GREEN
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8),
      position: 'relative'
    }
  })
}

export default createStyles
