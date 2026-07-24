import { StyleSheet } from 'react-native'
import { height, width } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  modalFormStyle: {
    height: '100%',
    width: width(100),
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modelKeyboard: {
    height: height(42)
  },
  flexEnd: {
    justifyContent: 'flex-end'
  }
})
export default styles
