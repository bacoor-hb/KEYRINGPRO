import { StyleSheet } from 'react-native'
import { pixelByHeight } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      paddingBottom: pixelByHeight(24)
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    }

  })
}

export default createStyles
