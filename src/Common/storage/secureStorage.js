import 'react-native-get-random-values'
import Config from 'react-native-config'
import { MMKV } from 'react-native-mmkv'
import * as keychainUtils from '../keychain'
import * as Keychain from 'react-native-keychain'
import Keys from 'react-native-keys'

let secureStorage

export const generateRandomEncryptionKey = (length = 16) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const charactersLength = characters.length

  // Kept at `length` ASCII chars (= `length` bytes) to fit MMKV's AES-128 key
  // cap of 16 bytes, while a 70-char alphabet packs ~98 bits into 16 chars.
  //
  // Uses cryptographically secure random values (crypto.getRandomValues) with
  // rejection sampling: a raw byte is 0-255, so `byte % 70` would make the first
  // 46 chars slightly more likely (256 % 70 = 46) — modulo bias. We discard any
  // byte >= 210 (the largest multiple of 70 under 256) so every char is uniform.
  const maxUnbiased = Math.floor(256 / charactersLength) * charactersLength

  let result = ''
  while (result.length < length) {
    const randomBytes = new Uint8Array(length)
    crypto.getRandomValues(randomBytes)
    for (let i = 0; i < randomBytes.length && result.length < length; i++) {
      if (randomBytes[i] < maxUnbiased) {
        result += characters.charAt(randomBytes[i] % charactersLength)
      }
    }
  }
  return result
}

export const getEncryptionKey = async () => {
  try {
    const encryptionKey = await keychainUtils.getDataStoredInKeychainByKey(Config.SECURE_STORAGE_ID)

    if (!encryptionKey) {
      const newEncryptionKey = generateRandomEncryptionKey()
      const saveEncryptionKey = await Keychain.setInternetCredentials(Config.SECURE_STORAGE_ID, Config.SECURE_STORAGE_KEYCHAIN_ALIAS, newEncryptionKey, {})
      if (saveEncryptionKey) {
        return newEncryptionKey
      } else {
        return Keys.secureFor('SECURE_STORAGE_DEFAULT_ENCRYPTION_KEY')
      }
    }
    return encryptionKey?.password || Keys.secureFor('SECURE_STORAGE_DEFAULT_ENCRYPTION_KEY')
  } catch (error) {
    return Keys.secureFor('SECURE_STORAGE_DEFAULT_ENCRYPTION_KEY')
  }
}

export const initSecureStorage = async () => {
  try {
    if (secureStorage) {
      return secureStorage
    }
    const encryptionKey = await getEncryptionKey()
    secureStorage = new MMKV({
      id: Config.SECURE_STORAGE_ID,
      encryptionKey
    })
    return secureStorage
  } catch (error) {
    return null
  }
}

export const clearSecureStorage = () => {
  try {
    if (secureStorage) {
      secureStorage.clearAll()
    }
  } catch (e) {
    // error clearing secure storage
  }
}

export const storeDataToSecureStorage = (key, value) => {
  try {
    if (!secureStorage) {
      return false
    }
    secureStorage.set(key, JSON.stringify(value))
    return true
  } catch (e) {
    return false
    // saving error
  }
}

export const getDataFromSecureStorage = (key, defaultData = null) => {
  try {
    if (!secureStorage) {
      return defaultData
    }
    const jsonValue = secureStorage.getString(key)
    if (!jsonValue) {
      return defaultData
    }
    return JSON.parse(jsonValue)
  } catch (e) {
    // error reading value
    return defaultData
  }
}

export const getDataByKeyStore = (keyStoreId) => {
  return Keys.secureFor(keyStoreId)
}
