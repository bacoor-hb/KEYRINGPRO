import { StyleSheet } from 'react-native'
import { Colors, width, height, topNavBar, pixelByHeight, pixelByWidth } from 'common/styles'

export default StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: '#050508'
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%'
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: pixelByWidth(16)
  },
  title: {
    color: Colors.WHITE,
    textAlign: 'center'
  },
  subtitle: {
    marginTop: pixelByHeight(8),
    color: Colors.WHITE,
    textAlign: 'center'
  },
  headerArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: topNavBar + height(2)
  },
  coldNFC: {
    height: width(30 * (148 / 248)),
    minWidth: width(30),
    maxWidth: width(30),
    resizeMode: 'contain'
  },
  logoWrap: {
    marginTop: pixelByHeight(8),
    marginBottom: pixelByHeight(4)
  }
})
