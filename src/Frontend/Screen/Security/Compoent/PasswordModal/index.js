import { TouchableOpacity, View } from 'react-native'
import I18n from 'assets/Lang'
import React from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyInput from 'frontend/Components/UI/MyInput'
import images from 'assets/Image'
import createStyles from './styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { pixelByHeight, pixelByWidth } from 'common/styles'
import MySwitch from 'frontend/Components/UI/MySwitch'
import Checkbox from 'frontend/Components/Common/Checkbox'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import InputCustom from 'frontend/Components/UI/InputCustom'

const ChangePassword = (_this) => {
  const { func, state } = _this
  const {
    handleEnterPasswordOld,
    handleVerifyOldPassword,
    handleEnterPasswordNew,
    handleEnterPasswordNewConfirm,
    handleToggleFaceId,
    handleAgree,
    handleChangePassword
  } = func
  const {
    isOldVerified,
    passwordOld = '',
    passwordOldError,
    passwordNew = '',
    passwordNewConfirm = '',
    isTurnFaceId,
    isAgree,
    isBiometricAvailable,
    biometricEnableMode,
    setPasswordMode
  } = state

  const styles = createStyles()
  const isErrorConfirm = !!passwordNewConfirm && passwordNewConfirm !== passwordNew
  const isNewFormValid =
    passwordNew.length >= 8 &&
    passwordNew === passwordNewConfirm &&
    !!isAgree

  const renderOldPasswordStep = () => (
    <View style={styles.containerForm}>
      <MyInput
        placeholder={I18n.t('NFC.enterPass')}
        value={passwordOld}
        typeInput='password'
        onChangeText={handleEnterPasswordOld}
        isError={!!passwordOldError}
        errMessage={passwordOldError}
        leftIcon={(
          <View style={{ padding: pixelByWidth(8) }}>
            <MyIcon uri={images.UIV2.icons.password} />
          </View>
        )}
      />
    </View>
  )

  const renderNewPasswordStep = () => (
    <View style={styles.containerForm}>

      <InputCustom
        placeholder={setPasswordMode ? I18n.t('v2.password.setPassword') : I18n.t('v2.password.setNewPassword')}
        value={passwordNew}
        typeInput='password'
        onChangeText={handleEnterPasswordNew}
        hinText={I18n.t('v2.password.mustBeAtLeast8Chars')}
        leftIcon={images.UIV2.icons.password}
        inputWrapperConfig={{
          style: {
            minHeight: pixelByHeight(66)
          }
        }}
      />

      <InputCustom
        placeholder={I18n.t('v2.password.confirmNewPassword')}
        value={passwordNewConfirm}
        typeInput='password'
        onChangeText={handleEnterPasswordNewConfirm}
        isError
        errMessage={isErrorConfirm ? I18n.t('v2.password.passwordsNotMatch') : undefined}
        leftIcon={images.UIV2.icons.password}
        inputWrapperConfig={{
          style: {
            minHeight: pixelByHeight(66)
          }
        }}
      />
      {isBiometricAvailable && (
        <View style={[styles.containerItem]}>
          <View style={styles.containerLeftItem}>
            <MyIcon uri={images.UIV2.icons.faceID} />
          </View>
          <View style={styles.containerContentItem}>

            <MyText className='text-medium '>{I18n.t('v2.security.turnFaceId')}</MyText>
          </View>
          <View className='absolute right-0  h-full items-end justify-center '>
            <MySwitch value={!!isTurnFaceId} onValueChange={handleToggleFaceId} />
          </View>
        </View>

      )}

      <View style={[styles.containerItem, { alignItems: 'flex-start' }]}>
        <TouchableOpacity activeOpacity={1} onPress={() => handleAgree(!isAgree)} style={styles.containerLeftItem}>
          <Checkbox isCheck={!!isAgree} onChange={handleAgree} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <MyText className='text-medium relative z-10'>
            {I18n.t('v2.password.forgetPasswordWarning')}
          </MyText>
        </View>
      </View>
    </View>
  )

  // biometricEnableMode reuses this modal as a one-step "enter current password" prompt.
  const showNewStep = isOldVerified && !biometricEnableMode
  const isBtnChange = !!showNewStep && !!isNewFormValid
  const isBtnContinue = !showNewStep && !!passwordOld

  const handleClick = () => {
    if (isBtnChange) {
      handleChangePassword()
    }
    if (isBtnContinue) {
      handleVerifyOldPassword()
    }
  }

  return (
    <MyViewPage isUseDrawer style={[styles.container]}>
      <TitleDrawer
        absolute
        hasBlur
        title={biometricEnableMode ? I18n.t('NFC.enterPass') : setPasswordMode ? I18n.t('v2.password.setPassword') : showNewStep ? I18n.t('NFC.changePass') : I18n.t('NFC.enterPass')}
        leftIcon={images.UIV2.icons.enterPrivateKey}
        rightElement={(isBtnChange || isBtnContinue) ? (
          <MyButton
            variant='primary'
            size='small'
            label={isBtnChange ? (setPasswordMode ? I18n.t('Initial.save') : I18n.t('v2.common.change')) : I18n.t('NFC.continue')}
            onPress={handleClick}
          />
        ) : null}
      />
      <ScrollViewBlurHeader isUseDrawer>
        {showNewStep ? renderNewPasswordStep() : renderOldPasswordStep()}
      </ScrollViewBlurHeader>
    </MyViewPage>
  )
}

export default ChangePassword
