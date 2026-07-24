import * as storageReducers from './storageReducers'
import * as pageReducers from './pageReducers'

import { combineReducers } from 'redux'

const rootReducer = combineReducers({
  ...storageReducers,
  ...pageReducers
})

export default rootReducer
