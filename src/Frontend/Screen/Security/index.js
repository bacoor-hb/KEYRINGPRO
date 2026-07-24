import BaseContainer from 'frontend/Container/BaseContainer'
import I18n from 'assets/Lang'
import React from 'react'
import Page from './page'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import PasswordModal from './Compoent/PasswordModal'
import { submitPassword, changePassword, setPasswordFirstTime, hasPassword } from 'common/secureVault'
import {
  hasBiometricPassword,
  savePasswordWithBiometric,
  clearBiometricPassword,
  checkCanImplyAuthentication,
  getBiometricPassword
} from 'common/keychain'
import StorageReduxAction from 'controller/Redux/actions/storageAction'

class SecurityScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page

    this.state = {
      // Whether a vault password already exists. Synchronous read so the first
      // render shows the right layout (Set password vs the full settings list).
      // false on upgrade from an old build that never set a passcode.
      isPasswordSet: hasPassword(),
      isOldVerified: false,
      passwordOld: '',
      passwordOldError: '',
      passwordNew: '',
      passwordNewConfirm: '',
      isTurnFaceId: false,
      isAgree: false,
      isBiometricAvailable: false,
      // When true, PasswordModal acts as a single-step "enter current password"
      // prompt — used when enabling biometric auth (need plaintext pw).
      biometricEnableMode: false,
      // When true, PasswordModal runs as a first-time "Set password" flow:
      // skips the old-password step and calls setPasswordFirstTime.
      setPasswordMode: false
    }
  }

  componentDidMount () {
    super.componentDidMount && super.componentDidMount()
    this.initBiometricState()
  }

  initBiometricState = async () => {
    const [canBiometric, biometricOn] = await Promise.all([
      checkCanImplyAuthentication(),
      hasBiometricPassword()
    ])
    this.setState({
      isBiometricAvailable: !!canBiometric,
      isTurnFaceId: !!biometricOn
    })
  }

  resetChangePasswordState = () => {
    this.setState({
      isOldVerified: false,
      passwordOld: '',
      passwordOldError: '',
      passwordNew: '',
      passwordNewConfirm: '',
      isAgree: false,
      biometricEnableMode: false,
      setPasswordMode: false
    })
  }

  // The drawer captures its children, so on every state change we re-push the
  // rebuilt PasswordModal with the merged snapshot (kept here so the next open /
  // refresh renders fresh state — controlled inputs would otherwise go stale).
  setModalState = (patch) => {
    this._passwordDrawerState = { ...this.state, ...patch }
    if (this._passwordDrawerOpen) this.showPasswordDrawer()
    this.setState(patch)
  }

  // Open / refresh the change-password drawer. Anchored to the default drawer
  // height (this.openDrawer) — content-fit mis-sized the form. Replaces the legacy
  // this.popup + openModal: new bottom sheets use the drawer.
  showPasswordDrawer = () => {
    // Stable remount key for the whole open session: re-pushing on every keystroke
    // (to refresh the controlled inputs) must NOT remount the drawer content, or the
    // password TextInput loses focus after one character. Regenerated on next open
    // (cleared in handlePasswordDrawerClose) so a fresh session mounts cleanly.
    if (!this._passwordDrawerId) this._passwordDrawerId = `pw-drawer-${Date.now()}`
    this.openDrawer({
      keyChildren: this._passwordDrawerId,
      onClose: this.handlePasswordDrawerClose,
      children: <PasswordModal func={this} state={this._passwordDrawerState || this.state} />
    })
  }

  // Runs the pending onPopupClosed once when the drawer closes (pan-down or
  // programmatic), mirroring the old modal's onClosed behaviour.
  handlePasswordDrawerClose = () => {
    if (!this._passwordDrawerOpen) return
    this._passwordDrawerOpen = false
    this._passwordDrawerId = null
    const onClosed = this.onPopupClosed
    this.onPopupClosed = null
    onClosed && onClosed()
  }

  openChangePasswordModal = () => {
    this.onPopupClosed = this.resetChangePasswordState
    this._passwordDrawerOpen = true
    this.showPasswordDrawer()
  }

  handleMenuChangePassword = async () => {
    const biometricOn = await hasBiometricPassword()

    // If biometric is enabled, try Face ID / Touch ID first so the user can
    // skip the manual "enter current password" step. On cancel/failure, fall
    // back to the password input form.
    let preVerifiedPassword = ''
    if (biometricOn) {
      const pw = await getBiometricPassword()
      if (pw && await submitPassword(pw)) {
        preVerifiedPassword = pw
      }
    }

    // Single setModalState — popup JSX built with this full snapshot, so the
    // first render after open shows the correct step (new-password view when
    // biometric pre-verified, old-password view otherwise).
    this.setModalState({
      passwordOldError: '',
      passwordNew: '',
      passwordNewConfirm: '',
      isAgree: false,
      biometricEnableMode: false,
      isTurnFaceId: !!biometricOn,
      isOldVerified: !!preVerifiedPassword,
      passwordOld: preVerifiedPassword
    })
    this.openChangePasswordModal()
  }

  // First-time "Set password" flow (no vault password yet, e.g. after upgrade).
  // Reuses the change-password drawer but jumps straight to the new-password
  // step (isOldVerified: true) since there is no current password to verify.
  handleMenuSetPassword = () => {
    this.setModalState({
      setPasswordMode: true,
      isOldVerified: true,
      passwordOld: '',
      passwordOldError: '',
      passwordNew: '',
      passwordNewConfirm: '',
      isAgree: false,
      // Default device auth ON when the device supports biometric (the toggle only
      // renders in that case). User can turn it off before saving if they prefer.
      isTurnFaceId: !!this.state.isBiometricAvailable,
      biometricEnableMode: false
    })
    this.openChangePasswordModal()
  }

  handleEnterPasswordOld = (text) => {
    this.setModalState({ passwordOld: text, passwordOldError: '' })
  }

  handleVerifyOldPassword = async () => {
    const ok = await submitPassword(this.state.passwordOld)
    if (!ok) {
      this.setModalState({ passwordOldError: I18n.t('v2.password.incorrectPassword') })
      return
    }
    if (this.state.biometricEnableMode) {
      const pw = this.state.passwordOld
      this.onPopupClosed = () => {
        this.resetChangePasswordState()
        if (this.biometricPasswordResolver) {
          this.biometricPasswordResolver(pw)
          this.biometricPasswordResolver = null
        }
      }
      this.closeDrawer()
      return
    }
    this.setModalState({ isOldVerified: true, passwordOldError: '' })
  }

  handleEnterPasswordNew = (text) => {
    this.setModalState({ passwordNew: text })
  }

  handleEnterPasswordNewConfirm = (text) => {
    this.setModalState({ passwordNewConfirm: text })
  }

  handleToggleFaceId = (value) => {
    this.setModalState({ isTurnFaceId: !!value })
  }

  handleAgree = (value) => {
    this.setModalState({ isAgree: !!value })
  }

  handleChangePassword = async () => {
    const { passwordOld, passwordNew, passwordNewConfirm, isAgree, isTurnFaceId, setPasswordMode } = this.state
    if (passwordNew.length < 8 || passwordNew !== passwordNewConfirm || !isAgree) return

    const ok = setPasswordMode
      ? await setPasswordFirstTime(passwordNew)
      : await changePassword(passwordOld, passwordNew)
    if (!ok) {
      this.showAlert(
        setPasswordMode ? I18n.t('v2.password.failedSetPassword') : I18n.t('v2.password.failedChangePassword'),
        '',
        { type: true }
      )
      return
    }

    // Sync biometric copy with the new password. On first-time set, drop any
    // stale keychain entry first (new vault ⇒ old biometric pw is invalid).
    if (setPasswordMode) {
      await clearBiometricPassword()
      if (isTurnFaceId) await savePasswordWithBiometric(passwordNew)
    } else {
      const hadBiometric = await hasBiometricPassword()
      if (isTurnFaceId) {
        await savePasswordWithBiometric(passwordNew)
      } else if (hadBiometric) {
        await clearBiometricPassword()
      }
    }

    this.onPopupClosed = () => {
      this.resetChangePasswordState()
      if (setPasswordMode) this.setState({ isPasswordSet: true })
      this.showAlert(setPasswordMode ? I18n.t('v2.password.passwordHasBeenSet') : I18n.t('v2.password.passwordChanged'))
    }
    this.closeDrawer()
  }

  handleAutoLock = (value) => {
    const { setAutoLockMinutes } = this.props
    setAutoLockMinutes && setAutoLockMinutes(value)
  }

  handleToggleDeviceAuth = async (value) => {
    if (value) {
      const password = await this.promptPasswordForBiometric()
      if (!password) return false
      const saved = await savePasswordWithBiometric(password)
      if (!saved) {
        this.showAlert(I18n.t('v2.security.couldNotEnableDeviceAuth'), '', { type: true })
        return false
      }
      return true
    }
    // Disable: try biometric (Face ID / passcode) first — it's the authentication
    // method the user already uses for this feature. Fall back to password if
    // biometric fails or is unavailable. Either path leaves the vault password intact.
    const pwFromBiometric = await getBiometricPassword()
    if (pwFromBiometric) {
      await clearBiometricPassword()
      this.showAlert(I18n.t('v2.security.deviceAuthOff'))
      return true
    }
    const password = await this.promptPasswordForBiometric()
    if (!password) return false
    await clearBiometricPassword()
    this.showAlert(I18n.t('v2.security.deviceAuthOff'))
    return true
  }

  promptPasswordForBiometric = () => {
    return new Promise((resolve) => {
      this.biometricPasswordResolver = resolve
      this.setModalState({
        isOldVerified: false,
        passwordOld: '',
        passwordOldError: '',
        biometricEnableMode: true
      })
      this.onPopupClosed = () => {
        this.resetChangePasswordState()
        if (this.biometricPasswordResolver) {
          this.biometricPasswordResolver('')
          this.biometricPasswordResolver = null
        }
      }
      this._passwordDrawerOpen = true
      this.showPasswordDrawer()
    })
  }

  render () {
    const Template = this.view
    return (
      <Template
        scrollPage
        headerBlur
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
      />
    )
  }
}

const mapDispatchToProps = (dispatch) => ({
  setAutoLockMinutes: bindActionCreators(StorageReduxAction.setAutoLockMinutes, dispatch)
})

const mapStateToProps = (state) => ({
  autoLockMinutesRedux: state.autoLockMinutesRedux
})

export default connect(mapStateToProps, mapDispatchToProps)(SecurityScreen)
