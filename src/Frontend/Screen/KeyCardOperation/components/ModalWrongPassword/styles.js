import { StyleSheet } from 'react-native'
import { width, height, scale, DarkColors, Colors } from 'common/styles'
export default StyleSheet.create({
  navigation: {
    width: width(100),
    marginTop: height(2),
    marginLeft: width(2),
    flexDirection: 'row',
    overflow: 'scroll'
  },
  containerDissmis: {
    width: width(100),
    height: height(100),
    zIndex: 999
  },
  container: {
    width: width(90),
    height: 'auto',
    backgroundColor: '#1D1E24',
    paddingTop: height(2),
    paddingBottom: height(3),
    paddingLeft: width(5),
    paddingRight: width(5),
    borderColor: Colors.BG_BOX_SMALL,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 20,
    shadowColor: Colors.BG_BOX_SMALL,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2
  },
  IconWarningBox: {
    marginBottom: height(1),
    justifyContent: 'center',
    alignItems: 'center'
  },
  IconWarning: {

  },
  titleResetLightmode: {

    fontSize: width(5),
    color: '#333333',
    textAlign: 'center',
    marginBottom: height(2),
    marginTop: height(1)
  },
  titleResetDarkmode: {

    fontSize: width(5),
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
  descriptionWarning: {
    fontSize: width(4),
    lineHeight: scale(20),
    color: '#828282',
    textAlign: 'center'
  },
  navigationBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  closeIcon: {
    color: '#BDBDBD',
    fontSize: width(7)
  },
  buttonBox: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: height(3)
  },
  buttonLeft: {
    width: width(38)
  },
  buttonRight: {
    width: width(38)
  },
  containerInput: {
    width: width(80)
  },
  rowSend: {
    marginTop: height(3)
  },
  iconCheckedIcon: {
    zIndex: 999,
    overflow: 'visible',
    width: width(25),
    height: width(25),
    marginBottom: width(2)
  },
  rowInfo: {
    display: 'flex',
    alignItems: 'center'
  }
})
