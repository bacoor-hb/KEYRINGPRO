import { StyleSheet } from 'react-native'
import { Colors, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      paddingBottom: getSafeAreaValues().bottom,
      flex: 1
    },
    containerPassword: {
      gap: pixelByHeight(4)
    },
    containerItem: {
      width: pixelByWidth(48),
      height: pixelByHeight(64),
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center'
    },
    itemPasswordEmpty: {
      marginTop: pixelByHeight(8),
      width: pixelByWidth(13),
      height: 1.5,
      backgroundColor: Colors.WHITE
    },
    itemPasswordValue: {
      borderRadius: 999,
      width: pixelByWidth(13),
      height: pixelByWidth(13),
      backgroundColor: Colors.WHITE
    }

  })
}

export default createStyles
