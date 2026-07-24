import Config from 'react-native-config'
import { MMKV } from 'react-native-mmkv'

export const storeDataToSyncStorage = async (key, value) => {
  try {
    const syncStorage = new MMKV({
      id: Config.SYNC_STORAGE_ID
    })
    syncStorage.set(key, JSON.stringify(value))
  } catch (e) {
    // saving error
  }
}

export const getDataFromSyncStorage = async (key, defaultData = null) => {
  try {
    const syncStorage = new MMKV({
      id: Config.SYNC_STORAGE_ID
    })
    const jsonValue = syncStorage.getString(key)
    return JSON.parse(jsonValue)
  } catch (e) {
    // error reading value
    return defaultData
  }
}
