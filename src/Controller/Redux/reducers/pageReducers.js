import createReducer from '../lib/reducerConfig'
import { KEY_PAGE } from '../lib/constants'
import init from '../lib/initState'

export const internetData = createReducer(init.internetInit, {
  [KEY_PAGE.SET_INTERNET] (state, action) {
    return action.payload
  }
})

// Per-address token loading map: { [lowercasedAddress]: activeRefreshCount }.
// Consumed by the home account list to show a loading icon per account while its
// tokens refresh (`!!count` → loading). Ref-counted so overlapping refreshes for
// the same address don't clear the icon early.
export const tokenLoadingRedux = createReducer(init.objInit, {
  [KEY_PAGE.TOKEN_LOADING] (state, action) {
    return action.payload
  }
})
