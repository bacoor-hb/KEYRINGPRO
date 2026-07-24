import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { getDataFromSecureStorage } from 'common/storage/secureStorage'

export default function createReducer (initialState, handlers) {
  return function reducer (state = initialState, action) {
    if (Object.prototype.hasOwnProperty.call(handlers, action.type)) {
      return handlers[action.type](state, action)
    } else {
      return state
    }
  }
}

export const saveDataToAsyncStorage = async (data, KEYSTOREDATA) => {
  try {
    await storeDataToAsyncStorage(KEYSTOREDATA, data)
  } catch (error) {
    // error saving data
  }
}

export const mapSecureStorageToRedux = async (storeRedux, keyStoreNew, action, initData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const dataFromSecureStorage = getDataFromSecureStorage(keyStoreNew)
      if (dataFromSecureStorage !== null) {
        storeRedux.dispatch(action(dataFromSecureStorage))
      } else {
        storeRedux.dispatch(action(initData))
      }
      return resolve()
    } catch (error) {
      return resolve()
    }
  })
}

export const mapAsyncStorageToRedux = async (storeRedux, keyStoreNew, action, initData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const dataFromAsyncStorage = await getDataFromAsyncStorage(keyStoreNew)
      if (dataFromAsyncStorage !== null) {
        storeRedux.dispatch(action(dataFromAsyncStorage))
      } else {
        storeRedux.dispatch(action(initData))
      }
      return resolve()
    } catch (error) {
      return resolve()
    }
  })
}
