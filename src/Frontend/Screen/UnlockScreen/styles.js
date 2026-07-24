import { StyleSheet } from 'react-native'
import { width, height, topNavBar, homeIndicatorHeight, pixelByHeight, pixelByWidth } from 'common/styles'

export default StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  headerArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: topNavBar + height(2)
  },
  midView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imgLaunch: {

    height: width(70 * (638 / 648)),
    minWidth: width(70),
    maxWidth: width(70),
    resizeMode: 'contain'
  },
  coldNFC: {
    height: width(30 * (148 / 248)),
    minWidth: width(30),
    maxWidth: width(30),
    resizeMode: 'contain'
  },
  inputWrap: {
    width: width(100) - pixelByWidth(16)
  },
  inputCard: {
    paddingTop: 0,
    paddingBottom: pixelByHeight(16)
  },
  loading: {
    width: pixelByWidth(48),
    height: pixelByWidth(48)
  },
  unlockBtn: {
    width: '100%',
    marginTop: pixelByHeight(0)
  },
  midViewSticky: {
    flex: 0,
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  footer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: width(90),
    paddingBottom: pixelByHeight(4)
  },
  footerRow: {
    flexDirection: 'row'
  },
  versionWrap: {
    paddingBottom: homeIndicatorHeight
  }
})
