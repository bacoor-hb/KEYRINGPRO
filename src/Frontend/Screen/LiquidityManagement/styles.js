import { StyleSheet } from 'react-native'
import { pixelByHeight } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  description: {
    paddingTop: pixelByHeight(8),
    lineHeight: pixelByHeight(24)
  }
})

export default styles
