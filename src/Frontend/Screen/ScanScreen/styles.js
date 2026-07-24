import { StyleSheet } from 'react-native'
import { width, height, Colors, DarkColors, heightFooter, isNotchAndroid, Font, getSafeAreaValues, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import { MODE_THEME } from 'common/constants/app'
export default StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center'
  },
  iconGroup: {
    width: '70%',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row'
  },
  iconBox: {
    marginHorizontal: width(1),
    marginTop: height(1)
  },
  tokenIcon: {
    width: 31,
    height: 31
  },
  flexBw: {
    marginLeft: width(5),
    textAlign: 'center',
    justifyContent: 'space-between'
  },
  textGrayLightmode: {
    fontSize: width(3.3),
    color: Colors.GRAY1,
    textAlign: 'center'
  },
  textGrayDarkmode: {
    fontSize: width(3.3),
    color: DarkColors.WHITE,
    textAlign: 'center'
  },
  rowQrCode: {
    marginTop: width(18),
    width: width(90),
    alignItems: 'center',
    alignSelf: 'center'
  },
  textTitle: {

    textAlign: 'center',
    fontSize: width(5)
  },
  heightSmall: {
    height: height(50)
  },
  cameraContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    width: width(100),
    flex: 1
  },
  btnPing: {
    marginTop: height(5),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: height(70) - width(17),
    left: width(33),
    zIndex: 2,
    padding: width(2),
    backgroundColor: Colors.WHITE
  },
  boxSmartProof: {
    position: 'absolute',
    top: height(7),
    left: width(43)
  },
  imgSmartProof: {
    width: width(15),
    height: width(15),
    resizeMode: 'contain'
  },
  loadingPanto: {
    width: width(10),
    height: width(10)
  },
  boxSupported: {
    position: 'absolute',
    bottom: height(4),
    width: width(100),
    alignItems: 'center'
  },
  txtSupportTitle: {
    fontSize: width(4),
    color: Colors.WHITE,
    opacity: 0.5,
    marginBottom: width(1.5)
  },
  txtSupportNetwork: {
    fontSize: width(4.5),
    color: Colors.WHITE
  },
  pasteCodeBox: {
    bottom: heightFooter / 2,
    zIndex: 100,
    position: 'absolute',
    width: width(90),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center'
  },
  pasteCodeTxt: {
    textAlign: 'center',
    color: Colors.BLUE
  },
  labelInput: {

  },
  viewInputBox: {
  },
  inputBox: {
    justifyContent: 'flex-start',
    backgroundColor: Colors.WHITE,
    borderRadius: width(3),
    paddingVertical: height(0.5),
    height: isNotchAndroid ? height(13) : 'auto',
    maxHeight: height(50),
    borderWidth: 0,
    borderBottomColor: 'transparent'
  },
  inputText: {
    paddingBottom: width(1),
    // lineHeight: height(3),
    fontSize: width(4),
    paddingHorizontal: width(3),
    color: 'black',
    height: 'auto',
    maxHeight: height(30),
    minHeight: height(3)
  },
  pasteButton: {
    // marginRight: width(1),
    // paddingVertical: height(1),
    // paddingHorizontal: width(4),
    // height: isNotchAndroid ? height(13) : 'auto',
    // maxHeight: height(15),
    // borderRadius: width(2),
    // justifyContent: 'center'
  },
  pasteIcon: {
    width: width(5.5),
    height: width(5.5),
    alignSelf: 'center'
  },
  pasteTxt: {
    color: Colors.WHITE
  },
  boxButton: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: height(0)
  },
  requestBottomBox: {
    flex: 1,
    marginTop: height(1.5),
    width: width(92),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  rejectButton: {
    width: width(50 - 4 - 2)
  },
  rejectTxt: {
    color: Colors.YELLOW,
    fontFamily: Font.BOLD
  },
  confirmButton: {
    width: width(50 - 4 - 2)
  },
  confirmButtonLightmode: {
    backgroundColor: Colors.BLUE1,
    borderColor: Colors.BLUE1
  },
  confirmButtonDarkmode: {
    backgroundColor: DarkColors.BLUE,
    borderColor: Colors.YELLOW2
  },
  confirmTxtLightmode: {
    fontFamily: Font.BOLD,
    color: Colors.WHITE
  },
  confirmTxtDarkmode: {
    fontFamily: Font.BOLD,
    color: Colors.WHITE
  },
  signMessage: {
    flex: 1,
    width: '100%',
    paddingVertical: width(2),
    borderRadius: 6,
    marginTop: height(1.5)
  },
  signMessageLightmode: {
    backgroundColor: Colors.GRAY3,
    borderColor: Colors.GRAY3
  },
  signMessageDarkmode: {
    backgroundColor: DarkColors.BLUE2,
    borderColor: Colors.BG_BOX_SMALL
  },
  lineGrayLightmode: {
    marginTop: height(1.5),
    marginBottom: height(1.5),
    width: width(100),
    height: 1,
    backgroundColor: DarkColors.TEXT2
  },
  lineGrayDarkmode: {
    marginTop: height(2),
    marginBottom: height(2),
    width: width(100),
    height: 1,
    backgroundColor: DarkColors.TEXT2
  },
  listAuthAddressBox: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'flex-start',
    width: '100%',
    flexWrap: 'wrap',
    marginBottom: height(1),
    borderRadius: 6,
    borderWidth: 1,
    padding: width(2),
    paddingBottom: 0
  },
  listAuthAddressBoxLightmode: {
    borderColor: Colors.GRAY3
  },
  listAuthAddressBoxDarkmode: {
    borderColor: Colors.BG_BOX_SMALL
  },
  containerBtnCopy: {
    padding: pixelByHeight(10),
    borderRadius: width(2.5),

    justifyContent: 'center',
    borderWidth: 1
  },
  [`containerBtnCopy${MODE_THEME.DARK_MODE}`]: {
    backgroundColor: DarkColors.BLUE2,
    borderColor: DarkColors.GRAY1
  },
  [`containerBtnCopy${MODE_THEME.LIGHT_MODE}`]: {
    backgroundColor: Colors.WHITE,
    borderColor: DarkColors.GRAY
  },
  containerWCPay: {
    position: 'absolute',
    zIndex: 10,
    bottom: getSafeAreaValues().bottom,
    left: pixelByWidth(16)
  },
  btnWCPay: {
    borderRadius: 10,
    paddingVertical: pixelByHeight(8),
    paddingHorizontal: pixelByWidth(8),
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF80',
    backgroundColor: '#FFFFFF1A'
  },
  iconWCPay: {
    width: sizeImageSquare(70),
    height: sizeImageSquare(21)
  }
})
