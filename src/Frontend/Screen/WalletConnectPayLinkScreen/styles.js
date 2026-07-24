import { height, width } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      height: height(100),
      width: width(100)
    },
    containerLabel: {
      display: 'flex'
    },

    iconArrowRight: {
      flexShrink: 0
    }
  })
}

export default createStyles
