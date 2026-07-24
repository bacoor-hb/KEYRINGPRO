import images from 'assets/Image'
import Keys from 'react-native-keys'
import Config from 'react-native-config'

export const errOverTime = 'OverTime'

export const STANDARD_CHAIN = {
  Evm: 'evm',
  Solana: 'solana',
  Ton: 'ton',
  Bitcoin: 'bitcoin'
}

export const MODE_THEME = {
  DARK_MODE: 'Darkmode',
  LIGHT_MODE: 'Lightmode'
}

export const LOCALE = {
  EN: 'en',
  CN: 'cn',
  CN2: 'cn2',
  DE: 'de',
  ES: 'es',
  FR: 'fr',
  IT: 'it',
  JP: 'jp',
  KR: 'kr',
  NL: 'nl',
  PL: 'pl',
  PT: 'pt',
  RU: 'ru',
  TH: 'th',
  TR: 'tr',
  VN: 'vn'
}

export const LOCALE_DATA = [
  { title: 'English', name: 'en' },
  { title: '簡体字', name: 'cn' },
  { title: '繁体字', name: 'cn2' },
  { title: '日本語', name: 'jp' },
  { title: 'Deutsche', name: 'de' },
  { title: 'Français', name: 'fr' },
  { title: 'Español', name: 'es' },
  { title: 'Português', name: 'pt' },
  { title: 'Italiano', name: 'it' },
  { title: 'Nederlands', name: 'nl' },
  { title: 'Język polski', name: 'pl' },
  { title: 'Русский', name: 'ru' },
  { title: 'Tiếng việt', name: 'vn' },
  { title: '한국어', name: 'kr' },
  { title: 'ไทย', name: 'th' },
  { title: 'Türk Dili', name: 'tr' }
]

export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
export const NULL_ADDRESS_OTHER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

export const BRIDE_API = {
  // DLN_API: 'https://api.dln.trade',\
  DLN_API: 'https://dln.debridge.finance',
  TOKEN_LIST: 'https://tokens.1inch.io/v1.1',
  TOKEN_PRICE: 'https://token-prices.1inch.io/v1.1',
  DLN_TRADE_DETAIL: 'https://app.debridge.finance/order?orderId=',
  TERMS_OF_USE: 'https://debridge.finance/assets/files/debridge_terms_of_service.pdf',
  PRIVACY_POLICY: 'https://debridge.finance/assets/files/debridge_privacy_policy.pdf'
}
export const AFFILIATE_FEE_PERENT = 0.1
export const AFFILIATE_FEE_RECIPIENT = Config.AFFILIATE_FEE_RECIPIENT
export const REFERRAL_CODE = Config.REFERRAL_CODE
export const BRIDGE_SLIPAGE = 1

// Swap/Bridge Service Configuration
export const SWAP_SERVICE_CONFIG = {
  // Provider configurations
  providers: {
    debridge: {
      key: 'debridge',
      shortName: 'deSwap',
      name: 'deBridge Finance',
      apiBaseUrl: 'https://dln.debridge.finance',
      accessToken: Keys.secureFor('DEBRIDGE_ACCESS_TOKEN'),
      features: {
        crossChain: true,
        sameChain: true,
        integratedApproval: false
      },
      fees: {
        hasFeeProtocol: true
      },
      documentation: 'https://docs.debridge.finance/',
      urlTermsOfService: BRIDE_API.TERMS_OF_USE,
      urlPrivacyPolicy: BRIDE_API.PRIVACY_POLICY,
      logo: {
        Lightmode: images.deswapIcon,
        Darkmode: images.deswapIcon
      },
      logoPowerBy: {
        Lightmode: images.deBridgeIcon,
        Darkmode: images.deBridgeIcon
      }
    },
    relay: {
      key: 'relay',
      name: 'Relay',
      shortName: 'relay',
      apiBaseUrl: Config.RELAY_API,
      apiKey: Keys.secureFor('RELAY_API_KEY'),
      features: {
        crossChain: true,
        sameChain: true,
        integratedApproval: true
      },
      fees: {
        hasFeeProtocol: false
      },
      documentation: 'https://docs.relay.link/references/api',
      urlTermsOfService: 'https://relay.link/terms',
      urlPrivacyPolicy: 'https://relay.link/privacy-policy',
      logo: {
        Lightmode: require('assets/Image/Theme/Lightmode/icons/logo_relay.png'),
        Darkmode: require('assets/Image/Theme/Darkmode/icons/logo_relay.png')
      },
      logoPowerBy: {
        Lightmode: images.logo_empowered_relay,
        Darkmode: images.logo_empowered_relay
      }
    }
  }
}
export const REQUEST_TYPE = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE'
}

export const DEFAULT_PASSWORD_NFC = [Number(Keys.secureFor('PASSWORD_NFC_ONE')), Number(Keys.secureFor('PASSWORD_NFC_TWO')), Number(Keys.secureFor('PASSWORD_NFC_THREE')), Number(Keys.secureFor('PASSWORD_NFC_FOUR'))]

export const DEFAULT_WC_APP_METADATA = {
  name: 'KEYRING PRO',
  description: 'KEYRING PRO is a multichain wallet designed for secure storage of Bitcoin, Ethereum, Solana, ERC-20 tokens, NFTs, and other assets across diverse blockchain networks.',
  url: 'https://keyring.app/',
  icons: ['https://ipfs.pantograph.app/ipfs/QmWBaftxLoxKpbDUci4fGHDstiLPZh7G6FNVtySmgp9F5r?filename=keyrongpro_logo.png'],
  redirect: {
    native: 'keyring://'
  }
}

export const APP_VERSION = '6.0.0'

export const IconType = {
  // AntDesign: require('react-native-vector-icons/AntDesign').default,
  // Feather: require('react-native-vector-icons/Feather').default,
  // Ionicons: require('react-native-vector-icons/Ionicons').default,
  // MaterialCommunityIcons: require('react-native-vector-icons/MaterialCommunityIcons').default,

  AntDesign: 'AntDesign',
  Feather: 'Feather',
  Ionicons: 'Ionicons',
  Material: 'Material'

  // Entypo: require('react-native-vector-icons/Entypo').default,
  // EvilIcons: require('react-native-vector-icons/EvilIcons').default,
  // FontAwesome: require('react-native-vector-icons/FontAwesome').default,
  // FontAwesome5: require('react-native-vector-icons/FontAwesome5').default,
  // Foundation: require('react-native-vector-icons/Foundation').default,
  // MaterialIcons: require('react-native-vector-icons/MaterialIcons').default,
  // Octicons: require('react-native-vector-icons/Octicons').default,
//   Zocial: require('react-native-vector-icons/Zocial').default,
//   SimpleLineIcons: require('react-native-vector-icons/SimpleLineIcons').default
}

export const CURRENCY_DATA = {
  USD: { code: 'USD', symbol: '$', position: 'prefix' },
  JPY: { code: 'JPY', symbol: '¥', position: 'prefix' },
  AUD: { code: 'AUD', symbol: 'A$', position: 'prefix' },
  BRL: { code: 'BRL', symbol: 'R$', position: 'prefix' },
  CAD: { code: 'CAD', symbol: 'CA$', position: 'prefix' },
  CHF: { code: 'CHF', symbol: 'Fr', position: 'prefix' },
  CLP: { code: 'CLP', symbol: 'CLP$', position: 'prefix' },
  RMB: { code: 'RMB', symbol: '¥', position: 'prefix' },
  CZK: { code: 'CZK', symbol: 'Kč', position: 'suffix' },
  DKK: { code: 'DKK', symbol: 'kr', position: 'suffix' },
  EUR: { code: 'EUR', symbol: '€', position: 'suffix' },
  GBP: { code: 'GBP', symbol: '£', position: 'prefix' },
  HKD: { code: 'HKD', symbol: 'HK$', position: 'prefix' },
  HUF: { code: 'HUF', symbol: 'Ft', position: 'suffix' },
  IDR: { code: 'IDR', symbol: 'Rp', position: 'prefix' },
  ILS: { code: 'ILS', symbol: '₪', position: 'prefix' },
  INR: { code: 'INR', symbol: '₹', position: 'prefix' },
  ISK: { code: 'ISK', symbol: 'kr', position: 'suffix' },
  KRW: { code: 'KRW', symbol: '₩', position: 'prefix' },
  MXN: { code: 'MXN', symbol: 'MX$', position: 'prefix' },
  MYR: { code: 'MYR', symbol: 'RM', position: 'prefix' },
  NOK: { code: 'NOK', symbol: 'kr', position: 'suffix' },
  NZD: { code: 'NZD', symbol: 'NZ$', position: 'prefix' },
  PHP: { code: 'PHP', symbol: '₱', position: 'prefix' },
  PKR: { code: 'PKR', symbol: '₨', position: 'prefix' },
  PLN: { code: 'PLN', symbol: 'zł', position: 'suffix' },
  RUB: { code: 'RUB', symbol: '₽', position: 'suffix' },
  SEK: { code: 'SEK', symbol: 'kr', position: 'suffix' },
  SGD: { code: 'SGD', symbol: 'S$', position: 'prefix' },
  THB: { code: 'THB', symbol: '฿', position: 'prefix' },
  TRY: { code: 'TRY', symbol: '₺', position: 'prefix' },
  TWD: { code: 'TWD', symbol: 'NT$', position: 'prefix' },
  ZAR: { code: 'ZAR', symbol: 'R', position: 'prefix' },
  VND: { code: 'VND', symbol: '₫', position: 'suffix' }
}

export const REVIEW_URL_STATUS = {
  USER_NOT_REVIEW_YET: 0,
  OFFICIAL: 1,
  NOT_OFFICIAL: 2,
  SERVER_NOT_REVIEW_YET: 3
}

export const NFT_TYPE_MAP = {
  CREATE_NFT: 'CREATE_NFT',
  RECEIVE_NFT: 'RECEIVE_NFT',
  SCAN_NFT: 'SCAN_NFT',
  REPLACE_NFT: 'REPLACE_NFT',
  SCAN_QR: 'SCAN_QR',
  REGISTER_NFC: 'REGISTER_NFC',
  CREATE_QR: 'CREATE_QR',
  SCAN_QR_TAG_CODE: 'SCAN_QR_TAG_CODE',
  RECEIVE_QR_TAG_CODE: 'RECEIVE_QR_TAG_CODE',
  SCAN_NFC_ID_ONLY: 'SCAN_NFC_ID_ONLY',
  SCAN_NFC_AND_ADD_CONTENT: 'SCAN_NFC_AND_ADD_CONTENT'
}

export const STATUS_RANGE = {
  FULL_RANGE: 'FULL_RANGE',
  IN_RANGE: 'IN_RANGE',
  OUT_RANGE: 'OUT_RANGE',
  LIMITED_RANGE: 'LIMITED_RANGE'
}

export const NATIVE_TOKEN_BY_CHAIN_ID = {
  988: '0x779ded0c9e1022225f8e0630b35a9b54be713736'// stable chain: https://stablescan.xyz/address/0x779ded0c9e1022225f8e0630b35a9b54be713736
}
