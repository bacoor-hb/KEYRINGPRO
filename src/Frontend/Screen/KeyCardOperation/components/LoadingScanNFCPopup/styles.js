import { StyleSheet } from 'react-native'
import { width, height, Colors } from 'common/styles'

export default StyleSheet.create({
  loadingContainer: {
    width: width(100),
    height: 'auto',
    backgroundColor: '#1D1E24',
    paddingTop: height(5),
    paddingBottom: height(5),
    paddingLeft: width(2),
    paddingRight: width(2),
    borderColor: Colors.BG_BOX_SMALL,
    borderStyle: 'solid',
    borderWidth: 1,
    borderRadius: 32,
    borderBottomRightRadius: 0,
    borderBottomLeftRadius: 0,
    shadowColor: Colors.BG_BOX_SMALL,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2
  },
  LottieView: {
    alignSelf: 'center',
    height: height(30),
    width: width(80)
  },
  stepViewContainer: {
    alignSelf: 'center',
    marginBottom: width(4),
    flexDirection: 'row'
  },
  stepView: {
    borderRadius: width(2),
    marginRight: width(1.5),
    paddingVertical: width(0.6),
    paddingHorizontal: width(2.5),
    backgroundColor: Colors.GRAY
  },
  confirmTitle: {
    textAlign: 'center',

    fontSize: width(5.5),
    color: '#333333',
    marginBottom: height(1.5)
  },
  confirmSubTitle: {
    alignSelf: 'center',
    width: '80%',
    textAlign: 'center',
    fontSize: width(4),
    color: '#333333',
    marginBottom: height(3.5)
  },
  boxButton: {
    marginTop: height(3),
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  cancelButton: {
    width: width(50)
  }
})
