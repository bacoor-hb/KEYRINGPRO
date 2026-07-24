import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },
    containerContent: {
      // flex: 1,
      paddingTop: getHeightHeaderDrawer() + pixelByHeight(8),
      paddingBottom: getSafeAreaValues().bottom
    },
    containerNetworkCurrent: {
      minHeight: pixelByHeight(40),
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderRadius: pixelByHeight(24),
      paddingRight: pixelByWidth(12),
      paddingVertical: pixelByHeight(4),
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    rpcBox: {
      minHeight: pixelByHeight(180),
      borderRadius: pixelByHeight(16),
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      paddingHorizontal: pixelByWidth(12),
      paddingVertical: pixelByHeight(12)
    },
    rpcInputWrapper: {
      alignItems: 'flex-start'
    },
    rpcInput: {
      height: pixelByHeight(156),
      textAlignVertical: 'top'
    },
    footer: {
      marginTop: 'auto',
      alignItems: 'center'
    }
  })
}

export default createStyles
