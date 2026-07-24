import { StyleSheet } from 'react-native'
import { pixelByHeight, width } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      width: width(100),
      gap: pixelByHeight(12)
      // paddingTop: width(20)
    },
    containerQR: {
      marginTop: pixelByHeight(8)
    }
  })
}

export default createStyles
