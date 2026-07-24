import { StyleSheet } from 'react-native'
import { getHeightHeader, getSafeAreaValues, pixelByWidth, width } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      width: '100%',
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 1
    },
    containerContent: {
      width: width(100),
      paddingTop: getSafeAreaValues().top,
      height: getHeightHeader() + getSafeAreaValues().top,
      justifyContent: 'space-between',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: pixelByWidth(16)
    },
    btnBack: {
      paddingHorizontal: 0
    }
  })
}

export default createStyles
