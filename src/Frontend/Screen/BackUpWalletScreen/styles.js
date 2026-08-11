import { StyleSheet } from 'react-native'
import { Colors, fontSize, getHeightHeader, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const headerStyles = StyleSheet.create({
  inforIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: pixelByWidth(36),
    height: pixelByWidth(36)
  },
  inforIcon: {
    width: pixelByWidth(18),
    height: pixelByWidth(18)
  }
})

const createStyles = () => {
  return StyleSheet.create({
    scrollView: {
      flex: 1
    },
    contentContainer: {
      flexGrow: 1,
      paddingBottom: getSafeAreaValues().bottom,
      paddingTop: getHeightHeader(true)
    },
    container: {
      flex: 1,
      paddingBottom: getSafeAreaValues().bottom,
      gap: pixelByHeight(14)
    },
    formSection: {
      // paddingTop: pixelByHeight(4),
      gap: pixelByHeight(8)
    },
    titlePage: {
      paddingVertical: pixelByHeight(12)
    },
    inputGroup: {
      gap: pixelByHeight(14)
      // marginBottom: pixelByHeight(14)
    },
    leftIcon: {
      width: pixelByWidth(22),
      height: pixelByWidth(22)
    },

    infoSection: {
      gap: pixelByHeight(14)
    },
    buttonRow: {
      flexDirection: 'row',
      gap: pixelByWidth(12),
      marginTop: pixelByHeight(28)
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      borderRadius: pixelByHeight(22),
      backgroundColor: 'transparent'
    },
    primaryButton: {
      flex: 1,
      borderRadius: pixelByHeight(22)
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center'
    },

    emptyTitle: {
      fontSize: fontSize('small')
    },
    emptySpacer: {
      paddingVertical: pixelByHeight(32)
    },
    emptyIcon: {
      marginBottom: pixelByHeight(8)
    },
    containerIconBackup: {
      width: getSizeImgSquare('medium'),
      height: getSizeImgSquare('medium'),
      borderRadius: getSizeImgSquare('medium') / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Colors.BRAND
    }
  })
}

createStyles.inforIconBox = headerStyles.inforIconBox
createStyles.inforIcon = headerStyles.inforIcon

export default createStyles
