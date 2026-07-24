import { StyleSheet } from 'react-native'
import { width, height, scale, Colors } from 'common/styles'

export default StyleSheet.create({
  container: {
    width: width(90),
    height: 'auto',
    backgroundColor: 'white',
    paddingTop: height(2),
    paddingBottom: height(5),
    paddingLeft: width(5),
    paddingRight: width(5),
    borderColor: '#F2F2F2',
    borderStyle: 'solid',
    borderWidth: scale(1),
    borderRadius: 20,
    shadowColor: '#F2F2F2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 2
  },
  containerLightmode: {
    backgroundColor: Colors.WHITE
  },
  containerDarkmode: {},
  navigationBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  closeIcon: {
    color: '#BDBDBD',
    fontSize: scale(25)
  },
  backupTitle: {

    fontSize: scale(20),
    lineHeight: scale(19),
    color: '#333333',
    textAlign: 'center',
    marginBottom: height(2)
  },
  backupStatus: {
    flexDirection: 'row',
    marginBottom: height(2)
  },
  backupStatusBackedUpText: {
    fontSize: scale(13),
    lineHeight: scale(19),
    color: '#000000'
  },
  internalText: {
    color: '#F2994A',
    fontSize: scale(13),
    lineHeight: scale(19)
  },
  descriptionText: {
    color: '#333333',

    fontSize: scale(16),
    lineHeight: scale(19),
    marginBottom: height(2)
  },
  anycaseText: {
    color: '#333333',
    fontSize: scale(14),
    lineHeight: scale(19)
  }
})
