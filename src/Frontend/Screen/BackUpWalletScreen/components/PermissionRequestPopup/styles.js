
import {
  StyleSheet
} from 'react-native'

import {
  width,
  height,
  scale,
  Colors,
  DarkColors,
  Font,
  heightScale
}
from 'common/styles'

export default StyleSheet.create({
  container: {
    width: width(92),
    height: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    paddingTop: height(3),
    borderRadius: 6,
    position: 'relative'
  },
  containerDarkmode: {
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: DarkColors.BLUE2
  },
  containerLightmode: {
    backgroundColor: Colors.WHITE
  },
  titleTokenDetailLightmode: {
    fontSize: width(4) - 2,
    color: '#828282'
  },
  titleTokenDetailDarkmode: {
    fontSize: width(4) - 2,
    color: '#8B98A4'
  },
  introContainerLightmode: {
    width: width(90),
    height: 'auto',
    backgroundColor: 'white',
    paddingVertical: height(5),
    paddingBottom: height(2),
    paddingLeft: width(2),
    paddingRight: width(2),
    borderColor: Colors.WHITE,
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: width(2),
    shadowColor: Colors.WHITE,
    position: 'relative',
    alignItems: 'center',
    shadowOffset: {
      width: 0, height: 0
    },
    shadowOpacity: 1,
    shadowRadius: 2
  },
  introContainerDarkmode: {
    width: width(90),
    height: 'auto',
    backgroundColor: Colors.BLUE4,
    paddingVertical: height(5),
    paddingBottom: height(2),
    paddingLeft: width(2),
    paddingRight: width(2),
    borderColor: Colors.BLUE4,
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: width(2),
    shadowColor: Colors.BLUE4,
    position: 'relative',
    alignItems: 'center',
    shadowOffset: {
      width: 0, height: 0
    },
    shadowOpacity: 1,
    shadowRadius: 2
  },
  imageBackground: {
    width: width(90),
    height: height(15),
    resizeMode: 'cover',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center'
  },

  whiteLine: {
    height: scale(1),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: height(2),
    backgroundColor: Colors.DARK_BLUE
  },

  textDes1: {
    marginBottom: height(2),
    textAlign: 'center',
    width: width(70),
    color: Colors.GRAY1,
    textTransform: 'uppercase'
  },
  textTitle: {
    marginVertical: height(1),
    textAlign: 'center',
    width: width(70),
    color: Colors.TEXT
  },

  textInfo: {
    marginLeft: width(2)
  },
  rowRadio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginRight: width(5)
  },

  textNote2: {
    marginLeft: width(5),
    color: '#8F9CB6'
  },

  contentStyle: {
    marginHorizontal: width(5),
    marginBottom: height(2.5)
  },

  EditTitle: {
    textAlign: 'center',

    fontStyle: 'normal',

    fontSize: width(5),
    color: '#333333',
    width: width(60),
    marginVertical: height(2)
  },

  textInput: {
    width: width(80),
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F2'
  },

  textInputAddressBox: {
    marginBottom: height(2)
  },

  boxButton: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: height(6)
  },

  cancelButton: {
    width: width(40),
    backgroundColor: 'white',
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    borderWidth: 1,
    shadowColor: '#F2F2F2',
    shadowOffset: {
      width: 0, height: 0
    },
    shadowOpacity: 0.3,
    shadowRadius: 1
  },

  updateButton: {
    marginVertical: height(2),
    width: width(40),
    height: height(5),
    shadowColor: '#F2F2F2',
    shadowOffset: {
      width: 0, height: 0
    },
    shadowOpacity: 0.3,
    shadowRadius: 1
  },

  updateButtonFull: {
    marginVertical: height(2),
    width: width(80),
    maxWidth: width(80),
    height: height(5),
    shadowColor: '#F2F2F2',
    shadowOffset: {
      width: 0, height: 0
    },
    shadowOpacity: 0.3,
    shadowRadius: 1
  },

  styleBtnContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
    position: 'relative'
  },
  textButtonColor: {
    color: '#333333'
  },

  textStyle: {
    color: Colors.WHITE
  },

  disable: {
    opacity: 0.6
  },
  imgIconBaby: {
    marginTop: height(5),
    height: width(40),
    width: width(100),
    position: 'relative',
    resizeMode: 'contain'
  },
  imgIconExisted: {
    marginTop: height(5),
    height: width(20),
    width: width(100),
    position: 'relative',
    resizeMode: 'contain'
  },
  imgClosed: {
    width: width(4),
    height: width(4)
  },
  btnBackground: {
    resizeMode: 'contain'
  },
  txtNoThanks: {
    textAlign: 'center'
  },
  closeIcon: {
    fontSize: 24
  },
  cancelButtonLightmode: {
    width: width(40),
    backgroundColor: 'white',
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    borderWidth: 1,
    shadowColor: '#F2F2F2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 1
  },
  cancelButtonDarkmode: {
    width: width(40),
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: DarkColors.GRAY4,
    borderStyle: 'solid',
    borderWidth: 1,
    shadowColor: DarkColors.GRAY4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 1
  },
  bottomBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: width(2.5),
    marginVertical: height(3)
  },
  buttonRejectBox: {
    paddingVertical: height(3),
    paddingHorizontal: height(3)
  },
  buttonConnectBox: {
    borderTopLeftRadius: width(4),
    borderBottomRightRadius: width(2),
    paddingVertical: height(3),
    paddingHorizontal: height(3),
    backgroundColor: DarkColors.BLUE
  },
  textReject: {
    fontFamily: Font.BOLD,
    color: Colors.TEXT
  },
  textConnect: {
    fontFamily: Font.BOLD,
    color: Colors.WHITE
  },
  txtDesc: {
    width: '100%',
    fontSize: 16,
    alignSelf: 'center',
    textAlign: 'center'
  },
  txtDescDarkmode: {
    color: DarkColors.TEXT2
  },
  txtDescLightmode: {
    color: Colors.GRAY1
  },
  textDes: {
    width: '80%',
    fontSize: 20,

    textAlign: 'center',
    alignSelf: 'center',
    marginTop: height(5)
  },
  textDesDarkmode: {
    color: DarkColors.TEXT2
  },
  textDesLightmode: {
    color: Colors.GRAY1
  },
  noData: {
    height: height(16.5),
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tokenIcon: {
    width: 31,
    height: 31
  },
  iconError: {
    width: 100,
    height: 100
  },
  iconErrorSmall: {
    width: 50,
    height: 50
  },
  rowAccount: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: height(1)
  },
  txtTitle: {
    fontSize: 18,

    marginBottom: height(1.5),
    textAlign: 'center'
  },
  boxContent: {
    alignItems: 'center',
    justifyContent: 'center',
    // paddingVertical: height(3),
    paddingTop: height(3),
    paddingBottom: height(1.5),
    width: width(90),
    alignSelf: 'center'
  },
  buttonLeftDarkmode: {
    width: width(38)
  },
  buttonLeftLightmode: {
    width: width(38)
  },
  btnLoading: {
    height: heightScale(5),
    width: heightScale(5)
  },
  imgToken: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain'
  },
  icChecked: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 25,
    height: 25,
    resizeMode: 'contain',
    overflow: 'visible'
  }
})
