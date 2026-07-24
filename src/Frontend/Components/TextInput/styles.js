import { StyleSheet } from 'react-native'
import { height, width, Colors, DarkColors, scale } from 'common/styles'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  containerError: {
    alignSelf: 'center'
  },
  textLabelLightmode: {
    marginBottom: height(1),
    color: Colors.GRAY1,
    fontSize: width(3.5)
  },
  textLabelDarkmode: {
    marginBottom: height(1),
    color: DarkColors.GRAY1,
    fontSize: width(3.5)
  },
  textMaxNumLightmode: {
    textAlign: 'right',
    marginTop: height(1.5),
    color: Colors.GRAY1,
    fontSize: width(3.5)
  },
  textMaxNumDarkmode: {
    textAlign: 'right',
    marginTop: height(1.5),
    color: DarkColors.TEXT2,
    fontSize: width(3.5)
  },
  opacityPlaceHolder: {
    color: Colors.GRAY1
  },
  disableColorLightmode: {
    color: Colors.GRAY1
  },
  disableColorDarkmode: {
    color: DarkColors.TEXT2
  },
  yellowColor: {
    color: Colors.GRAY1
  },
  paddingLeft: {
    paddingLeft: width(7)
  },
  smallText: {
    paddingLeft: width(2.5),
    fontSize: width(3.5)
  },
  borderFocus: {
    borderColor: '#F5B9BA'
  },
  paddingSearchLightmode: {
    color: Colors.GRAY1,
    marginLeft: width(2)
  },
  paddingSearchDarkmode: {
    color: DarkColors.TEXT2,
    marginLeft: width(2)
  },
  placeHolderStyleSearch: {
    color: Colors.GRAY3,
    position: 'absolute',
    alignItems: 'center',
    left: width(11)
  },
  placeHolderStyle: {
    color: Colors.GRAY3,
    position: 'absolute',
    alignItems: 'center'
  },
  maxNum: {
    marginTop: height(1),
    opacity: 0.7,
    alignSelf: 'flex-end',
    fontSize: width(3.5)
  },
  showView: {
    opacity: 1
  },
  headerText: {

    color: 'black',
    marginBottom: height(1.5),
    fontSize: width(4.5)
  },
  hideView: {
    opacity: 0
  },

  rowSearchInputLightmode: {
    backgroundColor: Colors.WHITE,
    borderRadius: width(2.5),
    paddingRight: width(3),
    width: width(92),
    height: height(6.5),
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row'
  },
  rowSearchInputDarkmode: {
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderRadius: width(2.5),
    paddingRight: width(3),
    width: width(92),
    height: height(6.5),
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row'
  },

  borderDisable: {
    // borderColor: Colors.GRAY,
    opacity: 0.7
  },

  rowContainerInput: {
    width: width(92),
    height: height(4.5),
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row'
  },
  rowContainerInputLightmode: {
    borderBottomColor: Colors.GRAY2
  },
  rowContainerInputDarkmode: {
    borderBottomColor: DarkColors.BLUE2
  },
  borderError: {
    borderColor: Colors.RED
  },
  textInputSearchLightmode: {
    flex: 1,
    height: height(6.5),
    fontSize: width(4.5),
    paddingVertical: 0,
    marginLeft: width(3),
    marginRight: width(2),
    color: Colors.TEXT,
    paddingLeft: width(0)
  },
  textInputSearchDarkmode: {
    flex: 1,
    height: height(6.5),
    fontSize: width(4.5),
    paddingVertical: 0,
    marginLeft: width(3),
    marginRight: width(2),
    color: DarkColors.WHITE,
    paddingLeft: width(0)
  },
  textInput: {
    flex: 1,
    fontSize: width(5.5),
    height: height(4.5),
    color: Colors.TEXT,
    marginRight: width(2),
    paddingVertical: 0
  },
  txtErr: {
    opacity: 1,
    marginLeft: width(0),
    marginTop: height(1),
    // fontSize: width(3.5),
    maxWidth: width(80),
    color: Colors.RED_TEXT
  },
  txtNoErr: {
    marginTop: height(1),
    fontSize: width(2.5),
    maxWidth: width(92),
    opacity: 0,
    left: width(5),
    color: Colors.RED_TEXT
  },
  imgPantoLottie: {
    right: width(0),
    height: scale(50),
    width: scale(50)
  }
})
