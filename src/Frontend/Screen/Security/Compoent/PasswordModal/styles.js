import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, width, getSizeImgSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      width: width(100),
      flex: 1
    },
    containerForm: {
      gap: pixelByHeight(14)
    },
    containerItem: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: pixelByWidth(12),
      position: 'relative'
    },
    containerLeftItem: {
      justifyContent: 'center',
      alignItems: 'center',
      width: getSizeImgSquare('large')
    },
    containerContentItem: {
      gap: pixelByHeight(8),
      borderBottomWidth: 1,
      flex: 1,
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: pixelByHeight(8),
      minHeight: pixelByHeight(46),
      borderBottomColor: Colors.BG_BOX_SMALL,
      position: 'relative'
    }
  })
}

export default createStyles
