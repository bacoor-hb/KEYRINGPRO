import { StyleSheet } from 'react-native'
import { getSafeAreaValues, PADDING_TOP_CONTAINER_DRAWER, pixelByHeight } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: pixelByHeight(8),
      paddingTop: PADDING_TOP_CONTAINER_DRAWER
    }

  })
}

export default createStyles
