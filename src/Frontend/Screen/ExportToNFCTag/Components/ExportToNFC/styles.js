import { StyleSheet } from 'react-native'
import { getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: pixelByHeight(8)
    },
    containerRow: {
      display: 'flex',
      flexDirection: 'row',
      gap: pixelByWidth(12)
    },
    containerIconStep: {
      width: getSizeImgSquare('large'),
      alignItems: 'center'
    },
    iconStep: {
      width: getSizeImgSquare('medium'),
      height: getSizeImgSquare('medium'),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: getSizeImgSquare('medium') / 2,
      backgroundColor: '#383940'
    },
    textStep: {
      fontWeight: 'bold'
      // lineHeight: fontSize(17)
    },
    containerContentStep: {
      gap: pixelByHeight(4),
      flex: 1
    }

  })
}

export default createStyles
