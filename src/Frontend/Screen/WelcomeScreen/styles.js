import { StyleSheet } from 'react-native'
import { width, height, Colors, topNavBar, homeIndicatorHeight } from 'common/styles'
export default StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  headerArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: topNavBar + height(2)
  },
  textHeader: {
    marginLeft: width(3),
    fontSize: width(3.5),
    color: Colors.GRAY1
  },
  headerLeft: {
    position: 'absolute',
    zIndex: 1,
    top: topNavBar + height(2),
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center'
  },
  textVersion: {
    paddingBottom: ISIOS ? homeIndicatorHeight : 10,
    fontSize: width(3.5),
    color: Colors.GRAY1
  },
  midView: {
    display: 'flex',
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imgLaunch: {
    marginBottom: height(2),
    height: width(75 * (686 / 676)),
    minWidth: width(75),
    maxWidth: width(75),
    resizeMode: 'contain'
  },
  paddingBtnLightmode: {
    marginTop: height(2)
  },
  paddingBtnDarkmode: {
    borderColor: Colors.BG_BOX_SMALL,
    marginTop: height(2)
  },
  txtPolicy: {
    fontSize: width(4),
    color: Colors.BLUE1,
    marginBottom: height(3)
  },
  txtTermService: {
    fontSize: width(4),
    color: Colors.BLUE1,
    marginBottom: height(1.5)
  },
  btnDisable: {
    opacity: 0.5
  }
})
