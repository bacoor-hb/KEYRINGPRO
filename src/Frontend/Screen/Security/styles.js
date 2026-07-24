import { StyleSheet } from 'react-native'
import { getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      paddingBottom: pixelByHeight(24),
      flex: 1
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    },

    containerItem: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: pixelByWidth(12),
      position: 'relative',
      minHeight: pixelByHeight(52)
    },
    containerLeftItem: {
      justifyContent: 'center',
      alignItems: 'center',
      width: getSizeImgSquare('large')
    }

  })
}

export default createStyles
