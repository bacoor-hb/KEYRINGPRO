import { StyleSheet } from 'react-native'
import { width } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      width: width(100),
      paddingTop: width(20)
    }
  })
}

export default createStyles
