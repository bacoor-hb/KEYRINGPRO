import { StyleSheet } from 'react-native'
import { width, height, Colors, DarkColors } from 'common/styles'
export default StyleSheet.create({
  container: {
    width: width(90),
    height: 'auto',
    paddingVertical: height(3),
    paddingLeft: width(5),
    paddingRight: width(5),
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderStyle: 'solid',
    borderWidth: 1
  },
  containerLightmode: {
    backgroundColor: Colors.WHITE,
    borderColor: Colors.GRAY3,
    shadowColor: Colors.GRAY3
  },
  containerDarkmode: {
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: DarkColors.BLUE2,
    shadowColor: DarkColors.BLUE2
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
    marginBottom: height(1.5)
  },
  iconUnCheckedIcon: {
    color: Colors.RED,
    zIndex: 999,
    fontSize: width(30),
    overflow: 'visible'
  },
  titleReset: {

    fontSize: width(5),
    textAlign: 'center',
    alignSelf: 'center',
    marginBottom: height(0.5)
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
    marginTop: height(1.5),
    textAlign: 'center',
    color: Colors.BLUE,

    fontSize: width(5),
    width: width(80),
    alignSelf: 'center'
  },
  desTxt: {
    color: DarkColors.GRAY,
    fontSize: width(4),
    alignSelf: 'center',
    textAlign: 'center'
  }
})
