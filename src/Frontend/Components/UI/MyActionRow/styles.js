import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth } from 'common/styles'

const buildStyles = () => {
  return StyleSheet.create({
    itemContainer: {
      gap: pixelByHeight(8)
    },
    itemContentContainer: {
      gap: pixelByWidth(12)
    },
    label: {
      gap: pixelByHeight(8),
      borderBottomWidth: 1,
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: pixelByHeight(12),
      minHeight: pixelByHeight(52),
      borderBottomColor: Colors.BG_BOX_SMALL
    }
  })
}

// Built once, then cached. These values are static (the app is dark-mode only),
// so rebuilding the sheet on every render only burned CPU and — worse — handed
// children a brand new style identity each time, defeating their memoization.
let cachedStyles = null

const createStyles = () => {
  if (!cachedStyles) {
    cachedStyles = buildStyles()
  }
  return cachedStyles
}

export default createStyles
