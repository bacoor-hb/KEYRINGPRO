import React from 'react'
import I18n from 'assets/Lang'
import { AppState } from 'react-native'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { NavigationActions } from 'src/navigation/NavigationService'
import { savePasswordWithBiometric, clearBiometricPassword, getDeviceAuthInfo } from 'common/keychain'
import { setPasswordFirstTime } from 'common/secureVault'
import MyButton from 'frontend/Components/UI/MyButton'

class SetPasswordScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      newPassword: '',
      confirmPassword: '',
      isPassNotMatch: false,
      // Device auth defaults OFF until we know the device can actually do it —
      // the row only renders (and the toggle only turns itself on) when available.
      isFaceIdOn: false,
      biometryType: null,
      isBiometricAvailable: false,
      isAgree: false,
      isLoading: false
    }
  }

  componentDidMount () {
    super.componentDidMount && super.componentDidMount()
    this.checkDeviceAuth()
    // The user may enroll Face ID / a fingerprint in the system settings and come
    // back — re-check on foreground so the row appears without an app restart.
    this.appStateSubscription = AppState.addEventListener('change', this.onAppStateChange)
  }

  componentWillUnmount () {
    super.componentWillUnmount && super.componentWillUnmount()
    this.isUnmounted = true
    this.appStateSubscription && this.appStateSubscription.remove()
  }

  onAppStateChange = (appState) => {
    // Skip while submitting: iOS goes 'inactive' → 'active' around the Face ID
    // prompt fired by savePasswordWithBiometric, and re-checking there would race
    // with the toggle value that submit already resolved.
    if (appState === 'active' && !this.state.isLoading) this.checkDeviceAuth()
  }

  // Show the device-auth row only on devices that can authenticate, labelled with
  // the biometry the device actually has (Face ID / Touch ID / fingerprint / …).
  checkDeviceAuth = async () => {
    const { biometryType, isAvailable } = await getDeviceAuthInfo()
    if (this.isUnmounted) return
    this.setState((prevState) => ({
      biometryType,
      isBiometricAvailable: isAvailable,
      // Default ON when available. Keep the user's own choice once they touched
      // the toggle, and never leave it ON when the device can't authenticate.
      isFaceIdOn: isAvailable ? (this.hasTouchedFaceIdToggle ? prevState.isFaceIdOn : true) : false
    }))
  }

  onBackRoute = () => {
    const { onBackRoute } = this.props.route?.params || {}
    if (onBackRoute) {
      onBackRoute()
    } else {
      NavigationActions.goBack()
    }
  }

  onChangeText = (name) => (value) => {
    this.setState({ [name]: value }, () => {
      const { confirmPassword, newPassword } = this.state
      this.setState({ isPassNotMatch: confirmPassword.length > 0 && newPassword !== confirmPassword })
    })
  }

  onToggleFaceId = (value) => {
    this.hasTouchedFaceIdToggle = true
    this.setState({ isFaceIdOn: value })
  }

  onToggleAgree = (value) => {
    this.setState({ isAgree: value })
  }

  isFormInvalid = () => {
    const { newPassword, confirmPassword, isPassNotMatch, isAgree } = this.state
    return (
      isPassNotMatch ||
      !isAgree ||
      newPassword.length < 8 ||
      confirmPassword.length < 8 ||
      newPassword !== confirmPassword
    )
  }

  onSetPassword = async () => {
    try {
      const { confirmPassword, isBiometricAvailable } = this.state
      const { onSuccess } = this.props.route?.params || {}
      // Never try to save a biometric copy on a device that can't authenticate,
      // even if the toggle was left on from an earlier state.
      let isFaceIdOn = this.state.isFaceIdOn && isBiometricAvailable

      this.setState({ isLoading: true })

      const vaultOk = await setPasswordFirstTime(confirmPassword)
      if (!vaultOk) {
        this.setState({ isLoading: false })
        this.showAlert(null, '', { type: true })
        return
      }

      // New vault identity → drop any orphaned biometric copy (prior wallet, or
      // one that survived an iOS reinstall) before optionally saving a fresh one
      // keyed to this password. Without this, a stale entry makes cold-start
      // auto-auth fail with a misleading "Incorrect password".
      await clearBiometricPassword()

      if (isFaceIdOn) {
        const ok = await savePasswordWithBiometric(confirmPassword)
        if (!ok) {
          // Cancelled or failed biometry prompt. The vault password is already set,
          // so stopping here would dead-end the flow — continue without device auth
          // instead; the user can turn it on later in Security. No toast: onSuccess
          // navigates away immediately and the toast lives inside this screen.
          isFaceIdOn = false
          this.setState({ isFaceIdOn: false })
        }
      }

      this.setState({ isLoading: false })

      if (onSuccess) {
        onSuccess(confirmPassword, isFaceIdOn)
      } else {
        NavigationActions.goBack()
      }
    } catch (error) {
      this.setState({ isLoading: false })
      this.showAlert(null, '', { type: true })
    }
  }

  render () {
    const Template = this.view
    return (
      <ThemeContext.Consumer>{() => {
        return (
          <Template
            headerBlur
            leftAction={this.onBackRoute}
            noFooter
            rightView={(
              <MyButton
                isUseHeader
                isLoading={this.state.isLoading}
                isDisable={this.isFormInvalid()}
                onPress={this.onSetPassword}
                size='small'
                label={I18n.t('v2.password.setPassword')}
              />
            )}
            func={this}
            props={this.props}
            state={this.state}
          />
        )
      }}
      </ThemeContext.Consumer>
    )
  }
}

export default SetPasswordScreen
