import { applyMiddleware, createStore, compose } from 'redux'
import thunkMiddleware from 'redux-thunk'
import Reactotron from '../../../../ReactotronConfig'

// Root action reducer
import rootReducer from '../reducers'

const middleWare = [thunkMiddleware]
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

// eslint-disable-next-line no-undef
// if (__DEV__) {
//   const createDebugger = require('redux-flipper').default
//   middleWare.push(createDebugger())
// }

// const store = createStore(rootReducer, compose(applyMiddleware(...middleWare), Reactotron.createEnhancer()))
const store = createStore(rootReducer, composeEnhancers(applyMiddleware(...middleWare), Reactotron.createEnhancer()))

export default store
