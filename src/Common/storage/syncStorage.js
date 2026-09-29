import Config from 'react-native-config'
import { MMKV } from 'react-native-mmkv'

// One instance for the whole app, created on first use.
//
// Every `new MMKV()` registers an AppState 'memoryWarning' listener, and the
// library can only release it through FinalizationRegistry — which Hermes does
// not implement, so it takes the "retains MMKV strong forever" branch instead.
// Constructing per call therefore leaked a listener on every read/write, and
// these helpers are called from module-scope style code on nearly every screen.
let syncStorage = null

const getSyncStorage = () => {
  if (!syncStorage) {
    syncStorage = new MMKV({
      id: Config.SYNC_STORAGE_ID
    })
  }
  return syncStorage
}

export const storeDataToSyncStorage = (key, value) => {
  try {
    getSyncStorage().set(key, JSON.stringify(value))
  } catch (e) {
    // saving error
  }
}

export const getDataFromSyncStorage = (key, defaultData = null) => {
  try {
    const jsonValue = getSyncStorage().getString(key)
    return JSON.parse(jsonValue)
  } catch (e) {
    // error reading value
    return defaultData
  }
}
