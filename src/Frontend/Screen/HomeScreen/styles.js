import { StyleSheet } from 'react-native'
import { Colors, fontSize, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      // paddingTop lives on the header-anchor wrapper (see page.js) instead of
      // here so the drawer anchor measures the full top region (header clearance
      // + "Account box" title) and the restore drawer anchors right below it.
      gap: pixelByHeight(14),
      paddingBottom: getSafeAreaValues().bottom + pixelByHeight(60)
    },
    // Offline noInternet icon on the right of the "Account box" title. Centered
    // vertically against the title; Text_Low tint (matches TokenList). No margin
    // — MyIcon shares its style with an overflow:hidden wrapper, so a margin here
    // would clip the icon.
    headerOfflineIcon: {
      alignSelf: 'center',
      tintColor: Colors.TEXT_LOW
    },
    containerTitle: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingRight: pixelByWidth(12),
      minHeight: pixelByHeight(36)

    },
    containerBox: {
      position: 'relative',
      overflow: 'hidden'
    },
    containerItem: {
      display: 'flex',
      flexDirection: 'row',
      gap: pixelByWidth(12),
      alignItems: 'center'
    },
    containerOption: {
      display: 'flex',
      flexDirection: 'row',
      gap: pixelByWidth(12),
      flex: 1,
      borderBottomWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      paddingVertical: pixelByHeight(12),
      alignItems: 'center'
    },

    iconArrowRight: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      flexShrink: 0
    },
    iconArrowDown: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      flexShrink: 0
    },
    textOption: {
      flex: 1,
      flexShrink: 1,
      fontSize: fontSize(16.5),
      flexWrap: 'wrap',
      color: Colors.TEXT_MEDIUM
    },
    btnAdd: {
      width: sizeImageSquare(52),
      height: sizeImageSquare(52),
      borderRadius: sizeImageSquare(52),
      padding: 0
    }
  })
}

export default createStyles
