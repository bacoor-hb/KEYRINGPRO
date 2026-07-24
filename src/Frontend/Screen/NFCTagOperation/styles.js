import { StyleSheet } from 'react-native'
import { getSafeAreaValues, getSizeImgSquare, pixelByHeight } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      paddingBottom: getSafeAreaValues().bottom,
      flex: 1
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    },
    containerLeftIcon: {
      width: getSizeImgSquare('large'),
      justifyContent: 'center',
      alignItems: 'center'
    }
  })
}

export default createStyles
