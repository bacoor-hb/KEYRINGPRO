import React from 'react'
import Config from 'react-native-config'
import BaseContainer from 'frontend/Container/BaseContainer'
import { checkDataStoredInKeychainByKey, getDataStoredInKeychainByKey, savePasswordWithBiometric, clearBiometricPassword, clearLegacyPasscode } from 'common/keychain'
import { setPasswordFirstTime } from 'common/secureVault'
import { isLockedNow, registerFailedAttempt, resetLockout, getLockState } from 'common/lockout'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import ReduxService from 'common/redux'
import { pixelByHeight } from 'common/styles'
import Page from './page'
import EnterPasscodeModal from './components/EnterPasscodeModal'

class SecurityUpgradeScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = { isLocked: false }
  }

  componentDidMount () {
    if (isLockedNow()) this.showLockOverlay()
  }

  componentWillUnmount () {
    super.componentWillUnmount()
    if (this.lockTimer) clearTimeout(this.lockTimer)
  }

  // Show the full-screen lock overlay and auto-dismiss it once the lock expires.
  showLockOverlay = () => {
    this.setState({ isLocked: true })
    const { remainingMs } = getLockState()
    if (this.lockTimer) clearTimeout(this.lockTimer)
    if (remainingMs > 0) {
      this.lockTimer = setTimeout(() => this.setState({ isLocked: false }), remainingMs + 500)
    }
  }

  handleUsePasscode = async () => {
    if (isLockedNow()) {
      this.showLockOverlay()
      return
    }
    // If the legacy passcode flow has biometric enabled, prompt Face ID
    // first and read the stored passcode directly — same UX as legacy
    // PasscodeScreen authentication. Fall back to the manual-entry modal
    // when biometric is off or the prompt is cancelled.
    const hasBiometric = await checkDataStoredInKeychainByKey(Config.BIOMETRIC_KEY)
    if (hasBiometric) {
      const stored = await getDataStoredInKeychainByKey(Config.BIOMETRIC_KEY)
      if (stored && stored.password) {
        this.handlePasscodeVerified(stored.password)
        return
      }
    }
    this.openEnterPasscodeModal()
  }

  // Read the modal anchor height straight from the headerArea native view right
  // before opening the drawer. By tap time the view is laid out, so measure()
  // returns the real height even when the onLayout JS callback hasn't fired yet
  // (busy JS thread on a cold start) or the shared ref was reset by another
  // screen's BaseContainer constructor — which is what made the passcode modal
  // open full-height (anchored at safe-area top). Mirrors handleHeaderAnchorLayout:
  // measured height + the 42px offset. Falls through if the ref isn't available.
  measureHeaderAnchorThen = (next) => {
    const view = this.refHeaderAnchorView
    if (view && view.measure) {
      view.measure((x, y, w, h) => {
        if (h) {
          ReduxService.refLayoutHeaderAnchor.current = { height: h + pixelByHeight(42), width: w }
        }
        next()
      })
    } else {
      next()
    }
  }

  openEnterPasscodeModal = () => {
    this.measureHeaderAnchorThen(() => {
      this.openDrawer({
        children: (
          <EnterPasscodeModal
            onVerify={this.verifyPasscode}
            onVerified={this.handlePasscodeVerified}
            onLocked={this.showLockOverlay}
            closeModal={this.closeDrawer}
          />
        )
      })
    })
  }

  handleSetNewPassword = () => {
    NavigationActions.navigate(NAME_SCREEN.setPassword, {
      onSuccess: async () => {
        await clearLegacyPasscode()
        NavigationActions.reset(NAME_SCREEN.home)
      }
    })
  }

  verifyPasscode = async (passcode) => {
    try {
      const stored = await getDataStoredInKeychainByKey(Config.PASSCODE_KEY)
      const ok = !!stored && stored.password.toString() === passcode.toString()
      if (ok) return { ok: true }
      // Wrong passcode → count it toward the shared app-wide lockout.
      const state = registerFailedAttempt()
      return { ok: false, attemptsLeft: state.attemptsLeft, isLocked: state.isLocked }
    } catch (error) {
      // Keychain read error is not a wrong-passcode → don't penalise the user.
      return { ok: false }
    }
  }

  handlePasscodeVerified = async (passcode) => {
    try {
      const vaultOk = await setPasswordFirstTime(passcode)
      if (!vaultOk) {
        this.showAlert(null, '', { type: true })
        return
      }

      // Verified successfully → clear any accumulated failed-attempt count.
      resetLockout()

      // New vault identity → drop any orphaned VAULT_USER_PASSWORD copy before
      // optionally saving a fresh one. Legacy keychain entries are handled by
      // clearLegacyPasscode below.
      await clearBiometricPassword()

      // Mirror the legacy passcode's Face ID preference: if biometric was
      // enabled for the legacy passcode, also save the password as a
      // biometric-protected keychain entry as a UX shortcut.
      const hasBiometric = await checkDataStoredInKeychainByKey(Config.BIOMETRIC_KEY)
      if (hasBiometric) {
        const ok = await savePasswordWithBiometric(passcode)
        if (!ok) {
          this.showAlert(null, '', { type: true })
          return
        }
      }

      await clearLegacyPasscode()
      NavigationActions.reset(NAME_SCREEN.home)
    } catch (error) {
      this.showAlert(null, '', { type: true })
    }
  }

  render () {
    const Template = this.view
    return (
      <Template
        noFooter
        noHeader
        func={this}
        props={this.props}
        state={this.state}
      />
    )
  }
}

export default SecurityUpgradeScreen
