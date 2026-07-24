import { StyleSheet } from 'react-native'
import { width, height, scale, DarkColors, Colors, pixelByHeight, pixelByWidth } from 'common/styles'
export default StyleSheet.create({
  navigation: {
    width: width(100),
    marginTop: height(2),
    marginLeft: width(2),
    flexDirection: 'row',
    overflow: 'scroll'
  },
  container: {
    height: 'auto',
    paddingHorizontal: pixelByHeight(16),
    paddingVertical: pixelByWidth(16),
    borderStyle: 'solid',
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
  titleReset: {

    fontStyle: 'normal',
    fontSize: width(5.5),
    color: '#333333',
    textAlign: 'center',
    marginBottom: height(1),
    marginTop: height(1)
  },
  subTitleResetLightmode: {
    fontSize: width(4),
    color: Colors.GRAY1,
    textAlign: 'center',
    marginBottom: height(1)
  },
  subTitleResetDarkmode: {
    fontSize: width(4),
    color: DarkColors.TEXT2,
    textAlign: 'center',
    marginBottom: height(1)
  },
  descriptionWarningLightmode: {
    fontSize: width(4),
    lineHeight: scale(20),
    color: Colors.GRAY1,
    textAlign: 'left'
  },
  descriptionWarningDarkmode: {
    fontSize: width(4),
    lineHeight: scale(20),
    color: DarkColors.WHITE,
    textAlign: 'left'
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
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: height(3)
  },
  textButtonColor: {
    color: '#333333'
  },
  buttonLeftLightmode: {
    width: width(38),
    backgroundColor: 'white',
    borderColor: '#E0E0E0',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 6
  },
  buttonLeftDarkmode: {
    width: width(80),
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: DarkColors.TEXT2,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 6
  },
  buttonRight: {
    alignItems: 'center',
    width: width(76),
    borderRadius: 6
  }

})
