import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, sizeImageSquare, Colors, fontSize, getSafeAreaValues, getFontFamily, getSizeImgSquare, getHeightHeaderDrawer } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    btnOption: {
      borderColor: Colors.BG_BOX_SMALL,
      borderRadius: 100,
      borderWidth: 1,
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1D1E24'
    },
    btnOptionSelected: {
      backgroundColor: '#2B2B31'
    }

  })
}

export default createStyles
