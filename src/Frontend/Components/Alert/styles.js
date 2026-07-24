import { StyleSheet } from 'react-native'
import { width, height, scale, heightScale, Colors, DarkColors, commonSize, pixelByHeight, pixelByWidth, getSizeImgSquare } from 'common/styles'

const styles = StyleSheet.create({
  messageStyleToast: {
    maxWidth: width(85),
    color: Colors.WHITE,
    textAlign: 'center'
  },
  toastCtn: {
    shadowColor: 'black',
    shadowOffset: {
      width: 1,
      height: 2
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 1000,
    top: height(50),
    position: 'absolute',
    paddingHorizontal: width(2),
    paddingVertical: width(2),
    borderRadius: 20,
    backgroundColor: Colors.BG_BOX_SMALL,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: pixelByHeight(44)
  },
  toastSuccessCtn: {
    shadowColor: 'black',
    shadowOffset: {
      width: 1,
      height: 2
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    zIndex: 1000,
    top: height(50),
    position: 'absolute',
    paddingVertical: width(2),
    borderRadius: commonSize._6px,
    backgroundColor: DarkColors.BLUE2,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: commonSize._20px
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0
  },
  inputCtn: {
    width: width(80),
    marginTop: height(3)
  },
  centerView: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  inputCode: {
    width: width(80),
    marginTop: height(3)
  },
  container: {
    flex: 1
  },
  bgRed: {
    backgroundColor: Colors.RED
  },
  btnGray: {
    backgroundColor: Colors.GRAY2
  },
  btnYellow: {
    backgroundColor: Colors.YELLOW
  },
  boxAlert: {
    padding: width(5),
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgb(69, 69, 69)',
    borderRadius: 20,
    position: 'absolute',
    top: 0
  },
  btnAlert: {
    height: heightScale(6),
    backgroundColor: Colors.GREEN,
    marginTop: heightScale(4),
    marginBottom: heightScale(4),
    width: width(80)
  },
  alertCtn: {
    paddingBottom: height(2),
    alignSelf: 'center',
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    opacity: 1
  },
  imgGif: {
    height: height(13),
    width: width(25),
    resizeMode: 'contain'
  },
  imgIconChecked: {
    height: width(25),
    width: width(25),
    resizeMode: 'contain'
  },
  imgCusGif: {
    height: height(5),
    width: height(5),
    resizeMode: 'contain'
  },
  // App alert
  viewContainer: {
    position: 'absolute',
    height: height(100),
    width: width(100),
    zIndex: 5
  },
  backDropContainerLightmode: {
    bottom: 0,
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.8)',
    height: height(100),
    width: width(100)
  },
  backDropContainerDarkmode: {
    bottom: 0,
    position: 'absolute',
    backgroundColor: Colors.BG_BACK_DROP_MODAL,
    height: height(100),
    width: width(100)
  },
  backDropContainerInSide: {
    bottom: 0,
    position: 'absolute',
    height: height(100),
    width: width(100)
  },
  alertContainer: {
    marginTop: height(30),
    width: width(100),
    marginHorizontal: width(5),
    paddingVertical: height(2)
  },
  txtTitle: {
    fontSize: width(6),
    color: 'black',

    lineHeight: scale(48)
  },
  txtAlertTitleLightmode: {

    marginTop: height(1.5),
    fontSize: width(5),
    color: Colors.TEXT,
    textAlign: 'center',
    alignSelf: 'center'
  },
  txtAlertTitleDarkmode: {

    marginTop: height(1.5),
    fontSize: width(5),
    color: DarkColors.WHITE,
    textAlign: 'center',
    alignSelf: 'center'
  },
  messageStyleLightmode: {
    marginTop: height(1.5),
    color: Colors.GRAY1,
    textAlign: 'center',
    fontSize: width(4)
  },
  messageStyleDarkmode: {
    marginTop: height(1.5),
    color: DarkColors.TEXT2,
    textAlign: 'center',
    fontSize: width(4)
  },
  outSideBox: {
    paddingTop: heightScale(5.5)
  },
  closeBtn: {
    zIndex: 100,
    alignItems: 'flex-end',
    position: 'absolute',
    top: height(1.5),
    right: width(4)
  },
  defaultAlertContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: height(3) + width(4),
    paddingVertical: height(3),
    paddingHorizontal: width(4),
    width: width(92),
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderStyle: 'solid',
    borderWidth: 1
  },
  defaultAlertContainerLightmode: {
    backgroundColor: Colors.WHITE,
    borderColor: Colors.GRAY3,
    shadowColor: Colors.GRAY3
  },
  defaultAlertContainerDarkmode: {
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: DarkColors.BLUE2,
    shadowColor: DarkColors.BLUE2
  },
  alertCusContainer: {
    bottom: 0,
    height: height(100),
    width: width(100),
    zIndex: 100,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute'
  },
  defaultAlertCtn: {
    justifyContent: 'center',
    flexWrap: 'nowrap',
    alignItems: 'center',
    backgroundColor: '#F2F5FC',
    paddingVertical: height(1),
    width: width(80),
    borderRadius: width(3),
    paddingHorizontal: width(5)
  },
  messageAlertStyle: {
    color: '#1D2B47',
    fontSize: width(4),
    textAlign: 'center',
    width: '85%'
  },
  // App Indicator
  indicatorContainer: {
    top: height(50),
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute'
  },
  defaultIndicatorCtn: {
    // flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    alignItems: 'center',
    backgroundColor: '#F2F5FC',
    paddingVertical: height(1),
    width: width(70),
    borderRadius: width(3),
    // borderRadius: width(30),
    paddingHorizontal: width(5)
  },
  messageIndicatorStyle: {
    // marginLeft: width(3),
    color: '#1D2B47',
    textAlign: 'center'
    // width: '85%'
  },
  iconIndicator: {
    height: width(3),
    width: width(3)
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'center',
    width: width(80)
  },
  btnSmall: {
    width: width(38)
  },
  // New card alert design
  newAlertCard: {
    width: width(100) - pixelByWidth(32)
  },
  newAlertCardContent: {
    width: '100%',
    paddingVertical: pixelByHeight(16),
    paddingHorizontal: pixelByWidth(16),
    alignItems: 'center',
    justifyContent: 'center',
    gap: pixelByHeight(8)
  },
  newAlertIcon: {
    width: getSizeImgSquare('medium'),
    height: getSizeImgSquare('medium'),
    // marginBottom: pixelByHeight(8),
    alignSelf: 'center'
  },
  newAlertTitle: {
    // marginBottom: pixelByHeight(8)
  }
})

export default styles
