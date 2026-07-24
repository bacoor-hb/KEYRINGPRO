import { StyleSheet } from 'react-native'
import { width, height, Colors, DarkColors, scale } from 'common/styles'
export default StyleSheet.create({
  container: {
    width: width(90),
    paddingHorizontal: width(3),
    height: 'auto',
    paddingTop: width(1.5),
    paddingBottom: width(3),
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2,
    backgroundColor: '#1D1E24',
    borderColor: Colors.BG_BOX_SMALL,
    shadowColor: Colors.BG_BOX_SMALL
  },
  navigationBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  iconCheckedIcon: {
    zIndex: 999,
    overflow: 'visible',
    width: width(25),
    height: width(25),
    marginBottom: width(2)
  },
  iconUnCheckedIcon: {
    color: Colors.GRAY2,
    zIndex: 999,
    fontSize: width(30),
    overflow: 'visible'
  },
  titleResetLightmode: {

    fontSize: width(5.5),
    color: '#333333',
    textAlign: 'center',
    marginBottom: height(2),
    marginTop: height(1)
  },
  titleResetDarkmode: {

    fontSize: width(5.5),
    color: DarkColors.WHITE,
    textAlign: 'center',
    marginBottom: height(2),
    marginTop: height(1)
  },
  txtHelp: {
    fontSize: width(4),
    color: '#828282',
    textAlign: 'center'
  },
  rowSuccessInfo: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeIcon: {
    color: '#BDBDBD',
    fontSize: width(7)
  },
  imgPantoLottie: {
    position: 'absolute',
    alignSelf: 'center',
    height: height(20),
    width: width(50)
  },
  buttonClose: {
    marginTop: height(1),
    width: '100%'
  },
  bottomBox: {
    justifyContent: 'center',
    alignItems: 'center',
    height: height(5)
  },
  coinBoxDarkmode: {
    borderRadius: width(2),
    paddingVertical: height(2),
    paddingHorizontal: width(4),
    minHeight: height(12),
    flexDirection: 'column',
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: Colors.BG_BOX_SMALL,
    borderWidth: 1,
    justifyContent: 'center',
    borderStyle: 'solid',
    marginVertical: height(1)
  },
  coinBoxLightmode: {
    borderRadius: width(2),
    paddingVertical: height(2),
    paddingHorizontal: width(4),
    minHeight: height(12),
    flexDirection: 'column',
    backgroundColor: Colors.WHITE,
    borderColor: Colors.GRAY2,
    borderWidth: 1,
    borderStyle: 'solid',
    marginVertical: height(1)
  },
  centerBox: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  leftBox: {
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: 'yellow'
    marginRight: width(2)
    // width: '11%'
  },
  middleBox: {
    justifyContent: 'space-around',
    // backgroundColor: 'red',
    width: '90%'
  },
  rightBox: {
    justifyContent: 'space-around',
    width: '10%'
  },
  tokenIcon: {
    width: 31,
    height: 31
    // width: height(3.5),
    // height: height(3.5)
  },
  topViewRightBox: {
    alignItems: 'flex-end'
  },
  bottomViewRightBox: {
    alignItems: 'flex-end'
  },
  rightIcon: {
    width: height(2.5),
    height: height(2.5)
  },
  nameCoinDarkmode: {
    color: DarkColors.TEXT2,
    fontSize: width(4)
  },
  nameCoinLightmode: {
    color: Colors.TEXT,
    fontSize: width(4)
  },
  privateKeyTxtLightmode: {
    color: Colors.GRAY1,
    fontSize: width(4)
  },
  privateKeyTxtDarkmode: {
    color: DarkColors.TEXT2,
    fontSize: width(4)
  },
  addressCoinLightmode: {
    color: Colors.TEXT,
    marginVertical: height(1),
    fontSize: width(3.7)
  },
  addressCoinDarkmode: {
    color: DarkColors.BLUE,
    marginVertical: height(1),
    fontSize: width(3.7)
  },
  privateCoin: {
    color: DarkColors.WHITE,
    marginVertical: height(1),
    fontSize: width(4)
  },
  checkedStyle: {
    top: height(0.5),
    left: height(0.5),
    position: 'absolute',
    color: DarkColors.BLUE1,
    fontSize: width(5)
  },
  uncheckedStyle: {
    position: 'absolute'
  },
  lineLightmode: {
    width: '100%',
    height: scale(1),
    marginVertical: height(2),
    backgroundColor: Colors.GRAY2
  },
  lineDarkmode: {
    width: '100%',
    height: scale(1),
    marginVertical: height(2.5),
    backgroundColor: DarkColors.BLUE2
  }

})
