import React from 'react'
import I18n from 'assets/Lang'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { NavigationActions } from 'src/navigation/NavigationService'
import { savePasswordWithBiometric, clearBiometricPassword } from 'common/keychain'
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
      isFaceIdOn: true,
      isAgree: false,
      isLoading: false
    }
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
      const { confirmPassword, isFaceIdOn } = this.state
      const { onSuccess } = this.props.route?.params || {}

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
          this.setState({ isLoading: false })
          return
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
