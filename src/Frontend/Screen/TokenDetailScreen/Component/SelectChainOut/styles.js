import { StyleSheet } from 'react-native'
import { pixelByHeight } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: pixelByHeight(8)
    }

  })
}

export default createStyles
