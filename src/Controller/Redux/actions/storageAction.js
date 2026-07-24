import { saveDataToAsyncStorage } from '../lib/reducerConfig'
import notifee from '@notifee/react-native'
import { KEYSTORE, REDUX_KEY } from 'common/constants/redux'
import { storeDataToSecureStorage } from 'common/storage/secureStorage'

export default class StorageReduxAction {
  static setStopAddingRequest (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_STOP_ADDING_REQUEST)
    return {
      type: KEYSTORE.SET_STOP_ADDING_REQUEST,
      payload
    }
  }

  static setGasPriceSlideValue (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_GAS_PRICE_SLIDE_VALUE)
    return {
      type: KEYSTORE.SET_GAS_PRICE_SLIDE_VALUE,
      payload
    }
  }

  static setBlockChainList (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_BLOCKCHAIN_LIST)
    return {
      type: KEYSTORE.SET_BLOCKCHAIN_LIST,
      payload
    }
  }

  static setActiveEvmChainIds (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.ACTIVE_EVM_CHAIN_IDS)
    return {
      type: KEYSTORE.ACTIVE_EVM_CHAIN_IDS,
      payload
    }
  }

  static setAutoLockMinutes (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.AUTO_LOCK_MINUTES)
    return {
      type: KEYSTORE.AUTO_LOCK_MINUTES,
      payload
    }
  }

  static setCurrentCallRequest (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_CURRENT_CALL_REQUEST)
    return {
      type: KEYSTORE.SET_CURRENT_CALL_REQUEST,
      payload
    }
  }

  static setCallRequest (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_CALL_REQUEST)
    notifee.setBadgeCount((payload || []).flat().length)
    return {
      type: KEYSTORE.SET_CALL_REQUEST,
      payload
    }
  }

  static setLanguage (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_LOCALE)
    return {
      type: KEYSTORE.SET_LOCALE,
      payload
    }
  }

  static setCurrency (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_CURRENCY)
    return {
      type: KEYSTORE.SET_CURRENCY,
      payload
    }
  }

  static setFiatRate (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_FIAT_RATE)
    return {
      type: KEYSTORE.SET_FIAT_RATE,
      payload
    }
  }

  static setAppSettings (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_SETTINGS)
    return {
      type: KEYSTORE.SET_SETTINGS,
      payload
    }
  }

  static setAddressBookHistory (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.ADDRESS_BOOK_HISTORY)
    return {
      type: KEYSTORE.ADDRESS_BOOK_HISTORY,
      payload
    }
  }

  static setAddressBookInfo (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.ADDRESS_BOOK_INFO)
    return {
      type: KEYSTORE.ADDRESS_BOOK_INFO,
      payload
    }
  }

  static setCanShowAppRating (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_CAN_SHOW_APP_RATING)
    return {
      type: KEYSTORE.SET_CAN_SHOW_APP_RATING,
      payload
    }
  }

  static setUserLocation (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_USER_LOCATION)
    return {
      type: KEYSTORE.SET_USER_LOCATION,
      payload
    }
  }

  static setMigrationFlags (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_MIGRATION_FLAGS)
    return {
      type: KEYSTORE.SET_MIGRATION_FLAGS,
      payload
    }
  }

  static setAiSearchHistory (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.AI_SEARCH_HISTORY)
    return {
      type: KEYSTORE.AI_SEARCH_HISTORY,
      payload
    }
  }

  static setAddressRegisteredLiquidity (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_ADDRESS_REGISTERED_LIQUIDITY)
    return {
      type: KEYSTORE.SET_ADDRESS_REGISTERED_LIQUIDITY,
      payload
    }
  }

  static setAddressDeletedLiquidity (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_ADDRESS_DELETED_LIQUIDITY)
    return {
      type: KEYSTORE.SET_ADDRESS_DELETED_LIQUIDITY,
      payload
    }
  }

  // <- Data stored ins Secure storage
  static setTokenJWT (payload) {
    storeDataToSecureStorage(KEYSTORE.TOKEN_JWT, payload)
    return {
      type: KEYSTORE.TOKEN_JWT,
      payload
    }
  }

  static setAccountList (payload) {
    storeDataToSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, payload)
    return {
      type: KEYSTORE.SET_ACCOUNT_LIST,
      payload
    }
  }

  static setWalletConnect (payload) {
    storeDataToSecureStorage(KEYSTORE.SET_WALLET_CONNECT, payload)
    return {
      type: KEYSTORE.SET_WALLET_CONNECT,
      payload
    }
  }

  // -> Data stored ins Secure storage

  static setAccountTokenList (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.SET_ACCOUNT_TOKEN_LIST)
    return {
      type: KEYSTORE.SET_ACCOUNT_TOKEN_LIST,
      payload
    }
  }

  static setActiveAccount (payload) {
    saveDataToAsyncStorage(payload, REDUX_KEY.activeAccount)
    return {
      type: REDUX_KEY.activeAccount,
      payload
    }
  }

  static setNotificationList (payload) {
    return {
      type: KEYSTORE.NOTIFICATION_LIST,
      payload
    }
  }

  static setNotificationReadIds (payload) {
    saveDataToAsyncStorage(payload, KEYSTORE.NOTIFICATION_READ_IDS)
    return {
      type: KEYSTORE.NOTIFICATION_READ_IDS,
      payload
    }
  }
}
