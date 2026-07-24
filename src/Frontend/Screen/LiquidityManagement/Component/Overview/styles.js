import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    gap: pixelByHeight(8)
  },
  block: {
    gap: pixelByHeight(4)
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  arrow: {
    marginLeft: pixelByWidth(4)
  }
})

export default styles
