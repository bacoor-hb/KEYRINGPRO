import { StyleSheet } from 'react-native'
import { width, height, Colors, DarkColors } from 'common/styles'
export default StyleSheet.create({
  container: {
    width: width(90),
    paddingHorizontal: width(5),
    height: 'auto',
    paddingTop: height(2),
    paddingBottom: height(3),
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
    marginTop: height(2),
    width: width(80)
  },
  bottomBox: {
    justifyContent: 'center',
    alignItems: 'center',
    height: height(5)
  }
})
