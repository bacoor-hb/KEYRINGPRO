import { applyMiddleware, createStore, compose } from 'redux'
import thunkMiddleware from 'redux-thunk'

// Root action reducer
import rootReducer from '../reducers'

const middleWare = [thunkMiddleware]
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

// Reactotron is a DEV tool and must never reach a release build.
//
// It used to be imported and enhanced unconditionally, which shipped two real
// problems to production: its enhancer wraps `dispatch` and calls
// `send()` on EVERY action, and `send()` serializes the payload BEFORE checking
// whether anything is connected — then pushes the string onto a queue that is
// never drained when there is no Reactotron listening.
//
// For most actions that is invisible. For SET_ACCOUNT_TOKEN_LIST it is not: the
// payload is the whole cross-account token map, so every per-chain balance
// commit serialized thousands of token objects on the JS thread (measured at
// ~680ms per commit, regardless of how many tokens that chain contributed) and
// leaked the result. That single cost was the bulk of the home-screen balance
// sweep.
//
// `require` inside the guard, not a top-level import: ReactotronConfig connects
// as a module side effect, so importing it at all is enough to pay for it.
const enhancers = [applyMiddleware(...middleWare)]
if (__DEV__) {
  const Reactotron = require('../../../../ReactotronConfig').default
  enhancers.push(Reactotron.createEnhancer())
}

const store = createStore(rootReducer, composeEnhancers(...enhancers))

export default store
