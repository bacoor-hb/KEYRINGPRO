import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingBottom: pixelByHeight(24)
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)

    },
    scrollView: {
      flex: 1
    },
    contentContainer: {
      gap: pixelByHeight(12),
      paddingBottom: pixelByHeight(24),
      flex: 1
    },

    containerItem: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    containerContentItem: {
      gap: pixelByHeight(8),
      borderBottomWidth: 1,
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: pixelByHeight(12),
      borderBottomColor: Colors.BG_BOX_SMALL
    }
  })
}

export default createStyles
