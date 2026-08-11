import React, { useEffect, useState } from 'react'
import { View, TouchableOpacity, Keyboard, TouchableWithoutFeedback, StyleSheet, Platform } from 'react-native'
import { KeyboardController, AndroidSoftInputModes } from 'react-native-keyboard-controller'
import LinearGradient from 'react-native-linear-gradient'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { pixelByHeight, width } from 'common/styles'
import { APP_VERSION } from 'common/constants/app'
import { handleOpenUrl } from 'common/function'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyInput from 'frontend/Components/UI/MyInput'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import styles from './styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import AppLockedOverlay from 'frontend/Components/AppLockedOverlay'
import ReduxService from 'common/redux'
import I18nWithLinks from 'frontend/Components/UI/I18nWithLinks'
import { isFaceBiometryType } from 'common/keychain'

const UnlockPage = (_this) => {
  const { func, state } = _this
  const { onChangePassword, onPressFaceId, onUnlock } = func
  const { password = '', isLoading = false, isError = false, isAutoAuthing = false, isFaceIdEnabled = false, isLocked = false, attemptsLeft = null, biometryType = null } = state

  const errMessage = isError
    ? (attemptsLeft != null
      ? `Wrong password. App will be locked for 1h (${attemptsLeft} left)`
      : I18n.t('v2.password.incorrectPassword'))
    : undefined

  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const isKeyboardVisible = keyboardHeight > 0

  // Android 15 (targetSdk 35) forces edge-to-edge, which changed windowSoftInputMode
  // behavior — the deprecated adjustPan now pans ON TOP of this screen's JS keyboard
  // avoidance (the card floats to `bottom: keyboardHeight` below), so the UI shoots up too
  // far on keyboard open and snaps back on the first keystroke. ADJUST_NOTHING keeps the
  // window still so the JS float is the single source of truth; restored to the app default
  // on unmount. Same pattern/library as AISearch (added for this exact edge-to-edge case).
  // No-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING)
    return () => KeyboardController.setDefaultMode()
  }, [])

  useEffect(() => {
    const showSub = Keyboard.addListener(ISIOS ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height))
    const hideSub = Keyboard.addListener(ISIOS ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.headerArea}>
          <ImageRender
            uri={images.UIV2.icons.coldNFCWallet}
            style={styles.coldNFC} />
          <View style={{ marginTop: pixelByHeight(8), marginBottom: pixelByHeight(4) }}>
            <ImageRender
              style={{ width: width(55), height: width(55) * (61 / 257) }}
              resizeMode='contain'
              uri={images.UIV2.keyringProText} />
          </View>
          <DotLottie
            style={{
              width: width(65),
              height: width(65) * (278 / 250)
            }}
            source={images.scanTag}
            autoplay
            loop />
        </View>

        <View
          style={[
            styles.midView,
            isKeyboardVisible && styles.midViewSticky,
            isKeyboardVisible && { bottom: keyboardHeight + pixelByHeight(16) }
          ]}
        >
          {isAutoAuthing ? (
            <MyDotsLoading style={styles.loading} />
          ) : (
            // Toggling only the wrapper style (not the component type / children) keeps the
            // TextInput mounted, so focus is retained and the keyboard doesn't flicker.
            <View style={[styles.inputWrap, isKeyboardVisible && styles.inputCard]}>
              {/* Always-rendered background layer (only its colors change with the keyboard) so
                  the TextInput stays mounted and the keyboard never flickers. Darkens top→bottom. */}
              <LinearGradient
                pointerEvents='none'
                colors={isKeyboardVisible ? ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.92)'] : ['transparent', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <MyInput
                value={password}
                onChangeText={onChangePassword}
                variant='primary'
                typeInput='password'
                placeholder={I18n.t('NFC.enterPass')}
                isError={isError}
                errMessage={errMessage}
                errorInFlow
                errorSpaceHeight={pixelByHeight(42)}
                rightIcon={isFaceIdEnabled ? (
                  <TouchableOpacity activeOpacity={0.7} onPress={onPressFaceId}>
                    {/* Face icon only when the device really authenticates by face —
                        fingerprint / passcode devices get the generic device-auth icon. */}
                    <MyIcon uri={isFaceBiometryType(biometryType) ? images.UIV2.icons.faceID : images.UIV2.security.deviceAuthen} variant='small' />
                  </TouchableOpacity>
                ) : undefined}
              />
              <View style={styles.unlockBtn}>
                <MyButton
                  className='w-full'
                  onPress={onUnlock}
                  isLoading={isLoading}
                  isDisable={!password}
                  label={I18n.t('v2.password.unlock')}
                />
              </View>
            </View>
          )}
        </View>

        {!isKeyboardVisible && (
          <>
            <View style={styles.footer}>
              <I18nWithLinks
                variant='small'
                text={I18n.t('v2.common.agreeDescription')}
                links={{
                  privacyPolicy: { label: I18n.t('v2.common.privacyPolicy'), onPress: () => handleOpenUrl(ReduxService.getSettingOther('keyring_url_policy')) },
                  termsOfUse: { label: I18n.t('v2.common.termsOfUse'), onPress: () => handleOpenUrl(ReduxService.getSettingOther('keyring_url_terms_of_service')) }
                }}
              />
            </View>
            <View style={styles.versionWrap}>
              <MyText variant='small' className='text-low'>
                {I18n.t('Initial.version', { name: APP_VERSION })}
              </MyText>
            </View>
          </>
        )}
        {isLocked && <AppLockedOverlay />}
      </View>
    </TouchableWithoutFeedback>
  )
}

export default UnlockPage
