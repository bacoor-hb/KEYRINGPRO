import { StyleSheet } from 'react-native'
import { width, height, Colors, DarkColors } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
    justifyContent: 'center'
  },
  imgShit: {
    height: height(20),
    width: width(50),
    resizeMode: 'contain'
  },
  appCrashTitle: {
    maxWidth: width(90),
    marginTop: height(5),
    marginBottom: height(2),
    textAlign: 'center',
    fontSize: width(6)
  },
  appCrashLightmode: {
    maxWidth: width(90),
    marginBottom: height(7),
    textAlign: 'center',
    color: Colors.GRAY,
    fontSize: width(3.5)
  },
  appCrashDarkmode: {
    maxWidth: width(90),
    marginBottom: height(7),
    textAlign: 'center',
    color: DarkColors.WHITE,
    fontSize: width(3.5)
  }

})
export default styles
