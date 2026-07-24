import { StyleSheet } from 'react-native'
import { getSafeAreaValues, pixelByHeight, pixelByWidth, width } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width(100)
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    // paddingTop: pixelByHeight(16),
    // paddingBottom: pixelByHeight(8),
    paddingTop: pixelByHeight(6),
    paddingBottom: pixelByHeight(6),
    paddingHorizontal: pixelByWidth(0)
  },
  scrollList: {
    flex: 1,
    paddingBottom: getSafeAreaValues().bottom
  },
  scrollContent: {
    paddingBottom: pixelByHeight(24),
    paddingHorizontal: pixelByWidth(0)
  },
  statusBox: {
    paddingVertical: pixelByHeight(24),
    alignItems: 'center'
  }
})

export default styles
