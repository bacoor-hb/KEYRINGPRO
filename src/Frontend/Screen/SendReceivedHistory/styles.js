import { StyleSheet } from 'react-native'
import { fontSize, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    },
    listContainer: {
      paddingBottom: pixelByHeight(40),
      gap: pixelByHeight(14)
    },
    listContent: {
      paddingBottom: getSafeAreaValues().bottom,
      flexGrow: 1
    },
    emptyWrap: {
      flex: 1,
      paddingHorizontal: pixelByWidth(16),
      paddingTop: pixelByHeight(48),
      alignItems: 'center'
    },
    emptyTitle: {
      fontSize: fontSize('small')
    },
    emptyIcon: {
      marginBottom: pixelByHeight(8)
    },
    emptySpacer: {
      paddingVertical: pixelByHeight(50)
    }
  })
}

export default createStyles
