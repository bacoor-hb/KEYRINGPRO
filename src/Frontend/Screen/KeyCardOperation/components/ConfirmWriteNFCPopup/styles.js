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
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
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
    textAlign: 'center',
    color: Colors.GRAY1,
    fontSize: width(3.5)
  },
  confirmDesDarkmode: {
    textAlign: 'center',
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
  }
})
