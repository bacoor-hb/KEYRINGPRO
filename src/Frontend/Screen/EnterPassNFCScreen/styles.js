import { StyleSheet } from 'react-native'
import { width, height, scale, DarkColors, homeIndicatorHeight, Colors, heightFooter } from 'common/styles'
export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: heightFooter,
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
    paddingHorizontal: width(2),
    marginHorizontal: width(2),
    height: width(15),
    width: width(15),
    justifyContent: 'center',
    alignItems: 'center'
  },
  codeTxt: {
    fontSize: width(10),

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
  }
})
