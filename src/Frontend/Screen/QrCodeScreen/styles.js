import { StyleSheet } from 'react-native'
import { width, height, Colors, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

export default StyleSheet.create({
  container: {
    flex: 1
    // marginBottom: heightFooter
  },
  flexBw: {
    marginLeft: width(5),
    width: width(50),
    height: width(20),
    justifyContent: 'space-between'
  },
  leftView: {
    zIndex: 1,
    position: 'absolute',
    top: getSafeAreaValues().top + pixelByHeight(8),
    left: pixelByWidth(16)
  },
  textGray: {
    fontSize: width(3.3),
    color: Colors.GRAY1
  },
  rowQrCode: {
    marginTop: height(4),
    width: width(90),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  textTitle: {

    fontSize: width(5)
  },
  heightSmall: {
    height: height(50)
  },
  cameraContainer: {
    overflow: 'hidden',
    backgroundColor: Colors.TEXT,
    width: width(100),
    height: height(100)
  },
  btnPing: {
    marginTop: height(5),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  // cameraContainer: {
  //   width: width(100),
  //   height: height(100)
  // },
  // Overlay above the camera (dim mask + the clear frame box).
  scanContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  },
  // SVG dim mask covering the whole screen (hole cut out for the frame).
  scanDim: {
    ...StyleSheet.absoluteFillObject
  },
  // The clear frame (camera shows through); top/left set inline. Rounded + overflow
  // hidden so the line/trail are clipped to the same rounded corners as the dim hole.
  scanBox: {
    position: 'absolute',
    width: width(70),
    height: width(70),
    borderRadius: 16,
    overflow: 'hidden'
  },
  // Fading trail (transparent → brand) that follows the sweeping line; height set inline.
  scanTrail: {
    position: 'absolute',
    left: 0,
    right: 0
  },
  scanTrailGradient: {
    ...StyleSheet.absoluteFillObject
  },
  // The crisp leading edge, pinned to the bottom of the trail.
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: Colors.BRAND
  },
  // Position for the 4 SVG corner brackets (drawn in index.js with rounded caps).
  cornerTL: { position: 'absolute', top: 0, left: 0 },
  cornerTR: { position: 'absolute', top: 0, right: 0 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0 }
})
