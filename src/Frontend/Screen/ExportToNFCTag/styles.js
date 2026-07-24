import { StyleSheet } from 'react-native'
import { getSizeImgSquare, pixelByHeight } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      // paddingBottom: pixelByHeight(24),
      flex: 1
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    },
    containerLeftIcon: {
      width: getSizeImgSquare('large'),
      alignItems: 'center'

    }
  })
}

export default createStyles
