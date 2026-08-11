import React from 'react'
import { InteractionManager, Keyboard } from 'react-native'
import BaseContainer from 'frontend/Container/BaseContainer'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { getBiometricPassword, hasBiometricPassword, getBiometryType } from 'common/keychain'
import { submitPassword, resolveReauth } from 'common/secureVault'
import { flushPendingDeepLink } from 'common/deepLink'
import { flushLockedWcRequests } from 'common/walletConnectPending'
import { isLockedNow, registerFailedAttempt, resetLockout, getLockState } from 'common/lockout'
import Page from './page'

class UnlockScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      password: '',
      isLoading: false,
      isError: false,
      // Starts true so the very first frame is the spinner, not the password form:
      // whether biometric auto-auth will run is only known after an async keychain
      // read, and rendering the form first makes it flash on every app start.
      // Every path below that decides "no auto-auth" must clear it.
      isAutoAuthing: true,
      isFaceIdEnabled: false,
      // Only used to pick the right icon for the biometric shortcut.
      biometryType: null,
      isLocked: false,
      attemptsLeft: null
    }
  }

  isReauthMode = () => !!this.props.route?.params?.reauthMode

  componentWillUnmount () {
    if (this.lockTimer) clearTimeout(this.lockTimer)
    // If the user backs out of a re-auth flow without succeeding, signal cancel
    // so the awaiting caller can resume. afterUnlock() already resolved(true)
    // before goBack, so this is a no-op on success.
    if (this.isReauthMode()) {
      resolveReauth(false)
    }
  }

  // Show the full-screen lock overlay and auto-dismiss it once the lock expires.
  showLockOverlay = () => {
    Keyboard.dismiss()
    this.setState({ isLocked: true })
    const { remainingMs } = getLockState()
    if (this.lockTimer) clearTimeout(this.lockTimer)
    if (remainingMs > 0) {
      this.lockTimer = setTimeout(
        () => this.setState({ isLocked: false, isError: false, attemptsLeft: null }),
        remainingMs + 500
      )
    }
  }

  afterUnlock = () => {
    if (this.isReauthMode()) {
      resolveReauth(true)
      // Caller will navigate away itself (e.g. wallet reset). Skipping goBack
      // avoids briefly revealing the underlying screen before the caller's
      // navigation kicks in.
      if (this.props.route?.params?.keepOnSuccess) return
    }
    // In-app re-unlock (unlock pushed on top of a screen) → return to caller.
    // Cold launch (unlock is the root) → reset into the app.
    if (NavigationActions.canGoBack()) {
      NavigationActions.goBack()
    } else {
      NavigationActions.reset(NAME_SCREEN.home)
    }

    // Replay anything that was held back while locked, now that the unlock gate is
    // passed: a stashed deep link (App.navigate) and any incoming WalletConnect
    // requests that arrived while locked (WalletConnectRequestHost). Deferred so the
    // navigation above has settled and the UI lands on top of the app, not the
    // unlock root. Both are no-ops when nothing was stashed (normal unlock).
    InteractionManager.runAfterInteractions(() => {
      flushPendingDeepLink()
      flushLockedWcRequests()
    })
  }

  async componentDidMount () {
    // App locked → block everything (incl. biometric auto-auth) until it expires.
    // Clear the spinner too, or the form never comes back when the lock expires.
    if (isLockedNow()) {
      this.setState({ isAutoAuthing: false })
      this.showLockOverlay()
      return
    }
    try {
      const hasBio = await hasBiometricPassword()
      // No biometric copy → no auto-auth and no shortcut button: show the form.
      if (!hasBio) {
        this.setState({ isAutoAuthing: false })
        return
      }
      this.setState({ isFaceIdEnabled: true })
      // The kind only picks the shortcut's icon, and that icon is not on screen while
      // the spinner is up — so resolving it here costs nothing visually, while still
      // landing before the prompt below (never alongside it) and before any failure
      // path can reveal the button. One cheap, prompt-free native call; availability
      // is not needed since a stored copy already proves the device can authenticate.
      const biometryType = await getBiometryType()
      this.setState({ biometryType })
      const stored = await getBiometricPassword()
      if (stored) {
        const ok = await submitPassword(stored)
        if (ok) {
          resetLockout()
          this.afterUnlock()
        } else {
          this.setState({ isAutoAuthing: false, isError: true })
        }
      } else {
        this.setState({ isAutoAuthing: false })
      }
    } catch (error) {
      this.setState({ isAutoAuthing: false })
    }
  }

  onChangePassword = (value) => {
    this.setState({ password: value, isError: false })
  }

  onUnlock = async () => {
    const { password } = this.state
    if (!password) return
    if (isLockedNow()) {
      this.showLockOverlay()
      return
    }
    this.setState({ isLoading: true })
    const ok = await submitPassword(password)
    this.setState({ isLoading: false })
    if (ok) {
      resetLockout()
      this.afterUnlock()
    } else {
      const state = registerFailedAttempt()
      if (state.isLocked) {
        this.showLockOverlay()
      } else {
        this.setState({ isError: true, attemptsLeft: state.attemptsLeft })
      }
    }
  }

  onPressFaceId = async () => {
    if (isLockedNow()) {
      this.showLockOverlay()
      return
    }
    try {
      const stored = await getBiometricPassword()
      if (!stored) return
      const ok = await submitPassword(stored)
      if (ok) {
        resetLockout()
        this.afterUnlock()
      } else {
        this.setState({ isError: true })
      }
    } catch (error) {
      // user cancelled or biometry failed
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

export default UnlockScreen
