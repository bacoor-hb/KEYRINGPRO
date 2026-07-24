import { AppState } from 'react-native'
import storeRedux from 'controller/Redux/store/configureStore'
import { hasPassword, isUnlocked, clearVault, requestUnlock } from './secureVault'

let backgroundedAt = null
let appStateSubscription = null

// Only a real background counts as leaving the app. iOS also fires 'inactive'
// for transient interruptions that DON'T mean the user left — permission
// dialogs (camera/notifications during a WalletConnect scan), the app-switcher
// peek, an incoming call, the Face ID sheet. Treating those as "backgrounded"
// would lock the app on every system prompt when auto-lock is "immediately"
// (threshold 0). Locking on a genuine background ('background') still works,
// and ignoring 'inactive' also avoids the return path (background -> inactive
// -> active) resetting the backgrounded timestamp.
const isBackgroundState = (state) => state === 'background'

const checkAndLockIfNeeded = () => {
  if (backgroundedAt == null) return
  const enteredAt = backgroundedAt
  backgroundedAt = null

  if (!hasPassword() || !isUnlocked()) return

  const minutes = storeRedux.getState().autoLockMinutesRedux
  if (minutes === -1) return

  const elapsedMs = Date.now() - enteredAt
  const thresholdMs = Math.max(0, minutes) * 60 * 1000

  if (elapsedMs >= thresholdMs) {
    clearVault()
    requestUnlock()
  }
}

const handleAppStateChange = (nextState) => {
  if (isBackgroundState(nextState)) {
    backgroundedAt = Date.now()
    return
  }
  if (nextState === 'active') {
    checkAndLockIfNeeded()
  }
}

export const initAutoLock = () => {
  if (appStateSubscription) return
  appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
}

export const stopAutoLock = () => {
  if (!appStateSubscription) return
  appStateSubscription.remove()
  appStateSubscription = null
  backgroundedAt = null
}
