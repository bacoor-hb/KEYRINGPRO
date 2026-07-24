import { StyleSheet } from 'react-native'
import { width, height, Colors, DarkColors } from 'common/styles'
export default StyleSheet.create({
  container: {
    width: width(92),
    height: 'auto',
    paddingTop: 0,
    paddingBottom: height(1.5),
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
    backgroundColor: DarkColors.BACKGROUND_BOX,
    borderColor: DarkColors.BLUE2,
    shadowColor: DarkColors.BLUE2
  },
  navigationBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: height(1.5)
  },
  closeIcon: {
    fontSize: width(6)
  },
  text: {
    marginBottom: height(1.5),
    textAlign: 'left',
    fontSize: width(4),
    color: Colors.GRAY1,
    flex: 1
  },
  textManageReceiveLink: {
    marginTop: height(2),
    marginBottom: height(1),
    textAlign: 'left',
    fontSize: width(4),
    color: Colors.BLUE
  },
  textContainer: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  textBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0
  },
  circleDot: {
    borderRadius: width(10),
    marginRight: width(3),
    width: width(2.5),
    height: width(2.5),
    backgroundColor: Colors.BLUE,
    marginTop: width(1.5)
  }
})
