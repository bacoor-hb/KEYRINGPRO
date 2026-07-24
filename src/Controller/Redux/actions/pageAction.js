import { KEY_PAGE } from '../lib/constants'

export default class PageReduxAction {
  static setInternet (payload) {
    return {
      type: KEY_PAGE.SET_INTERNET,
      payload
    }
  }

  // Per-address token loading map: { [lowercasedAddress]: activeRefreshCount }.
  // In-memory only (not persisted) — a refresh interrupted by an app restart
  // must not leave an account stuck showing the loading state.
  static setTokenLoading (payload) {
    return {
      type: KEY_PAGE.TOKEN_LOADING,
      payload
    }
  }
}
