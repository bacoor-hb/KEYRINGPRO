import { StyleSheet } from 'react-native'
import { width, Font, Colors, topNavBar, height, heightHeader, scale, pixelByWidth, getSafeAreaValues, getHeightHeader, pixelByHeight } from 'common/styles'

const styles = StyleSheet.create({
  // main header
  headerContainer: {
    width: width(100),
    // paddingTop: topNavBar,
    marginTop: getSafeAreaValues().top,
    height: getHeightHeader(),
    justifyContent: 'space-between',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pixelByWidth(16)
  },
  headerContainerScroll: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 3
  },
  headerContainerBlur: {
    height: getSafeAreaValues().top + getHeightHeader() + pixelByHeight(40),
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10
  },
  headerContainerLightmode: {
    // backgroundColor: Colors.WHITE3,
    // borderColor: Colors.GRAY2,
    // borderBottomWidth: 1
  },
  headerContainerDarkmode: {
    // backgroundColor: DarkColors.BACKGROUND,
    // borderColor: DarkColors.BLUE2,
    // borderBottomWidth: 1
  },
  leftView: {
    // alignSelf: 'flex-start',
    // paddingRight: width(3)
  },
  leftViewContainer: {
    // width: width(15)
  },
  middleSmall: {
    width: width(45)
  },
  middleView: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flex: 1
  },
  txtAppName: {},
  txtTitle: {
    textAlign: 'center',
    fontSize: width(5.5)
  },
  rightViewContainer: {
    width: 'auto',
    alignItems: 'flex-end'
  },
  rightView: {
    width: width(15)
  },

  rightHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end'
  },
  imgHeaderLine: {
    position: 'absolute',
    bottom: 0,
    width: width(100),
    height: width(1.5),
    resizeMode: 'cover'
  },
  imgHeaderLogo: {
    height: height(5),
    width: height(5),
    resizeMode: 'cover',
    marginRight: width(2),
    borderWidth: 0.1,
    borderColor: 'transparent',
    borderRadius: width(100)
  },
  imgHeaderQr: {
    height: width(10),
    width: width(10),
    resizeMode: 'contain',
    marginLeft: width(3)
  },
  iconBack: {
    height: width(3.5),
    width: width(3.5),
    resizeMode: 'contain'
  },
  imgHeaderNotiBox: {
    shadowColor: 'black',
    shadowOffset: {
      width: 0.5,
      height: 1
    },
    shadowOpacity: ISIOS ? 0.5 : 1,
    shadowRadius: 2,
    elevation: ISIOS ? 5 : 15
  },
  imgHeaderNoti: {
    height: width(8),
    width: width(8),
    resizeMode: 'contain'
  },
  imgHeadeLip: {
    marginRight: width(1),
    height: width(5.5),
    width: width(5.5),
    resizeMode: 'contain'
  },
  txtBalance: {
    color: Colors.RED_HEADER,
    fontFamily: Font.BOLD,
    maxWidth: width(25),
    fontSize: width(5),
    marginLeft: width(1)
  },
  userInfoBox: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    width: width(40)
  },
  username: {
    maxWidth: width(25),
    fontFamily: Font.BOLD,
    fontSize: width(4.5)
  },
  balanceBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderColor: Colors.RED_HEADER,
    borderWidth: 2,
    paddingHorizontal: width(2.5),
    paddingVertical: scale(4),
    borderRadius: width(20)
  },
  backButtonBox: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.GRAY3,
    borderRadius: width(3),
    paddingHorizontal: width(3),
    paddingVertical: width(3)
  },
  errorAPIIcon: {
    position: 'absolute',
    right: width(-5),
    top: 0,
    height: '100%',
    fontSize: width(4.5),
    color: Colors.YELLOW
  },
  iconFooter: {
    height: 24,
    width: 24,
    resizeMode: 'contain',
    marginBottom: ISIOS ? 4 : 2
  },
  boxLogo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconLogo: {
    height: (heightHeader - topNavBar) / 2,
    width: (heightHeader - topNavBar) / 2,
    marginRight: width(1),
    resizeMode: 'contain'
  },
  iconHeader: {
    height: 24,
    width: 24,
    resizeMode: 'contain'
  },
  textAboutKeyring: {
    fontSize: width(3)
  },
  textReadMore: {
    color: Colors.BLUE5,
    textAlign: 'right'
  },
  buttonReadMore: {
    alignSelf: 'flex-end'
  },
  icBack: {
    marginLeft: width(-2)

  }
})
export default styles
