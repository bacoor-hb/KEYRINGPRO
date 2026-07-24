import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, fontSize, Colors, sizeImageSquare, getSizeImgSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      // paddingHorizontal: pixelByWidth(16),
      flex: 1,
      gap: pixelByHeight(12)
    },
    containerContent: {
      gap: pixelByHeight(14)
    },
    addressContainer: {
      paddingTop: pixelByHeight(16),
      paddingBottom: pixelByHeight(12),
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    addressText: {
      flex: 1,
      fontSize: fontSize(24),
      lineHeight: fontSize(32)
    },
    qrButton: {
      backgroundColor: Colors.BG_INPUT_FIELD,
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      marginLeft: pixelByWidth(12),
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL
    },
    sectionTitle: {
      color: 'white'
    },
    linkList: {
      gap: pixelByHeight(12)
    },
    linkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: pixelByHeight(16),
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.1)'
    },
    linkIcon: {
      width: pixelByWidth(24),
      height: pixelByWidth(24),
      marginRight: pixelByWidth(16)
    },
    linkTitle: {
      flex: 1,
      color: '#767F8C',
      fontSize: fontSize(16)
    },
    externalIcon: {
      width: pixelByWidth(16),
      height: pixelByWidth(16),
      opacity: 0.6
    },
    iconArrowRight: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      flexShrink: 0
    },
    iconNFC: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      flexShrink: 0
    },
    iconCold: {
      width: sizeImageSquare(90),
      height: sizeImageSquare(60)
    },
    containerLeftIcon: {
      width: getSizeImgSquare('large'),
      alignItems: 'center',
      justifyContent: 'center'
    }
  })
}

export default createStyles
