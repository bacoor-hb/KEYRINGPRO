import { AppState } from 'react-native'
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

// -- coalesced (debounced) AsyncStorage writes --
// A few redux keys are rewritten many times in a row: the account token list is
// committed once per chain per account during a balance refresh, and EVERY write
// serializes the whole cross-account map on the JS thread. Persisting each
// intermediate value costs a lot and buys nothing — only the last one survives.
// These writes are coalesced per key and flushed on a trailing timer, plus
// whenever the app leaves the foreground so nothing in flight is lost.
//
// Redux itself is still updated synchronously by the action creator; only the
// on-disk copy lags, and it is a cache that is refetched when missing.
const DEBOUNCED_WRITE_DELAY_MS = 1000
const pendingWrites = new Map()

export const saveDataToAsyncStorageDebounced = (data, KEYSTOREDATA, wait = DEBOUNCED_WRITE_DELAY_MS) => {
  const pending = pendingWrites.get(KEYSTOREDATA)
  if (pending) clearTimeout(pending.timer)

  const timer = setTimeout(() => {
    const latest = pendingWrites.get(KEYSTOREDATA)
    pendingWrites.delete(KEYSTOREDATA)
    if (latest) saveDataToAsyncStorage(latest.data, KEYSTOREDATA)
  }, wait)

  pendingWrites.set(KEYSTOREDATA, { data, timer })
}

// Write every coalesced value NOW. Called before the app can be killed
// (background) and by flows that must not leave a stale snapshot behind — a
// wallet reset followed by a restart would otherwise never persist the cleared
// value. Awaitable so those flows can be sure the write landed.
export const flushPendingAsyncStorageWrites = () => {
  const writes = []
  pendingWrites.forEach(({ data, timer }, key) => {
    clearTimeout(timer)
    writes.push(saveDataToAsyncStorage(data, key))
  })
  pendingWrites.clear()
  return Promise.all(writes)
}

let flushSubscription = null

// Registered once at app start (App.js). Any non-active state counts — the app
// can be killed from the background without coming back.
export const initPendingWritesFlush = () => {
  if (flushSubscription) return
  flushSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') flushPendingAsyncStorageWrites()
  })
}
