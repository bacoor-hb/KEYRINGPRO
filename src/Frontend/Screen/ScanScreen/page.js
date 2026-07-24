import React from 'react'
import { Keyboard, View } from 'react-native'
import styles from './styles'
import { height, width } from 'common/styles'
import images from 'assets/Image'
import * as Animatable from 'react-native-animatable'
import { Camera } from 'react-native-camera-kit'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { KeyboardInput } from 'frontend/Components/Common/KeyboardInput'
import HeaderScan from './Components/HeaderScan'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'

Animatable.initializeRegistryWithDefinitions({
  animScannerRect: {
    from: {
      top: width(0)
    },
    to: {
      top: width(70)
    }
  }
})

export default function Template (props) {
  const thisMain = props._this

  const { isActiveCamera, isFocusPasteView, isLoadingWalletConnectPay, isLoadingWalletConnect } = thisMain.state

  return (
    <ThemeContext.Consumer>{(context) => {
      return (
        <KeyboardInput enableOnAndroid style={{ justifyContent: 'center' }} extraScrollHeight={height(10)}>
          <View showsVerticalScrollIndicator={false} style={styles.container} onPress={Keyboard.dismiss}>
            <HeaderScan _this={props._this} />
            {/* <View style={{ position: 'absolute', top: 0, paddingTop: topNavBar + width(7) / 2 - 2, paddingHorizontal: width(4), left: 0, right: 0, zIndex: 1 }}>
              <LabelWalletConnect isNoMode />
            </View> */}
            {/* {((!isHidePasteArea && !isStopScan && isActiveCamera)) && (
              <View style={[styles.pasteCodeBox, { gap: width(2.5) }]}>
                <Text style={{ color: context.styleTheme.subColor }}>
                  {I18n.t('WalletConnect.walletConnectCode')}
                </Text>
                <TouchableOpacity style={styles.pasteButton} onPress={thisMain.onPasteWalletConnectCode}>
                  <View style={[styles.containerBtnCopy, styles[`containerBtnCopy${context.modeTheme}`]]}>
                    <ImageRender
                      resizeMode='contain'
                      uri={isDarkMode ? images.copyHashIconDarkmode : images.copyHashIcon}
                      style={styles.pasteIcon}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            )} */}

            {
              isActiveCamera && !isFocusPasteView ? (
                <View style={[styles.cameraContainer]}>
                  <Camera
                    style={{ flex: 1, width: '100%' }}
                    resizeMode='cover'
                    scanBarcode
                    onReadCode={thisMain.onBarCodeRead} // optional
                  />
                </View>
              ) : (
                <View style={[styles.cameraContainer, { justifyContent: 'center', alignItems: 'center' }]} onPress={Keyboard.dismiss}>
                  {
                    isLoadingWalletConnect || isLoadingWalletConnectPay ? (
                      <DotLottie
                        loop
                        autoplay
                        style={styles.loadingPanto}
                        source={images.keyringLoadingV2} />
                    ) : null
                  }
                </View>
              )
            }
            <View style={styles.containerWCPay}>
              <View style={styles.btnWCPay}>
                <MyIcon style={styles.iconWCPay} uri={images.UIV2.icons.walletConnectPayWhite} />
              </View>
            </View>

          </View>
        </KeyboardInput>
      )
    }}
    </ThemeContext.Consumer>
  )
}
// UPDATE_NEW_CHAIN
// you need to add image of new chain or layer2 here. Thats all for this page. the image size should be 29x29 PNG.
