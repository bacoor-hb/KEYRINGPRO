import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      paddingHorizontal: pixelByWidth(16),
      flex: 1,
      gap: pixelByHeight(24)
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    }
  })
}

export default createStyles
