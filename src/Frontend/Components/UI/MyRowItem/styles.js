import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      gap: pixelByWidth(8),
      position: 'relative'
    },
    disabled: {
      opacity: 0.5
    },
    wrapperContainer: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: pixelByWidth(12),
      position: 'relative'
    },
    containerContent: {
      gap: pixelByHeight(8),
      borderBottomWidth: 1,
      flex: 1,
      paddingVertical: pixelByHeight(12),
      minHeight: pixelByHeight(52),
      borderBottomColor: Colors.BG_BOX_SMALL,
      position: 'relative',
      justifyContent: 'center'
    },
    containerBottomContent: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: pixelByWidth(12),
      position: 'relative'
    }
  })
}

export default createStyles
