import { Colors, pixelByHeight, pixelByWidth, width } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    dropdownStyle: {
      marginTop: 8,
      backgroundColor: '#1D1E24',
      borderRadius: pixelByWidth(16),
      borderWidth: 1,
      gap: pixelByHeight(12),
      paddingHorizontal: pixelByWidth(16),
      // paddingVertical: pixelByHeight(12),
      minWidth: width(50),
      borderColor: Colors.BG_BOX_SMALL
    }
  })
}

export default createStyles
