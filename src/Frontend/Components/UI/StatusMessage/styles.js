import { StyleSheet } from 'react-native'
import { getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: pixelByWidth(12)
    },
    iconContainer: {
      alignItems: 'center',
      justifyContent: 'center'
    },
    // Match the previous MyIcon variant='large' (40px square).
    iconLottie: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large')
    },
    content: {
      flex: 1,
      gap: pixelByHeight(4)
    }

  })
}

export default createStyles
