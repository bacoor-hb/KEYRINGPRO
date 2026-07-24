import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
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

export default createStyles
