import { Colors, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingBottom: getSafeAreaValues().bottom,
      gap: pixelByHeight(8)
    },
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
    },
    containerPayProcess: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      justifyContent: 'center',
      borderRadius: getSizeImgSquare('large'),
      backgroundColor: Colors.BRAND,
      marginVertical: pixelByHeight(14)
    },
    containerCopy: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderRadius: getSizeImgSquare('large')
    }
  })
}

export default createStyles
