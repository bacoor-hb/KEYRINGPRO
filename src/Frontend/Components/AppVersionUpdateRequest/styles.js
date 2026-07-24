import { StyleSheet } from 'react-native'
import { width, height, DarkColors, Colors } from 'common/styles'

export default StyleSheet.create({
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
    borderWidth: 1
  },
  containerLightmode: {
    backgroundColor: Colors.WHITE,
    borderColor: Colors.GRAY3,
    shadowColor: Colors.GRAY3
  },
  containerDarkmode: {
    backgroundColor: '#212229',
    borderColor: DarkColors.BLUE2,
    shadowColor: DarkColors.BLUE2
  },
  boxButton: {
    marginTop: height(1.5),
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  btnRightButton: {
    width: width(84)
  }
})
