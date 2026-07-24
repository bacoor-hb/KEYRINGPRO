import { StyleSheet } from 'react-native'
import { width, height, DarkColors, Colors } from 'common/styles'

export default StyleSheet.create({
  container: {
    marginBottom: height(6)
  },
  ConfirmDeleteContainer: {
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
  confirmTitle: {
    textAlign: 'center',

    fontSize: width(5),
    color: '#333333',
    marginBottom: height(3)
  },
  confirmDesLightmode: {
    paddingHorizontal: width(2),
    textAlign: 'left',
    color: Colors.GRAY1,
    fontSize: width(3.5)
  },
  confirmDesDarkmode: {
    paddingHorizontal: width(2),
    textAlign: 'left',
    color: DarkColors.TEXT2,
    fontSize: width(3.5)
  },
  boxButton: {
    marginTop: height(1.5),
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cancelButton: {
    width: width(40)
  },
  updateButton: {
    width: width(40)
  },
  ThreeStepBox: {
    paddingVertical: height(3),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch'
  },
  StepBox: {
    paddingVertical: height(0),
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1
  },
  numberStepBox: {
    justifyContent: 'center',
    alignItems: 'center',
    width: width(6),
    height: width(6),
    backgroundColor: DarkColors.BLUE2,
    borderRadius: width(100)
  },
  numberStepTxt: {
    color: Colors.WHITE,
    fontSize: width(3)
  },
  imageStepBox: {
    marginVertical: height(1.5),
    width: width(15),
    height: width(20)
  },
  stepImage: {
    width: width(15),
    height: width(20)
  },
  stepTitleDarkmode: {
    color: DarkColors.TEXT2,
    textAlign: 'center',
    width: '100%'
  },
  stepTitleLightmode: {
    color: Colors.GRAY1,
    textAlign: 'center',
    width: '100%'
  }
})
