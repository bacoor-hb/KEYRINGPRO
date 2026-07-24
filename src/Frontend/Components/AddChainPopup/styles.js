import {
  StyleSheet
} from 'react-native'

import {
  width,
  height,
  Colors,
  Font,
  DarkColors,
  commonSize
}
from 'common/styles'

export default StyleSheet.create({
  container: {
    width: width(92),
    height: 'auto',
    paddingVertical: height(3),
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingLeft: width(4),
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
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
  peerInfoBox: {
    width: '60%',
    alignSelf: 'center',
    marginBottom: height(2),
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    textAlign: 'center'
  },
  iconBox: {
    paddingHorizontal: width(0.5),
    paddingVertical: height(1),
    marginHorizontal: width(5),
    justifyContent: 'center',
    alignItems: 'center'
  },
  tokenIcon: {
    width: 28,
    height: 28
  },
  iconNameLightmode: {
    color: Colors.GRAY,
    fontSize: width(3),
    textTransform: 'uppercase',
    marginTop: height(1.2)
  },
  iconNameDarkmode: {
    color: DarkColors.TEXT1,
    fontSize: width(3),
    textTransform: 'uppercase',
    marginTop: height(1.2)
  },
  owaraiLogo: {
    width: width(10),
    height: width(10)
  },
  owaraiLink: {
    width: width(7),
    height: width(7)
  },
  peerLogo: {
    width: width(10),
    height: width(10)
  },
  titleConnectWithThisSite: {
    textAlign: 'center',
    alignSelf: 'center',
    fontFamily: Font.BOLD,
    fontSize: width(4)
  },
  titleConnectDarkmode: {
    color: DarkColors.WHITE,
    fontFamily: Font.BOLD,
    fontSize: width(4),
    textAlign: 'left',
    textTransform: 'uppercase',
    marginVertical: height(0)
  },
  titleConnectLightmode: {
    color: Colors.BLACK,
    fontFamily: Font.BOLD,
    fontSize: width(4),
    textAlign: 'left',
    textTransform: 'uppercase',
    marginVertical: height(0)
  },
  chainIdTxtDarkmode: {
    color: DarkColors.WHITE,
    fontSize: width(3.5),
    textAlign: 'left',
    textTransform: 'uppercase',
    marginTop: height(0.5)
  },
  chainIdTxtLightmode: {
    width: '90%',
    color: Colors.BLACK,
    fontSize: width(3.5),
    textAlign: 'left',
    textTransform: 'uppercase',
    marginTop: height(0.5)
  },
  subTitleConnectWithThisSiteDarkmode: {
    width: '90%',
    color: DarkColors.TEXT2,
    fontSize: width(4),
    textAlign: 'left',
    textTransform: 'uppercase',
    marginTop: height(1.5)
  },
  subTitleConnectWithThisSiteLightmode: {
    width: '90%',
    color: Colors.GRAY1,
    fontSize: width(4),
    textAlign: 'left',
    textTransform: 'uppercase',
    marginTop: height(1.5)
  },
  currentChain: {
    alignSelf: 'center',
    maxWidth: width(80),
    lineHeight: width(4),
    fontSize: width(4),
    marginTop: height(2),
    minHeight: width(5)
  },
  listIconChainContainer: {
    width: width(91),
    flexDirection: 'row',
    marginBottom: height(1.5),
    marginTop: height(1)
  },
  listCoinContainer: {
    width: width(92),
    maxHeight: height(45),
    marginTop: height(1.5)
  },
  checkedStyle: {
    top: height(0.5),
    left: height(0.5),
    position: 'absolute',
    color: DarkColors.BLUE1,
    fontSize: width(5)
  },
  checkedChainStyle: {
    top: height(0),
    left: height(-0.5),
    position: 'absolute',
    color: DarkColors.BLUE1,
    fontSize: width(4),
    zIndex: 1000
  },
  uncheckedStyle: {
    position: 'absolute',
    top: height(0.5),
    left: height(0.5),
    color: DarkColors.GRAY,
    fontSize: width(4)
  },
  userBoxLightmode: {
    alignSelf: 'flex-start',
    width: width(84),
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: height(0.5),
    paddingHorizontal: width(5),
    paddingVertical: width(2),
    borderColor: Colors.HEADERLINE,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: width(2)
  },
  userBoxDarkmode: {
    backgroundColor: DarkColors.BLUE2,
    alignSelf: 'flex-start',
    width: width(84),
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: height(0.5),
    paddingHorizontal: width(5),
    paddingVertical: width(3),
    borderColor: DarkColors.GRAY4,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: width(2)
  },
  leftUserBox: {
    marginRight: width(4)
  },
  rightUserBox: {

  },
  avatarUser: {
    borderRadius: width(100),
    marginRight: width(2),
    width: width(12),
    height: width(12)
  },
  rightUserName: {
    width: width(65),
    fontFamily: Font.BOLD,
    marginBottom: height(0.5),
    color: Colors.TEXT,
    fontSize: height(2),
    alignSelf: 'flex-start',
    textAlign: 'left'
  },
  rightUserAddressLightmode: {
    color: Colors.GRAY1,
    fontSize: height(2),
    alignSelf: 'flex-start',
    textAlign: 'left'
  },
  rightUserAddressDarkmode: {
    color: DarkColors.TEXT2,
    fontSize: height(2),
    alignSelf: 'flex-start',
    textAlign: 'left'
  },
  bottomBox: {
    marginTop: height(1.5),
    alignSelf: 'flex-end',
    flexDirection: 'row'
  },
  buttonRejectBox: {
    paddingVertical: height(2),
    paddingHorizontal: height(3)
  },
  buttonConnectBox: {
    borderTopLeftRadius: width(4),
    borderBottomRightRadius: width(2),
    paddingVertical: height(2),
    paddingHorizontal: height(3),
    backgroundColor: DarkColors.BLUE,
    justifyContent: 'center',
    alignContent: 'center'
  },
  textReject: {
    textAlign: 'center',
    fontFamily: Font.BOLD,
    color: Colors.TEXT
  },
  textConnect: {
    fontFamily: Font.BOLD,
    color: Colors.WHITE
  },
  informationIcon: {
    marginBottom: height(1.5),
    width: width(10),
    height: width(10)
  },
  labelDarkmode: {
    fontSize: width(4),
    width: '100%',
    color: DarkColors.YELLOW
  },
  labelLightmode: {
    fontSize: width(4),
    width: '100%',
    color: Colors.YELLOW
  },
  labelNetWorkNotMatchDarkmode: {
    fontSize: width(4),
    width: '100%',
    color: DarkColors.TEXT1
  },
  labelNetWorkNotMatchLightmode: {
    fontSize: width(4),
    width: '100%',
    color: Colors.TEXT
  },
  nfcIconBox: {
    position: 'absolute',
    right: width(2)
  },
  nfcIcon: {
    width: height(5),
    height: height(5)
  },
  addressDotColor: {
    width: commonSize._11px,
    height: commonSize._11px,
    borderRadius: commonSize._11px / 2,
    marginRight: width(1.5)
  },
  newAddressBox: {
    marginTop: height(3),
    width: width(84),
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center'
  },
  newAddressTxt: {
    textAlign: 'center',
    color: DarkColors.BLUE1,
    fontSize: width(4)
  }
})
