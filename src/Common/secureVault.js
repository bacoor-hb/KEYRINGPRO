import { Buffer } from 'buffer'
import { getDataFromSecureStorage, storeDataToSecureStorage } from './storage/secureStorage'
import { KEYSTORE } from './constants/redux'
import { NAME_SCREEN } from './constants/navigation'
import { NavigationActions } from 'src/navigation/NavigationService'
import { randomBytes, derivePbkdf2, encryptAesGcm, decryptAesGcm, SALT_LENGTH } from './cryptoVault'

const VERIFY_PLAINTEXT = 'keyring-vault-verify-v1'
const ENTRY_VERSION = 1

// RAM-only. Never persisted.
let vaultEncryptionKey = null

const derive = (password, salt) => derivePbkdf2(password, salt)

const encryptWithKey = (plaintext, key) => {
  const { iv, tag, ciphertext } = encryptAesGcm(plaintext, key)
  return {
    v: ENTRY_VERSION,
    enc: true,
    cipher: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  }
}

const decryptWithKey = (entry, key) => {
  return decryptAesGcm({
    iv: Buffer.from(entry.iv, 'base64'),
    tag: Buffer.from(entry.tag, 'base64'),
    ciphertext: Buffer.from(entry.cipher, 'base64')
  }, key)
}

export const isEncryptedEntry = (entry) => {
  return entry !== null && typeof entry === 'object' && entry.enc === true
}

export const hasPassword = () => {
  const salt = getDataFromSecureStorage(KEYSTORE.VAULT_SALT, '')
  const verify = getDataFromSecureStorage(KEYSTORE.VAULT_VERIFY, null)
  return !!(salt && verify)
}

export const isUnlocked = () => !!vaultEncryptionKey

export const clearVault = () => {
  vaultEncryptionKey = null
}

// Full wipe for the reset/factory-reset flow: drop the RAM key and remove the
// vault marker entries. Does NOT touch LIST_PRIVATE_KEY_BY_ADDRESS — the caller
// is expected to nuke secure storage entirely right after.
export const wipeVault = () => {
  clearVault()
  storeDataToSecureStorage(KEYSTORE.VAULT_SALT, '')
  storeDataToSecureStorage(KEYSTORE.VAULT_VERIFY, null)
}

export const requestUnlock = () => {
  try {
    NavigationActions.navigate(NAME_SCREEN.unlock)
  } catch (error) {
    // ignore
  }
}

// One-shot resolver for the re-auth flow. The unlock screen calls
// resolveReauth(true|false) to settle the in-flight promise.
let reauthResolver = null

// Force a password re-prompt before a sensitive UI reveal (export PK/SRP, etc.)
// even when the vault is already unlocked. Returns true on verified, false on
// cancel. Resolves immediately when no vault password is set.
// Pass { keepOnSuccess: true } when the caller will navigate away itself
// (e.g. wallet reset) — UnlockScreen then skips goBack so the underlying
// screen never flashes before the caller's navigation runs.
export const requestReauth = (options = {}) => {
  if (!hasPassword()) return Promise.resolve(true)
  // Settle any stale resolver from a previously abandoned flow before starting.
  if (reauthResolver) {
    reauthResolver(false)
    reauthResolver = null
  }
  return new Promise((resolve) => {
    reauthResolver = resolve
    try {
      NavigationActions.navigate(NAME_SCREEN.unlock, {
        reauthMode: true,
        keepOnSuccess: !!options.keepOnSuccess
      })
    } catch (error) {
      reauthResolver = null
      resolve(false)
    }
  })
}

export const resolveReauth = (success) => {
  if (reauthResolver) {
    reauthResolver(!!success)
    reauthResolver = null
  }
}

// Walk LIST_PRIVATE_KEY_BY_ADDRESS, encrypt any plaintext entries with the cached key.
const migratePlaintextEntries = () => {
  try {
    const list = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})
    let changed = false
    for (const addr of Object.keys(list)) {
      const entry = list[addr]
      if (typeof entry === 'string' && entry) {
        list[addr] = encryptWithKey(entry, vaultEncryptionKey)
        changed = true
      }
    }
    if (changed) {
      storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, list)
    }
  } catch (error) {
    // best-effort
  }
}

// First-time password set: generate salt, derive key, persist VAULT_VERIFY, migrate plaintext PKs.
export const setPasswordFirstTime = async (password) => {
  if (!password) return false
  const salt = randomBytes(SALT_LENGTH)
  const key = await derive(password, salt)
  const verify = encryptWithKey(VERIFY_PLAINTEXT, key)

  storeDataToSecureStorage(KEYSTORE.VAULT_SALT, salt.toString('base64'))
  storeDataToSecureStorage(KEYSTORE.VAULT_VERIFY, verify)

  vaultEncryptionKey = key

  migratePlaintextEntries()
  return true
}

// Login: derive key, verify against VAULT_VERIFY blob, cache on success.
export const submitPassword = async (password) => {
  if (!password) return false
  const saltB64 = getDataFromSecureStorage(KEYSTORE.VAULT_SALT, '')
  const verify = getDataFromSecureStorage(KEYSTORE.VAULT_VERIFY, null)
  if (!saltB64 || !verify) return false

  const salt = Buffer.from(saltB64, 'base64')
  const key = await derive(password, salt)

  try {
    const dec = decryptWithKey(verify, key)
    if (dec !== VERIFY_PLAINTEXT) return false
  } catch (error) {
    return false
  }

  vaultEncryptionKey = key
  return true
}

// Disable password: decrypt all entries back to plaintext, clear salt/verify + RAM cache.
export const removePassword = async () => {
  if (!vaultEncryptionKey) return false
  try {
    const list = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})
    let changed = false
    for (const addr of Object.keys(list)) {
      const entry = list[addr]
      if (isEncryptedEntry(entry)) {
        list[addr] = decryptWithKey(entry, vaultEncryptionKey)
        changed = true
      }
    }
    if (changed) {
      storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, list)
    }
    storeDataToSecureStorage(KEYSTORE.VAULT_SALT, '')
    storeDataToSecureStorage(KEYSTORE.VAULT_VERIFY, null)
    clearVault()
    return true
  } catch (error) {
    return false
  }
}

// Re-key the vault: verify oldPassword, derive a new key from newPassword,
// re-encrypt every entry in LIST_PRIVATE_KEY_BY_ADDRESS, then rotate
// VAULT_SALT/VAULT_VERIFY and the cached in-memory key.
export const changePassword = async (oldPassword, newPassword) => {
  if (!oldPassword || !newPassword) return false
  const saltB64 = getDataFromSecureStorage(KEYSTORE.VAULT_SALT, '')
  const verify = getDataFromSecureStorage(KEYSTORE.VAULT_VERIFY, null)
  if (!saltB64 || !verify) return false

  const oldKey = await derive(oldPassword, Buffer.from(saltB64, 'base64'))
  try {
    if (decryptWithKey(verify, oldKey) !== VERIFY_PLAINTEXT) return false
  } catch (error) {
    return false
  }

  const newSalt = randomBytes(SALT_LENGTH)
  const newKey = await derive(newPassword, newSalt)

  try {
    const list = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})
    for (const addr of Object.keys(list)) {
      const entry = list[addr]
      if (isEncryptedEntry(entry)) {
        const plain = decryptWithKey(entry, oldKey)
        list[addr] = encryptWithKey(plain, newKey)
      } else if (typeof entry === 'string' && entry) {
        list[addr] = encryptWithKey(entry, newKey)
      }
    }
    storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, list)
  } catch (error) {
    return false
  }

  storeDataToSecureStorage(KEYSTORE.VAULT_SALT, newSalt.toString('base64'))
  storeDataToSecureStorage(KEYSTORE.VAULT_VERIFY, encryptWithKey(VERIFY_PLAINTEXT, newKey))
  vaultEncryptionKey = newKey
  return true
}

export const encryptPrivateKey = (plainPk) => {
  if (!vaultEncryptionKey) throw new Error('Vault is locked')
  return encryptWithKey(plainPk, vaultEncryptionKey)
}

export const decryptPrivateKey = (entry) => {
  if (!vaultEncryptionKey) throw new Error('Vault is locked')
  return decryptWithKey(entry, vaultEncryptionKey)
}
