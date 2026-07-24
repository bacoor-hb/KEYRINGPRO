import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, sizeImageSquare, Colors, fontSize, getSafeAreaValues, getFontFamily, getSizeImgSquare, getHeightHeaderDrawer } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: pixelByHeight(8)
    },
    containerContent: {
      // flex: 1,
      gap: pixelByHeight(8),
      paddingTop: getHeightHeaderDrawer() + pixelByHeight(8),
      paddingBottom: getSafeAreaValues().bottom
    },
    containerItem: {
      borderWidth: 1,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderColor: Colors.BG_BOX_SMALL,
      borderRadius: 16,
      // flexDirection: 'row',
      // alignItems: 'center',
      gap: pixelByWidth(14),
      paddingVertical: pixelByHeight(12),
      paddingHorizontal: pixelByWidth(12)
    },
    logonReloadEnterForm: {
      width: sizeImageSquare(100),
      height: sizeImageSquare(26)
    },
    containerIconDown: {
      ...StyleSheet.absoluteFillObject,
      position: 'absolute',
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      top: '50%',
      left: '50%',
      transform: [
        { translateX: -getSizeImgSquare('large') / 2 },
        { translateY: -getSizeImgSquare('large') / 2 }
      ],

      zIndex: 1,
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderRadius: 100,
      justifyContent: 'center',
      alignItems: 'center'
    },
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
    },
    // Text appearance ONLY — AutoFitAmountInput owns every layout-affecting
    // prop (width/height/padding/fontSize). Adding a height here re-clips the
    // large-font glyphs.
    input: {
      color: Colors.WHITE,
      fontFamily: getFontFamily(700)
    },
    inputToUSD: {
      fontSize: fontSize(),
      color: Colors.TEXT_MEDIUM,
      // flex: 1,
      fontFamily: getFontFamily(),
      paddingVertical: 0,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: 'center',
      includeFontPadding: false
    },
    currencyTextPrefix: {
      fontSize: fontSize(),
      fontFamily: getFontFamily()
      // marginRight: pixelByWidth(4)
    },
    currencyTextSuffix: {
      fontSize: fontSize(),
      fontFamily: getFontFamily()
      // marginLeft: pixelByWidth(4)
    },
    containerConfirm: {
      gap: pixelByHeight(14),
      paddingBottom: getSafeAreaValues().bottom,
      paddingTop: getHeightHeaderDrawer() + pixelByHeight(8)
    },
    containerInfoConfirm: {
      backgroundColor: Colors.BG_BOX_SECONDARY,
      borderRadius: 18,
      paddingVertical: pixelByWidth(12),
      paddingHorizontal: pixelByHeight(12),
      gap: pixelByHeight(8)
    },
    containerRowItem: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      paddingVertical: pixelByWidth(12),
      paddingHorizontal: pixelByHeight(11),
      borderRadius: 16,
      backgroundColor: Colors.BG_INPUT_FIELD
    },
    containerRowItem2: {
      display: 'flex',
      flexDirection: 'row',
      gap: pixelByWidth(12),
      paddingHorizontal: pixelByHeight(11)
    },
    containerItemStep: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      width: '100%'
    },
    containerLineStep: {
      width: getSizeImgSquare('large'),
      display: 'flex',
      height: '100%',
      alignContent: 'center',
      alignItems: 'center',
      position: 'relative'
    },
    lineStep: {
      width: pixelByWidth(3),
      backgroundColor: Colors.BG_BOX_SMALL,
      flex: 1
    },
    containerCopy: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderRadius: getSizeImgSquare('large')
    }

  })
}

export default createStyles
