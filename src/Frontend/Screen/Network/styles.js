import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1
    // paddingBottom: getSafeAreaValues().bottom
  },
  titlePage: {
    paddingVertical: pixelByHeight(12)
  },
  sectionTitle: {
    // marginVertical: pixelByHeight(12),
    // marginTop: pixelByHeight(16),
    marginBottom: pixelByHeight(12)

    // paddingLeft: pixelByWidth(8)
    // marginVertical: pixelByHeight(12)
  },
  listContainer: {
    paddingRight: pixelByWidth(16)
  },
  activeRow: {
    opacity: 1
  },
  inactiveRow: {
    opacity: 0.5
  }
})

export default styles
