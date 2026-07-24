import { StyleSheet } from 'react-native'
import { getSafeAreaValues, getSizeImgSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },
    contentContainer: {
      paddingBottom: getSafeAreaValues().bottom
    },
    containerIcon: {
      width: getSizeImgSquare('large'),
      justifyContent: 'center',
      alignItems: 'center'
    }

  })
}

export default createStyles
