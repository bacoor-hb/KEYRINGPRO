import { StyleSheet } from 'react-native'
import { Colors, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },
    contentContainer: {
      paddingBottom: getSafeAreaValues().bottom
    },
    containerIcon: {
      width: getSizeImgSquare('large'),
      justifyContent: 'center',
      alignItems: 'center'
    },
    containerItem: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    containerContentItem: {
      gap: pixelByHeight(8),
      borderBottomWidth: 1,
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: pixelByHeight(12),
      borderBottomColor: Colors.BG_BOX_SMALL
    }

  })
}

export default createStyles
