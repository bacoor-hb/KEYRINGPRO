import { pixelByHeight } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: pixelByHeight(8),
      paddingHorizontal: 0
    }
  })
}

export default createStyles
