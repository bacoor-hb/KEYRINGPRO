import React from 'react'
import I18n from 'assets/Lang'
import { View, AppState, Alert, Vibration } from 'react-native'
import styles from './styles'
import BtnBack from 'frontend/Components/UI/BtnBack'
import { popAction } from 'common/function'
import { width, height, Colors, sizeImageSquare, pixelByWidth, pixelByHeight, getSafeAreaValues, getSizeImgSquare } from 'common/styles'
import { connect } from 'react-redux'
import * as Animatable from 'react-native-animatable'
import Svg, { Path } from 'react-native-svg'
import LinearGradient from 'react-native-linear-gradient'
import { Camera } from 'react-native-camera-kit'
import { check, PERMISSIONS, RESULTS, request, openSettings } from 'react-native-permissions'
import { NavigationActions } from 'src/navigation/NavigationService'

// Scan-frame geometry. The dim mask is one SVG: a full-screen rect with a rounded-rect
// hole (fillRule evenodd) so the clear area's corners are properly rounded.
const SCREEN_W = width(100)
const SCREEN_H = height(100)
const FRAME = width(70)
const FRAME_X = (SCREEN_W - FRAME) / 2
const FRAME_TOP = getSafeAreaValues().top + pixelByHeight(8) + getSizeImgSquare('large') + pixelByHeight(72)
const FRAME_R = 16
// Shrink the hole ~1px so the dim slightly underlaps the frame edges, closing the
// sub-pixel seam where the camera showed through at the top corners.
const HOLE_INSET = 1
const HX1 = FRAME_X + HOLE_INSET
const HY1 = FRAME_TOP + HOLE_INSET
const HX2 = FRAME_X + FRAME - HOLE_INSET
const HY2 = FRAME_TOP + FRAME - HOLE_INSET
const DIM_PATH =
  `M0 0 H${SCREEN_W} V${SCREEN_H} H0 Z ` +
  `M${HX1 + FRAME_R} ${HY1} H${HX2 - FRAME_R} A${FRAME_R} ${FRAME_R} 0 0 1 ${HX2} ${HY1 + FRAME_R} ` +
  `V${HY2 - FRAME_R} A${FRAME_R} ${FRAME_R} 0 0 1 ${HX2 - FRAME_R} ${HY2} ` +
  `H${HX1 + FRAME_R} A${FRAME_R} ${FRAME_R} 0 0 1 ${HX1} ${HY2 - FRAME_R} ` +
  `V${HY1 + FRAME_R} A${FRAME_R} ${FRAME_R} 0 0 1 ${HX1 + FRAME_R} ${HY1} Z`

// The scan line is the bottom (leading) edge of a fading trail. Its travel is inset
// from the borders so neither the line nor the trail spills onto the corner brackets;
// `top` is the trail's top, so the line sits at `top + TRAIL_HEIGHT`.
const TRAIL_HEIGHT = width(18)
const SCAN_LINE_INSET = pixelByWidth(16)
Animatable.initializeRegistryWithDefinitions({
  animScannerRect: {
    from: { top: SCAN_LINE_INSET - TRAIL_HEIGHT },
    to: { top: width(70) - SCAN_LINE_INSET - TRAIL_HEIGHT }
  }
})

// One corner bracket of the scan frame, drawn as an L-path so the arm ends get
// rounded caps (strokeLinecap) — a plain border can only cut them flat. The base
// path hugs the top + left edges; the 4 corners reuse it via rotation.
const CORNER_ARM = sizeImageSquare(80)
const CORNER_STROKE = 6
const CORNER_RADIUS = 16
const CP = CORNER_STROKE / 2
const CORNER_PATH =
  `M ${CORNER_ARM - CP} ${CP} L ${CP + CORNER_RADIUS} ${CP} ` +
  `Q ${CP} ${CP} ${CP} ${CP + CORNER_RADIUS} L ${CP} ${CORNER_ARM - CP}`

const ScanCorner = ({ style, rotate }) => (
  <Svg width={CORNER_ARM} height={CORNER_ARM} style={[style, { transform: [{ rotate }] }]}>
    <Path
      d={CORNER_PATH}
      stroke={Colors.TEXT_MEDIUM}
      strokeWidth={CORNER_STROKE}
      fill='none'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </Svg>
)

class QrCodeScreen extends React.PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      resultsData: '',
      isTorchOn: false,
      isActiveCamera: false
    }
  }

  componentDidMount () {
    check(ISIOS ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA).then(async (response) => {
      if (response === RESULTS.DENIED || response === RESULTS.UNAVAILABLE) {
        this.requestActivePermission()
      } else if (response !== RESULTS.GRANTED) {
        this.requestPermission()
      }
    })

    this.updatePermission()
    this.appStateSubscription = AppState.addEventListener('change', this.onAppStateChange)
  }

  componentWillUnmount () {
    // this.camera && this.camera.shouldQR()
    this.appStateSubscription && this.appStateSubscription.remove()
  }

  onAppStateChange = (appState) => {
    if (appState === 'active') {
      this.updatePermission(true)
    }
  }

  updatePermission = (isAppState) => {
    check(ISIOS ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA).then(async (response) => {
      if (response === RESULTS.GRANTED) {
        this.setState({ isActiveCamera: true })
      } else if (ISIOS && isAppState && response !== RESULTS.GRANTED) {
        Alert.alert(
          I18n.t('Permission.denied'),
          I18n.t('Permission.camera'),
          [
            {
              text: I18n.t('Initial.cancel'),
              onPress: () => {
                NavigationActions.goBack()
              }
            }
          ],
          { cancelable: false }
        )
      }
    })
  }

  requestActivePermission = async () => {
    if (ISIOS) {
      request(PERMISSIONS.IOS.CAMERA)
        .then(res => {
          this.setState({ isActiveCamera: res === RESULTS.GRANTED })
          if (res !== RESULTS.GRANTED) {
            NavigationActions.goBack()
          }
        }).catch()
    } else {
      try {
        const granted = await request(
          PERMISSIONS.ANDROID.CAMERA,
          {
            title: I18n.t('Permission.denied'),
            message: I18n.t('Permission.wouldLikeAccess', { name: 'Camera' })
          }
        )
        if (granted === RESULTS.GRANTED) {
          this.setState({ isActiveCamera: true })
        } else {
          NavigationActions.goBack()
        }
      } catch (err) {
        // error here
      }
    }
  }

  requestPermission = () => {
    Alert.alert(
      I18n.t('Permission.denied'),
      I18n.t('Permission.wouldLikeAccess', { name: 'Camera' }),
      [
        {
          text: I18n.t('Initial.cancel'),
          onPress: () => {
            NavigationActions.goBack()
          }
        },
        {
          text: I18n.t('Initial.ok'),
          onPress: () => openSettings()
        }
      ],
      { cancelable: false }
    )
  }

  onBarCodeRead = async (event) => {
    const { setQrCode } = this.props.route.params || {}
    const { resultsData } = this.state

    const qrCodeData = event?.nativeEvent?.codeStringValue
    if (resultsData !== qrCodeData) {
      this.setState({ resultsData: qrCodeData })
      if (setQrCode) {
        Vibration.vibrate()
        setQrCode(qrCodeData)
        NavigationActions.goBack()
      }
    }
  }

  render () {
    const { isActiveCamera } = this.state
    return (
      <View showsVerticalScrollIndicator={false} style={styles.container}>
        {isActiveCamera
          ? (
            <View style={styles.container}>
              <Camera
                style={styles.cameraContainer}
                resizeMode='cover'
                scanBarcode
                onReadCode={this.onBarCodeRead} // optional
              />
              <View style={styles.scanContainer} pointerEvents='none'>
                {/* Single dim mask with a rounded-rect hole for the clear frame. */}
                <Svg style={styles.scanDim} width={SCREEN_W} height={SCREEN_H}>
                  <Path d={DIM_PATH} fill='rgba(0, 0, 0, 0.5)' fillRule='evenodd' />
                </Svg>
                <View style={[styles.scanBox, { top: FRAME_TOP, left: FRAME_X }]}>
                  {/* Trail first so the brackets paint on top of it (sits under the border). */}
                  <Animatable.View
                    animation='animScannerRect'
                    iterationCount='infinite'
                    duration={2500}
                    easing='linear'
                    style={[styles.scanTrail, { height: TRAIL_HEIGHT }]}>
                    <LinearGradient
                      colors={['rgba(45, 141, 237, 0)', 'rgba(45, 141, 237, 0.45)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={styles.scanTrailGradient} />
                    <View style={styles.scanLine} />
                  </Animatable.View>
                  <ScanCorner style={styles.cornerTL} rotate='0deg' />
                  <ScanCorner style={styles.cornerTR} rotate='90deg' />
                  <ScanCorner style={styles.cornerBR} rotate='180deg' />
                  <ScanCorner style={styles.cornerBL} rotate='270deg' />
                </View>
              </View>
            </View>
          )
          : <View style={styles.cameraContainer} />}

        {/* Rendered last so it paints above the native camera view. */}
        <View style={styles.leftView}>
          <BtnBack onPress={popAction} />
        </View>
      </View>
    )
  }
}

const mapStateToProps = (state) => ({})

export default connect(mapStateToProps)(QrCodeScreen)
