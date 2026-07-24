import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  // flex:1 makes the page fill the fixed-height popup so the FlatList below can
  // own the remaining space and scroll — without it the list overflows the
  // modal and the bottom rows get clipped instead of scrolling.
  container: {
    flex: 1,
    paddingHorizontal: pixelByWidth(16)
  },
  headerContainer: {
    paddingVertical: pixelByHeight(12)
  },
  // List takes the space left under the fixed header and scrolls within it.
  list: {
    flex: 1
  },
  listContent: {
    flexGrow: 1,
    paddingTop: getHeightHeaderDrawer(),
    paddingBottom: getSafeAreaValues().bottom
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: pixelByHeight(50)
  },
  emptyIcon: {
    marginBottom: pixelByHeight(8)
  },
  emptyTitle: {
    color: Colors.TEXT_MEDIUM
  },
  footerWrap: {
    paddingTop: pixelByHeight(14),
    alignItems: 'center'
  },
  footerHint: {
    color: Colors.TEXT_LOW,
    textAlign: 'center'
  }
})

export default styles
