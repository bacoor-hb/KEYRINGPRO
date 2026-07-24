import createReducer from '../lib/reducerConfig'
import init from '../lib/initState'
import I18n from 'react-native-i18n'
import { KEYSTORE, REDUX_KEY } from 'common/constants/redux'

export const stopAddingRequestRedux = createReducer(init.boolFalseInit, {
  [KEYSTORE.SET_STOP_ADDING_REQUEST] (state, action) {
    return action.payload
  }
})

export const gasPriceSlideValue = createReducer(init.gasPriceSlideValue, {
  [KEYSTORE.SET_GAS_PRICE_SLIDE_VALUE] (state, action) {
    return action.payload
  }
})

export const walletConnectRedux = createReducer(init.nullInit, {
  [KEYSTORE.SET_WALLET_CONNECT] (state, action) {
    return action.payload
  }
})

export const blockchainListRedux = createReducer(init.blockchainList, {
  [KEYSTORE.SET_BLOCKCHAIN_LIST] (state, action) {
    return action.payload
  }
})

export const accountListRedux = createReducer(init.arrInit, {
  [KEYSTORE.SET_ACCOUNT_LIST] (state, action) {
    return action.payload
  }
})
export const currentCallRequestRedux = createReducer(init.boolFalseInit, {
  [KEYSTORE.SET_CURRENT_CALL_REQUEST] (state, action) {
    return action.payload
  }
})

export const callRequestRedux = createReducer(init.arrInit, {
  [KEYSTORE.SET_CALL_REQUEST] (state, action) {
    return action.payload
  }
})

export const localeRedux = createReducer(init.localeInit, {
  [KEYSTORE.SET_LOCALE] (state, action) {
    I18n.locale = action.payload
    return action.payload
  }
})

export const settingsRedux = createReducer(init.nullInit, {
  [KEYSTORE.SET_SETTINGS] (state, action) {
    return action.payload
  }
})

export const addressBookHistory = createReducer(init.arrInit, {
  [KEYSTORE.ADDRESS_BOOK_HISTORY] (state, action) {
    return action.payload
  }
})

export const addressBookInfo = createReducer(init.objInit, {
  [KEYSTORE.ADDRESS_BOOK_INFO] (state, action) {
    return action.payload
  }
})

export const currencyRedux = createReducer(init.currencyInit, {
  [KEYSTORE.SET_CURRENCY] (state, action) {
    return action.payload
  }
})

export const fiatRateRedux = createReducer(init.fiatRate, {
  [KEYSTORE.SET_FIAT_RATE] (state, action) {
    return action.payload
  }
})

export const canShowAppRating = createReducer(init.canShowAppRatingInit, {
  [KEYSTORE.SET_CAN_SHOW_APP_RATING] (state, action) {
    return action.payload
  }
})

export const userLocationRedux = createReducer(init.userLocationInit, {
  [KEYSTORE.SET_USER_LOCATION] (state, action) {
    return action.payload
  }
})

export const aiSearchHistoryRedux = createReducer(init.aiSearchHistory, {
  [KEYSTORE.AI_SEARCH_HISTORY] (state, action) {
    return action.payload
  }
})
export const addressRegisteredLiquidity = createReducer(init.addressRegisteredLiquidity, {
  [KEYSTORE.SET_ADDRESS_REGISTERED_LIQUIDITY] (state, action) {
    return action.payload
  }
})
export const addressDeletedLiquidity = createReducer(init.addressDeletedLiquidity, {
  [KEYSTORE.SET_ADDRESS_DELETED_LIQUIDITY] (state, action) {
    return action.payload
  }
})

export const migrationFlagsRedux = createReducer(init.migrationFlags, {
  [KEYSTORE.SET_MIGRATION_FLAGS] (state, action) {
    return action.payload
  }
})

export const activeEvmChainIdsRedux = createReducer(init.activeEvmChainIds, {
  [KEYSTORE.ACTIVE_EVM_CHAIN_IDS] (state, action) {
    return action.payload
  }
})

export const autoLockMinutesRedux = createReducer(init.autoLockMinutes, {
  [KEYSTORE.AUTO_LOCK_MINUTES] (state, action) {
    return action.payload
  }
})

export const accountTokenListRedux = createReducer(init.accountTokenList, {
  [KEYSTORE.SET_ACCOUNT_TOKEN_LIST] (state, action) {
    return action.payload
  }
})

export const activeAccount = createReducer(init.activeAccount, {
  [REDUX_KEY.activeAccount] (state, action) {
    return action.payload
  }
})

export const notificationListRedux = createReducer(init.arrInit, {
  [KEYSTORE.NOTIFICATION_LIST] (state, action) {
    return action.payload
  }
})

export const notificationReadIdsRedux = createReducer(init.arrInit, {
  [KEYSTORE.NOTIFICATION_READ_IDS] (state, action) {
    return action.payload
  }
})
