import { getCountry } from 'react-native-localize'
import storeRedux from 'controller/Redux/store/configureStore'
import StorageReduxAction from 'controller/Redux/actions/storageAction'

// Device region handling.
//
// The country is read from the device's region setting (react-native-localize's
// getCountry — no OS location permission needed, no GPS). It is used to localize
// content such as where-to-buy links. No user consent prompt is shown: reading
// the region setting does not require any permission.
//
// NOTE on travel: getCountry() reflects the device REGION setting, not GPS, so
// it does not change just because the user physically travels — only when they
// change that setting. To still pick up such changes we RE-READ it on every
// launch instead of caching it forever.

const readDeviceCountry = () => {
  try {
    return (getCountry() || '').toUpperCase()
  } catch (_e) {
    return ''
  }
}

const persistUserLocation = (payload) => {
  storeRedux.dispatch(StorageReduxAction.setUserLocation(payload))
}

// Entry point: run at app start. Reads the device region and keeps the stored
// country in sync on every launch, so a changed region setting is picked up
// automatically. Safe to call every launch. Returns a resolved promise; kept
// async for callers that await it before using the country.
export const maybeRequestUserLocation = async () => {
  try {
    const current = storeRedux.getState().userLocationRedux || {}
    const country = readDeviceCountry()
    if (country !== current.country) {
      persistUserLocation({ ...current, asked: true, granted: true, country })
    }
  } catch (_e) {
    // Never let onboarding fail app start.
  }
}
