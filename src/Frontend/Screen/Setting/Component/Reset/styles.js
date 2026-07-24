import { StyleSheet } from 'react-native'
import { pixelByHeight, width } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      width: width(100),
      gap: pixelByHeight(8),
      flex: 1
    },
    contentContainer: {
      paddingBottom: pixelByHeight(40)
    }

  })
}

export default createStyles
