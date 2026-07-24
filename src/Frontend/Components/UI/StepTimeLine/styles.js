import { Colors, getSizeImgSquare, pixelByWidth } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    containerLine: {
      width: getSizeImgSquare('large'),
      display: 'flex',
      height: '100%',
      alignContent: 'center',
      alignItems: 'center'

    },
    line: {
      width: pixelByWidth(3),
      backgroundColor: Colors.BG_BOX_SMALL,
      flex: 1
    },
    containerTxh: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    }
  })
}

export default createStyles
