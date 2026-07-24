import * as Keychain from 'react-native-keychain'
import Config from 'react-native-config'
import I18n from 'assets/Lang'
import Keys from 'react-native-keys'
import QuickCrypto from 'react-native-quick-crypto'
import { Buffer } from 'buffer'
import { KEYSTORE } from 'common/constants/redux'
import { jsonStr2Obj } from './function'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { hasPassword as hasVaultPassword, wipeVault } from './secureVault'

const WRAP_CIPHER = 'aes-256-gcm'
const WRAP_IV_LENGTH = 12

// Keychain entry name + account slot for the biometric-protected user password.
const VAULT_USER_PASSWORD = 'VAULT_USER_PASSWORD'
const VAULT_USER_PASSWORD_ACCOUNT = 'VAULT_USER_PASSWORD'

const getWrapKey = () => {
  return Buffer.from(Keys.secureFor('KEYCHAIN_PASSWORD_ENCRYPTION_KEY'), 'base64')
}

/**
 * AES-256-GCM wrap a plaintext password before storing in OS keychain.
 * Defense-in-depth: a keychain dump alone is insufficient — attacker also
 * needs the build-time wrap key baked into the native binary.
 * @param {string} plainPassword
 * @returns {string} base64(iv || tag || ciphertext)
 */
const wrapPassword = (plainPassword) => {
  const iv = QuickCrypto.randomBytes(WRAP_IV_LENGTH)
  const cipher = QuickCrypto.createCipheriv(WRAP_CIPHER, getWrapKey(), iv)
  const ct = Buffer.concat([cipher.update(Buffer.from(plainPassword, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

/**
 * Reverse of wrapPassword. Throws on bad auth tag (tampering or wrong key).
 * @param {string} wrappedB64
 * @returns {string} plaintext password
 */
const unwrapPassword = (wrappedB64) => {
  const buf = Buffer.from(wrappedB64, 'base64')
  const iv = buf.subarray(0, WRAP_IV_LENGTH)
  const tag = buf.subarray(WRAP_IV_LENGTH, WRAP_IV_LENGTH + 16)
  const ct = buf.subarray(WRAP_IV_LENGTH + 16)
  const decipher = QuickCrypto.createDecipheriv(WRAP_CIPHER, getWrapKey(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(ct), decipher.final()])
  return dec.toString('utf8')
}

/**
 * Inquire if the type of local authentication policy is supported on this device with the device settings the user chose
 * [iOS only || true as default in Android]
 * @returns boolean
 */
export const checkCanImplyAuthentication = async () => {
  try {
    const canImplyAuthentication = ISIOS
      ? await Keychain.canImplyAuthentication({ authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS })
      : true
    return canImplyAuthentication
  } catch (error) {
    return false
  }
}

/**
 * Check data is already stored in secure store with key or not
 * @param {string} key
 * @returns boolean
 */
export const checkDataStoredInKeychainByKey = async (key) => {
  try {
    const checkAlreadyStored = await Keychain.hasInternetCredentials({
      server: key
    })
    return !!checkAlreadyStored
  } catch (error) {
    return false
  }
}

/**
 * Get data stored in secure storage by key
 * @param {string} key
 * @param {boolean} forceReturnValue custom force return in the case error
 * @returns object | false
 */
export const getDataStoredInKeychainByKey = async (key, forceReturnValue = false) => {
  try {
    const storedData = await Keychain.getInternetCredentials(key, {
      authenticationPrompt: {
        title: I18n.t('v2.common.authRequired')
      }
    })
    return storedData
  } catch (error) {
    return forceReturnValue
  }
}

/**
 * [iOS] need to reset keyring in the case re-install app
 * Issue: https://github.com/oblador/react-native-keychain/issues/135
 */
export const resetKeychainWhenAppFirstLaunch = async () => {
  try {
    if (ISIOS) {
      const isAppFirstLaunch = await AsyncStorage.getItem(KEYSTORE.IS_APP_FIRST_LAUNCH)

      // Is the first run app
      if (jsonStr2Obj(isAppFirstLaunch, null) !== false) {
        await Keychain.resetInternetCredentials({ server: Config.BIOMETRIC_KEY })
        await Keychain.resetInternetCredentials({ server: Config.PASSCODE_KEY })
        await Keychain.resetInternetCredentials({ server: VAULT_USER_PASSWORD })
        await AsyncStorage.setItem(KEYSTORE.IS_APP_FIRST_LAUNCH, JSON.stringify(false))
      }
    }
  } catch (error) {
    // error
  }
}

/**
 * Delete data stored in secure storage by key
 * @param {string} key
 * @returns boolean
 */
export const deleteDataStoredInKeychainByKey = async (key) => {
  try {
    const deleteStatus = await Keychain.resetInternetCredentials({ server: key })
    return deleteStatus
  } catch (error) {
    return false
  }
}

/**
 * Require passcode before doing a secure action
 * @param {function} callback
 * @param {object} extraOptions
 * Default options = {
      leftAction: null,
      screenTitle: I18n.t('SecurityScreen.enterPasscode'),
      enterPasscodeLabel: I18n.t('SecurityScreen.enterPasscode'),
      confirmPasscodeLabel: I18n.t('v2.common.enterPasscodeAgain')
    }
 */

/**
 * Save user password to keychain, protected by biometry (Face ID / Touch ID / fingerprint).
 * Falls back to device passcode if biometry fails.
 *
 * Flow: write → immediately read back to force a real biometry prompt → rollback on cancel/fail.
 * This guarantees the user has working biometry enrolled before we trust the saved entry.
 *
 * @param {string} password
 * @returns boolean true if saved AND biometry verified, false on any failure (entry is removed)
 */
export const hasBiometricPassword = async () => {
  try {
    return !!(await Keychain.hasInternetCredentials({ server: VAULT_USER_PASSWORD }))
  } catch (error) {
    return false
  }
}

/**
 * Legacy passcode (pre-v6) lives at Config.PASSCODE_KEY; its biometric copy at
 * Config.BIOMETRIC_KEY. Used on first launch of v6 to detect users who must go
 * through the security upgrade flow, and to clean up once upgrade succeeds.
 */
export const hasLegacyPasscode = async () => {
  try {
    return !!(await Keychain.hasInternetCredentials({ server: Config.PASSCODE_KEY }))
  } catch (error) {
    return false
  }
}

export const clearLegacyPasscode = async () => {
  await Keychain.resetInternetCredentials({ server: Config.PASSCODE_KEY }).catch(() => {})
  await Keychain.resetInternetCredentials({ server: Config.BIOMETRIC_KEY }).catch(() => {})
}

export const hasSavedPassword = async () => {
  return hasVaultPassword()
}

export const clearSavedPassword = async () => {
  await Keychain.resetInternetCredentials({ server: VAULT_USER_PASSWORD }).catch(() => {})
  wipeVault()
}

// Remove ONLY the biometric-protected password copy from the OS keychain.
// Leaves the vault (salt + verify + encrypted PKs) intact, so the user can
// still unlock with their password manually.
export const clearBiometricPassword = async () => {
  await Keychain.resetInternetCredentials({ server: VAULT_USER_PASSWORD }).catch(() => {})
}

export const savePasswordWithBiometric = async (password) => {
  try {
    const wrapped = wrapPassword(password)
    const saved = await Keychain.setInternetCredentials(
      VAULT_USER_PASSWORD,
      VAULT_USER_PASSWORD_ACCOUNT,
      wrapped,
      { accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE }
    )
    if (!saved) return false

    const verified = await Keychain.getInternetCredentials(VAULT_USER_PASSWORD, {
      authenticationPrompt: { title: I18n.t('SecurityScreen.enterPasscode') }
    })

    if (!verified || unwrapPassword(verified.password) !== password) {
      await Keychain.resetInternetCredentials({ server: VAULT_USER_PASSWORD })
      return false
    }

    return true
  } catch (error) {
    await Keychain.resetInternetCredentials({ server: VAULT_USER_PASSWORD }).catch(() => {})
    return false
  }
}

/**
 * Retrieve user password from keychain. Triggers a biometry / device passcode prompt.
 * @returns string password or '' if none / cancelled
 */
export const getBiometricPassword = async () => {
  try {
    const stored = await Keychain.getInternetCredentials(VAULT_USER_PASSWORD, {
      authenticationPrompt: { title: I18n.t('SecurityScreen.enterPasscode') }
    })
    if (!stored?.password) return ''
    return unwrapPassword(stored.password)
  } catch (error) {
    return ''
  }
}
