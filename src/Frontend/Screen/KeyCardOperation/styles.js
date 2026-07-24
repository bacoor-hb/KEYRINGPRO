import { StyleSheet } from 'react-native'
import { width, height, scale, DarkColors, homeIndicatorHeight, Colors } from 'common/styles'
export default StyleSheet.create({
  container: {
    flex: 1,
    // padding: width(4),
    justifyContent: 'center',
    paddingHorizontal: width(5)
  },
  titleText: {
    fontSize: width(3.7),
    lineHeight: scale(19),
    color: '#333333',
    textAlign: 'center',
    marginTop: height(2),
    marginBottom: height(4)
  },
  enterPassTxt: {
    marginBottom: height(5),
    fontSize: width(4.5),
    alignSelf: 'center'
  },
  textInput: {
    marginBottom: height(6)
  },
  showPassContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: height(4)
  },
  showPassText: {
    fontSize: width(3.5),
    lineHeight: scale(19),
    color: '#333333',
    marginLeft: width(1)
  },
  showPassCheckbox: {
    marginRight: width(1)
  },
  TextContainer: {
    borderColor: '#F2F2F2',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 6,
    padding: width(5)
  },
  heighEmptyContainer: {
    height: height(30),
    width: width(100),
    alignSelf: 'center'
  },
  importantText: {
    fontSize: width(3.5),
    lineHeight: scale(19),
    color: '#FF4545CC',
    marginBottom: height(1)
  },
  descriptionText: {
    fontSize: width(3.5),
    lineHeight: scale(19),
    color: '#333333'
  },
  buttonBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: homeIndicatorHeight
  },
  textButtonColor: {
    color: '#333333'
  },
  buttonLeftLightmode: {
    width: width(42),
    backgroundColor: 'white',
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 6
  },
  buttonLeftDarkmode: {
    width: width(42),
    backgroundColor: DarkColors.BACKGROUND,
    borderColor: DarkColors.TEXT2,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 6
  },
  buttonRight: {
    width: width(42),
    borderRadius: 6
  },
  EnteredCodeBox: {
    paddingHorizontal: width(4),
    justifyContent: 'center',
    alignItems: 'center'
  },
  resendCodeTxt: {
    color: Colors.PURPLE2
  },
  enterNewCodeText: {
    fontSize: scale(14),
    color: Colors.TEXT
  },
  codeBox: {
    borderRadius: width(2),
    paddingHorizontal: width(2),
    marginHorizontal: width(2),
    height: width(15),
    width: width(15),
    justifyContent: 'center',
    alignItems: 'center',
    // paddingVertical: width(2),
    borderColor: Colors.GRAY3,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  codeTxt: {
    fontSize: width(7),

    color: Colors.GRAY1
  },
  circleNumberGroup: {
    height: height(6),
    marginBottom: height(3),
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  circleNumber: {
    width: width(4),
    height: width(4),
    borderColor: '#2D8DEDCC',
    borderStyle: 'solid',
    borderRadius: width(50),
    backgroundColor: '#2D8DEDCC'
  },
  circleNumberEmpty: {
    width: width(4),
    height: width(4),
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: width(50),
    backgroundColor: 'white'
  },
  InputCodeArea: {
    height: height(40),
    marginBottom: height(1),
    justifyContent: 'flex-end'
  },
  ThreeButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: height(1)
  },
  buttonBoxLightmode: {
    flexBasis: '32%',
    width: width(4),
    height: height(7.5),
    backgroundColor: Colors.GRAY3,
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: 6,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },
  buttonBoxDarkmode: {
    flexBasis: '32%',
    width: width(4),
    height: height(7.5),
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: 6,
    borderColor: Colors.BG_BOX_SMALL,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },
  buttonBoxZeroLightmode: {
    flexBasis: '66%',
    width: width(4),
    height: height(7.5),
    backgroundColor: Colors.GRAY3,
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: 6,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },
  buttonBoxZeroDarkmode: {
    flexBasis: '66%',
    width: width(4),
    height: height(7.5),
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: 6,
    borderColor: Colors.BG_BOX_SMALL,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center'
  },
  buttonText: {
    fontSize: scale(27),
    color: Colors.TEXT,
    textAlign: 'center'
  },
  introContainer: {
    flex: 1,
    paddingTop: height(1),
    paddingBottom: height(5),
    justifyContent: 'flex-start',
    paddingHorizontal: width(5)
  },
  coinBoxDarkmode: {
    borderRadius: width(2),
    paddingHorizontal: width(4),
    maxHeight: height(20),
    minHeight: height(13),
    flexDirection: 'row',
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: Colors.BG_BOX_SMALL,
    borderWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderStyle: 'solid',
    marginVertical: height(1.5)
  },
  coinBoxLightmode: {
    borderRadius: width(2),
    paddingHorizontal: width(4),
    maxHeight: height(20),
    minHeight: height(13),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.WHITE,
    borderColor: Colors.GRAY2,
    borderWidth: 1,
    borderStyle: 'solid',
    marginVertical: height(1)
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: width(15),
    height: height(5)
  },
  content: {
    height: height(12),
    justifyContent: 'center',
    width: width(65)
  },
  contentTitle: {
  },
  contentSubTitleLightmode: {
    marginTop: height(1),
    color: Colors.GRAY1
  },
  contentSubTitleDarkmode: {
    marginTop: height(1),
    color: DarkColors.TEXT2
  },
  iconImage: {
    height: '90%',
    width: '90%'
  },
  learnMoreBoxLightmode: {
    borderRadius: width(2),
    paddingVertical: height(2),
    paddingHorizontal: width(4),
    maxHeight: height(20),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.WHITE,
    borderColor: Colors.GRAY2,
    borderWidth: 1,
    borderStyle: 'solid',
    marginVertical: height(1)
  },
  learnMoreBoxDarkmode: {
    paddingVertical: height(2),
    borderRadius: width(2),
    paddingHorizontal: width(4),
    maxHeight: height(20),
    flexDirection: 'row',
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: Colors.BG_BOX_SMALL,
    borderWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderStyle: 'solid',
    marginVertical: height(1)
  },
  learnMoretxtLightmode: {
    color: DarkColors.BLUE
  },
  learnMoretxtDarkmode: {
    color: DarkColors.BLUE
  },
  bannerKeycard: {
    position: 'relative',
    height: height(60)
  },
  BannerBox: {
    position: 'relative',
    width: '90%',
    height: height(60),
    justifyContent: 'center',
    alignItems: 'center'
  },
  LottieView: {
    width: '100%',
    minHeight: height(50),
    position: 'relative'
  },
  bannerTitle: {
    textAlign: 'center'
  },
  PaginationDot: {
    backgroundColor: 'transparent',
    width: '100%',
    paddingBottom: height(4)
  },
  dotStyleLightmode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
    backgroundColor: 'black'
  },
  dotStyleDarkmode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)'
  },
  inactiveDotStyleLightmode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
    backgroundColor: Colors.GRAY1
  },
  inactiveDotStyleDarkmode: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
    backgroundColor: Colors.GRAY1
  }
})
