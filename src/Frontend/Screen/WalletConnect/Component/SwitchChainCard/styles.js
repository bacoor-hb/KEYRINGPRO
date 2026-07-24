import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    // Inset wrapper carries the bottom divider between cards.
    wrapper: {
      marginHorizontal: pixelByWidth(16),
      paddingBottom: pixelByHeight(14)
    },
    card: {
      borderRadius: pixelByWidth(16),
      paddingHorizontal: pixelByWidth(12),
      paddingVertical: pixelByHeight(12),
      gap: pixelByHeight(8)
    },
    chainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    buttons: {
      flexDirection: 'row',
      gap: pixelByWidth(14),
      marginTop: pixelByHeight(6)
    }
  })
}

export default createStyles
