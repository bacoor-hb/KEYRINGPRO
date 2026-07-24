import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    // Inset bordered card, matching the request card.
    card: {
      // The ScrollView body doesn't stretch its children, so without this the
      // card shrinks to fit the long hash and the hash row never truncates.
      alignSelf: 'stretch',
      marginHorizontal: pixelByWidth(16),
      borderRadius: pixelByWidth(16),
      paddingHorizontal: pixelByWidth(12),
      paddingVertical: pixelByHeight(12),
      gap: pixelByHeight(8)
    },
    section: {
      gap: pixelByHeight(4)
    }
  })
}

export default createStyles
