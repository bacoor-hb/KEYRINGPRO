import { StyleSheet } from 'react-native'
import { Colors, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  // flex:1 makes the page fill the fixed-height popup so the FlatList below can
  // own the remaining space and scroll — without it the list overflows the
  // modal and the bottom rows get clipped instead of scrolling.
  container: {
    flex: 1,
    paddingHorizontal: pixelByWidth(16)
  },
  // List takes the space left under the fixed header and scrolls within it.
  list: {
    flex: 1
  },
  // Matches the input-to-first-row spacing of the Exchange token picker: its
  // list sits 8 below the search (container gap) and rows pad 9 on top, while
  // TokenRow pads 12 — so 5 here puts the first row's content at the same spot.
  listContent: {
    flexGrow: 1,
    paddingTop: pixelByHeight(5),
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
