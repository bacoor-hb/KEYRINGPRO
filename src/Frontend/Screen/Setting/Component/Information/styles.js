import { StyleSheet } from 'react-native'
import { getSafeAreaValues, pixelByHeight } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },
    contentContainer: {
      gap: pixelByHeight(8),
      paddingBottom: getSafeAreaValues().bottom
    }

  })
}

export default createStyles
