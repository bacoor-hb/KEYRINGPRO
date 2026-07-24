import { KEYSTORE, REDUX_KEY } from 'common/constants/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import initState from 'controller/Redux/lib/initState'

// Keys whose values live in encrypted secure storage (MMKV).
export const SECURE_STORAGE_REDUX_MAP = [
  { key: KEYSTORE.SET_WALLET_CONNECT, action: StorageReduxAction.setWalletConnect, init: initState.arrInit },
  { key: KEYSTORE.SET_ACCOUNT_LIST, action: StorageReduxAction.setAccountList, init: initState.arrInit },
  { key: KEYSTORE.TOKEN_JWT, action: StorageReduxAction.setTokenJWT, init: initState.nullInit }
]

// Keys whose values live in AsyncStorage. `localeInit` is resolved at startup
// from the device locale, so this is a factory rather than a static const.
export const buildStorageReduxMap = (localeInit) => [
  { key: KEYSTORE.SET_LOCALE, action: StorageReduxAction.setLanguage, init: localeInit },
  { key: KEYSTORE.SET_CURRENCY, action: StorageReduxAction.setCurrency, init: initState.currencyInit },
  { key: KEYSTORE.SET_FIAT_RATE, action: StorageReduxAction.setFiatRate, init: initState.fiatRate },
  { key: KEYSTORE.SET_SETTINGS, action: StorageReduxAction.setAppSettings, init: initState.nullInit },
  { key: KEYSTORE.SET_CALL_REQUEST, action: StorageReduxAction.setCallRequest, init: initState.arrInit },
  { key: KEYSTORE.SET_CURRENT_CALL_REQUEST, action: StorageReduxAction.setCurrentCallRequest, init: initState.boolFalseInit },
  { key: KEYSTORE.SET_BLOCKCHAIN_LIST, action: StorageReduxAction.setBlockChainList, init: initState.blockchainList },
  { key: KEYSTORE.SET_CAN_SHOW_APP_RATING, action: StorageReduxAction.setCanShowAppRating, init: initState.canShowAppRatingInit },
  { key: KEYSTORE.SET_USER_LOCATION, action: StorageReduxAction.setUserLocation, init: initState.userLocationInit },
  { key: KEYSTORE.SET_GAS_PRICE_SLIDE_VALUE, action: StorageReduxAction.setGasPriceSlideValue, init: initState.gasPriceSlideValue },
  { key: KEYSTORE.AI_SEARCH_HISTORY, action: StorageReduxAction.setAiSearchHistory, init: initState.aiSearchHistory },
  { key: KEYSTORE.SET_ADDRESS_REGISTERED_LIQUIDITY, action: StorageReduxAction.setAddressRegisteredLiquidity, init: initState.addressRegisteredLiquidity },
  { key: KEYSTORE.SET_ADDRESS_DELETED_LIQUIDITY, action: StorageReduxAction.setAddressDeletedLiquidity, init: initState.addressDeletedLiquidity },
  { key: KEYSTORE.ADDRESS_BOOK_HISTORY, action: StorageReduxAction.setAddressBookHistory, init: initState.arrInit },
  { key: KEYSTORE.ADDRESS_BOOK_INFO, action: StorageReduxAction.setAddressBookInfo, init: initState.objInit },
  { key: KEYSTORE.SET_MIGRATION_FLAGS, action: StorageReduxAction.setMigrationFlags, init: initState.migrationFlags },
  { key: KEYSTORE.ACTIVE_EVM_CHAIN_IDS, action: StorageReduxAction.setActiveEvmChainIds, init: initState.activeEvmChainIds },
  { key: KEYSTORE.AUTO_LOCK_MINUTES, action: StorageReduxAction.setAutoLockMinutes, init: initState.autoLockMinutes },
  { key: REDUX_KEY.activeAccount, action: StorageReduxAction.setActiveAccount, init: initState.activeAccount },
  { key: KEYSTORE.SET_ACCOUNT_TOKEN_LIST, action: StorageReduxAction.setAccountTokenList, init: initState.accountTokenList },
  { key: KEYSTORE.NOTIFICATION_READ_IDS, action: StorageReduxAction.setNotificationReadIds, init: initState.arrInit }
]
