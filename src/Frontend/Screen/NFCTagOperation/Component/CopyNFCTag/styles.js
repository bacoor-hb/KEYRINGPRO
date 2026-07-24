import { StyleSheet } from 'react-native'
import { getSafeAreaValues, pixelByHeight } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      paddingBottom: getSafeAreaValues().bottom,
      gap: pixelByHeight(8),
      flex: 1
    }

  })
}

export default createStyles
