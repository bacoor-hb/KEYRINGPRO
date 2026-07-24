import { Colors, DarkColors, Font, fontSize, getSizeImgSquare, height, pixelByHeight, pixelByWidth, scale, width } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = (isDarkMode) => {
  return StyleSheet.create({
    container: {
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      paddingBottom: height(4)
    },
    handle: {
      width: width(15),
      backgroundColor: isDarkMode ? '#49535E' : '#BDBDBD',
      height: scale(3.5),
      borderRadius: scale(3.5),
      alignSelf: 'center',
      marginVertical: pixelByHeight(8)
    },
    scrollContent: {
      paddingHorizontal: pixelByWidth(20),
      paddingBottom: pixelByHeight(20)
      // maxHeight: height(42)
    },
    centerContent: {
      alignItems: 'center',
      gap: pixelByHeight(20)
    },
    containerLogo: {
      marginVertical: pixelByHeight(10),
      justifyContent: 'center',
      alignItems: 'center'
    },
    logo: {
      width: pixelByHeight(50),
      height: pixelByHeight(50)
    },
    title: {
      fontSize: fontSize(18),
      fontFamily: Font.BOLD
    },
    description: {
      fontFamily: Font.REGULAR,
      textAlign: 'center'
    },
    addressBox: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      padding: pixelByWidth(12),
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? DarkColors.BLUE2 : Colors.GRAY2,
      marginTop: pixelByHeight(12)
    },
    networkIcon: {
      // design: 20x20
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      borderRadius: fontSize('small'),
      marginRight: 4
    },
    addressText: {

      fontFamily: Font.MEDIUM
    },
    messageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: pixelByHeight(22)
    },
    messageLabel: {
      fontSize: fontSize('small'),
      fontFamily: Font.REGULAR
    },
    wcBadge: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    wcBadgeIcon: {
      // design: 20x20
      width: pixelByHeight(15.5),
      height: pixelByHeight(15.5)
    },
    wcBadgeText: {
      fontSize: fontSize('small'),
      fontFamily: Font.REGULAR
    },
    messageBox: {
      padding: width(2),
      borderRadius: 6,
      backgroundColor: isDarkMode ? DarkColors.BLUE2 : Colors.GRAY3
    },
    messageText: {
      fontSize: 12,
      lineHeight: 18
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: pixelByWidth(20),
      gap: 12,
      marginTop: pixelByHeight(10)
    },
    rejectButton: {
      flex: 1,
      width: width(42),
      height: 50,
      borderWidth: 1,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center'
    },
    rejectText: {
      fontSize: width(4)
    },
    signButton: {
      flex: 1,
      height: 50,
      width: width(42),
      borderRadius: 12
    }
  })
}

export default createStyles
