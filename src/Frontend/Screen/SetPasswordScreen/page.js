import React from 'react'
import I18n from 'assets/Lang'
import { Keyboard, ScrollView, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import MyInput from 'frontend/Components/UI/MyInput'
import MyText from 'frontend/Components/UI/MyText'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MySwitch from 'frontend/Components/UI/MySwitch'
import Checkbox from 'frontend/Components/Common/Checkbox'
import images from 'assets/Image'
import styles from './styles'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import { pixelByHeight } from 'common/styles'
import InputCustom from 'frontend/Components/UI/InputCustom'
import { getDeviceAuthLabel, isFaceBiometryType } from 'common/keychain'

const SetPasswordPage = (_this) => {
  const { func, state } = _this
  const { onChangeText, onToggleFaceId, onToggleAgree } = func
  const {
    newPassword = '',
    confirmPassword = '',
    isPassNotMatch = false,
    isFaceIdOn = false,
    isAgree = false,
    biometryType = null,
    isBiometricAvailable = false
  } = state

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <MyViewPage style={styles.container}>
          <View style={styles.formSection}>
            <TitleScreen title={I18n.t('v2.password.setPassword')} />

            <View style={styles.inputGroup}>
              <View>
                <InputCustom
                  value={newPassword}
                  onChangeText={onChangeText('newPassword')}
                  typeInput='password'
                  leftIcon={images.UIV2.icons.password}
                  leftIconConfig={{ iconWrapperStyle: styles.leftIconWrapper }}
                  placeholder={I18n.t('v2.password.setPassword')}
                  hinText={I18n.t('v2.password.mustBeAtLeast8Chars')}
                  inputWrapperConfig={{
                    style: {
                      minHeight: pixelByHeight(66)
                    }
                  }}
                />
              </View>

              <InputCustom
                value={confirmPassword}
                onChangeText={onChangeText('confirmPassword')}
                typeInput='password'
                leftIcon={images.UIV2.icons.password}
                leftIconConfig={{ iconWrapperStyle: styles.leftIconWrapper }}
                placeholder={I18n.t('v2.password.confirmPassword')}
                isError
                errMessage={isPassNotMatch ? I18n.t('v2.password.passwordsNotMatch') : undefined}
                inputWrapperConfig={{
                  style: {
                    minHeight: pixelByHeight(66)
                  }
                }}
              />

              {/* Only offered when the device can actually authenticate — a device
                  with no biometry enrolled and no passcode gets no row at all. */}
              {isBiometricAvailable && (
                <MyInput
                  readOnly
                  value={getDeviceAuthLabel(biometryType)}
                  leftIcon={isFaceBiometryType(biometryType) ? images.UIV2.icons.faceID : images.UIV2.security.deviceAuthen}
                  leftIconConfig={{ iconWrapperStyle: styles.leftIconWrapper }}
                  rightIcon={(
                    <MySwitch value={isFaceIdOn} onValueChange={onToggleFaceId} />
                  )}
                />
              )}
            </View>

            <View style={styles.agreeRow}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => onToggleAgree(!isAgree)} style={styles.leftIconWrapper}>
                <Checkbox isCheck={isAgree} onChange={onToggleAgree} />
              </TouchableOpacity>
              <MyText style={styles.agreeText}>
                {I18n.t('v2.password.forgetPasswordWarning')}
              </MyText>
            </View>
          </View>
        </MyViewPage>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

export default SetPasswordPage
