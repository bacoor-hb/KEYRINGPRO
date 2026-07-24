import { getDataFromSecureStorage, storeDataToSecureStorage } from './storage/secureStorage'
import { KEYSTORE } from './constants/redux'

// Shared, app-wide lockout for password/passcode entry. After MAX_FAILED_ATTEMPTS
// consecutive wrong tries (counted across both the unlock password screen and the
// legacy passcode entry), the app is locked for LOCK_DURATION_MS. State is persisted
// in encrypted secure storage so the lock survives an app restart.
export const MAX_FAILED_ATTEMPTS = 5
export const LOCK_DURATION_MS = 60 * 60 * 1000 // 1 hour

const buildState = (failedAttempts, lockUntil) => {
  const now = Date.now()
  const isLocked = !!lockUntil && now < lockUntil
  return {
    isLocked,
    lockUntil: isLocked ? lockUntil : 0,
    remainingMs: isLocked ? lockUntil - now : 0,
    failedAttempts,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts)
  }
}

// Reads the current lock state. Self-heals an expired lock by clearing the
// persisted counters so the user gets a fresh set of attempts.
export const getLockState = () => {
  const failedAttempts = getDataFromSecureStorage(KEYSTORE.LOCKOUT_FAILED_ATTEMPTS, 0) || 0
  const lockUntil = getDataFromSecureStorage(KEYSTORE.LOCKOUT_UNTIL, 0) || 0

  if (lockUntil && Date.now() >= lockUntil) {
    resetLockout()
    return buildState(0, 0)
  }
  return buildState(failedAttempts, lockUntil)
}

export const isLockedNow = () => getLockState().isLocked

// Records one failed attempt and locks the app once the limit is reached.
// Returns the resulting lock state (incl. attemptsLeft / isLocked).
export const registerFailedAttempt = () => {
  const current = getLockState()
  if (current.isLocked) return current

  const failedAttempts = current.failedAttempts + 1
  storeDataToSecureStorage(KEYSTORE.LOCKOUT_FAILED_ATTEMPTS, failedAttempts)

  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockUntil = Date.now() + LOCK_DURATION_MS
    storeDataToSecureStorage(KEYSTORE.LOCKOUT_UNTIL, lockUntil)
    return buildState(failedAttempts, lockUntil)
  }
  return buildState(failedAttempts, 0)
}

// Clears all lockout state. Call after any successful unlock.
export const resetLockout = () => {
  storeDataToSecureStorage(KEYSTORE.LOCKOUT_FAILED_ATTEMPTS, 0)
  storeDataToSecureStorage(KEYSTORE.LOCKOUT_UNTIL, 0)
}
