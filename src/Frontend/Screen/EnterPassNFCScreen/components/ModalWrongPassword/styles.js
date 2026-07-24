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
    width: width(92),
    height: 'auto',
    paddingVertical: height(3),
    paddingHorizontal: width(4),
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    backgroundColor: '#1D1E24',
    borderColor: Colors.BG_BOX_SMALL,
    shadowColor: Colors.BG_BOX_SMALL
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
    justifyContent: 'space-between',
    marginTop: height(1.5)
  },
  buttonLeft: {
    width: width(40)
  },
  buttonRight: {
    width: width(40)
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
    marginBottom: height(1.5)
  },
  rowInfo: {
    display: 'flex',
    alignItems: 'center'
  }
})
