import { CURRENCY_DATA } from 'common/constants/app'
import { SUPPORTED_BLOCKCHAIN_DATA } from 'common/constants/chain'

var initState = {
  objInit: {},
  nullInit: null,
  localeInit: 'en',
  currencyInit: CURRENCY_DATA.USD.code,
  numberInit: 0,
  stringInit: '',
  flag: true,
  arrInit: [],
  // Optimistic: assume online until NetInfo's first event proves otherwise, so
  // offline UI (e.g. TokenList dimmed balance + noInternet icon) doesn't flash on
  // cold start before the first connectivity event lands.
  internetInit: true,
  boolFalseInit: false,
  boolTrueInit: true,
  coinPriceInit: {
    tusdRate: 0,
    ethRate: 0,
    rateTomo: 0,
    rateBnb: 0,
    rateHt: 0
  },
  gasPriceSlideValue: 1,
  fiatRate: 1,

  blockchainList: SUPPORTED_BLOCKCHAIN_DATA,

  canShowAppRatingInit: {
    canShow: false,
    alreadyShow: false
  },
  // Device location/region consent. `asked` gates the one-time first-launch
  // prompt; `granted` records the user's choice (so we can refresh on later
  // launches); `country` is the ISO 3166-1 alpha-2 code ('' when declined or
  // unknown).
  userLocationInit: {
    asked: false,
    granted: false,
    country: ''
  },
  lengthNumber: 0,
  initPlayerName: 'Player',
  // AI Search UI chat history, keyed by lowercased wallet address:
  // { [address]: Message[] }. Persisted via the store's AsyncStorage layer.
  aiSearchHistory: {},
  addressRegisteredLiquidity: [],
  addressDeletedLiquidity: {},

  // Migration flags for app version updates
  migrationFlags: {
    tokenKeyToContractFormatV1: false,
    accountListV2Migrated: false
  },

  activeEvmChainIds: [],

  // Minutes of background-time before auto-locking the vault.
  // -1 = never, 0 = lock immediately on background.
  autoLockMinutes: 60,

  // v2 token list — keyed by lowercase EVM account address, holds the flat
  // per-account token list + pre-computed totals. EVM-only.
  // Shape:
  // {
  //   [address]: {
  //     tokens: [{
  //       chainId,
  //       contractAddress,
  //       symbol,
  //       decimals,
  //       isCustom,
  //       isHidden,
  //       balance,
  //       balanceFormatted,
  //       priceUSD,
  //       valueUSD,
  //       priceChange24hPct,
  //       metaKey
  //     }],
  //     totalUSD: number,
  //     lastSyncedAt: number
  //   }
  // }
  accountTokenList: {},

  activeAccount: {
    account: {}, // account current when to user selected an Account
    indexAccount: 0, // index of account current in accountListRedux
    chainIdScreen: {}, // chain id current when to user selected an page,
    accountsUsing: [] // list accounts of user opening to use
  }

}

export default initState
