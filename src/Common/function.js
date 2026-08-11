import { Linking } from 'react-native'
import moment from 'moment'
import Reactotron from 'reactotron-react-native'
import numeral from 'numbro'
import I18n from 'assets/Lang'
import crypto from 'crypto-js'
import ReduxService from 'common/redux'
import { APP_VERSION, MODE_THEME, AFFILIATE_FEE_RECIPIENT, LOCALE, STANDARD_CHAIN, CURRENCY_DATA } from 'common/constants/app'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { Colors, DarkColors } from './styles'
import { Ndef } from 'react-native-nfc-manager'
// generate lib
import { ethers } from 'ethers'
import settings from 'controller/settings'
import '@walletconnect/react-native-compat'
import { getSdkError } from '@walletconnect/utils'
import { formatJsonRpcError } from '@json-rpc-tools/utils'
import { isEmpty } from 'lodash'
import { removeCommasFromNumer } from './web3'
import Keys from 'react-native-keys'
import BigNumber from 'bignumber.js'
import { erc20Abi, erc721Abi, numberToHex, createPublicClient, http, hexToString as viemHexToString } from 'viem'
import { NavigationActions } from 'src/navigation/NavigationService'
import { add0xToPrivateKey, remove0xFromPrivateKey, storePrivateKeyByAddress } from './wallet'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { randomBytes } from './cryptoVault'
const InputDataDecoder = require('ethereum-input-data-decoder')

export const logDebug = (message) => {
  // eslint-disable-next-line no-undef
  if (__DEV__) {
    Reactotron.logImportant(message)
  }
}

export const debugInfo = (location, info) => {
  // eslint-disable-next-line no-undef
  if (__DEV__) {
    logDebug(`----------------------------debugInfo - ${location}----------------------------`)
    logDebug(info)
    logDebug('----------------------------')
  }
}

export const getColorIconByTheme = (themeProps) => {
  switch (themeProps) {
    case MODE_THEME.LIGHT_MODE:
      return Colors.TEXT
    case MODE_THEME.DARK_MODE:
      return DarkColors.WHITE
    default:
      return Colors.GRAY1
  }
}

async function fetchAllABIs (address, chainId, visited = new Set()) {
  const infoScanToken = ReduxService.getSettingOther('tokenScanApiWithChain_v3')
  const chainInfoWithToken = JSON.parse(infoScanToken)[1]
  const arrListKeyLength = chainInfoWithToken?.tokenArr?.length
  const minKeyIndex = 0
  const maxKeyIndex = arrListKeyLength - 1
  const randomKeyIndex = Math.floor(Math.random() * (maxKeyIndex - minKeyIndex + 1)) + minKeyIndex

  const apiKey = chainInfoWithToken.tokenArr[randomKeyIndex]

  const normalized = address.toLowerCase()
  if (visited.has(normalized)) return []
  visited.add(normalized)

  const baseUrl = chainInfoWithToken?.scanApi?.link || 'https://api.etherscan.io/v2/api'
  const url = `${baseUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}&chainId=${chainId}`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== '1' || !Array.isArray(data.result)) {
      // console.warn(`⚠️ Warning: Failed to fetch ABI for ${address}`)
      return []
    }

    const contractInfo = data.result[0] || {}

    let abi = []
    try {
      abi = JSON.parse(contractInfo.ABI || '[]')
    } catch {
      // console.warn(`⚠️ Invalid ABI at ${address}`)
    }

    let childABIs = []
    const impl = contractInfo.Implementation
    if (impl && impl !== '0x0000000000000000000000000000000000000000') {
      childABIs = await fetchAllABIs(impl, chainId, visited)
    }

    return [...abi, ...childABIs]
  } catch (err) {
    // console.warn(`⚠️ Network or parsing error at ${address}:`, err.message)
    return []
  }
}

export const decodeDataTxAndGetMethodName = async (dataTxRaw, chainId, contractAddress) => {
  const splitData = dataTxRaw.split('--')
  // const informationData = jsonStr2Obj(splitData[1]) || {}
  const dataTx = splitData[2] || splitData[0]

  try {
    if (chainId) {
      // Supported Chains:  https://docs.etherscan.io/etherscan-v2/supported-chains
      const listChainSupported = ['1', '11155111', '17000', '560048', '2741', '11124', '33111', '33139', '42170', '42161', '421614', '43114', '43113', '8453', '84532', '80094', '80069', '199', '1028', '81457', '168587773', '56', '97', '44787', '42220', '25', '252', '2522', '100', '999', '59144', '59141', '5000', '5003', '4352', '43521', '1287', '10143', '1284', '1285', '10', '11155420', '80002', '137', '747474', '1329', '1328', '534352', '534351', '57054', '146', '50104', '531050104', '1923', '1924', '167009', '167000', '130', '1301', '480', '4801', '660279', '37714555429', '51', '50', '324', '300', '204', '5611']
      const infoScanToken = ReduxService.getSettingOther('tokenScanApiWithChain_v3')
      const chainInfoWithToken = JSON.parse(infoScanToken)[1]
      if (!listChainSupported?.includes(chainId?.toString()) || !chainInfoWithToken || !chainInfoWithToken.tokenArr || !chainInfoWithToken.scanApi || !chainInfoWithToken.scanApi.link) {
        return null
      }

      let contractABI = await fetchAllABIs(contractAddress, chainId)

      if (isEmpty(contractABI)) {
        contractABI = [...erc20Abi, ...erc721Abi]
      }

      const decoder = new InputDataDecoder(contractABI)
      const result = decoder.decodeData(dataTx)

      return { ...result }
    } else {
      return null
    }
  } catch (e) {
    // logDebug({ e123: e })
    return null
  }
}

export const popAction = () => {
  NavigationActions.goBack()
}

export const decryptBackupFileContent = (value, pass) => {
  try {
    return crypto.AES.decrypt(value.toString(), pass.toString()).toString(crypto.enc.Utf8)
  } catch (error) {
    return ''
  }
}

export const decryptPrivateKeyFromKeyringHardwalletWeb = (data, pass) => {
  try {
    const passWithSalt = `${pass}${Keys.secureFor('KEYRING_HARDWALLET_WEB_NFC_SALT')}`
    return crypto.AES.decrypt(data.toString(), passWithSalt).toString(crypto.enc.Utf8)
  } catch (error) {
    return ''
  }
}

export const verifyCorrectWalletByPk = (pk) => {
  try {
    // eslint-disable-next-line no-unused-vars
    const account = privateKeyToAccount(add0xToPrivateKey(pk))
    if (account?.address) {
      return true
    } else {
      return false
    }
  } catch (e) {
    return false
  }
}

// Generates a cryptographically-strong random secret (256-bit, hex-encoded).
// Used as the password that protects the private key exported to an NFC KeyCard,
export const makeRandomHash = () => {
  return randomBytes(32).toString('hex')
}

export const handleOpenUrl = (url) => {
  if (url && url.length > 0) {
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        return Linking.openURL(url)
      }
    }).catch(() => {
      // Nothing to recover: the URL simply can't be opened on this device
    })
  }
}

export const getLength = (value) => {
  return value ? value.length : 0
}

export const lowerCase = (value) => {
  return value ? value.toString().toLowerCase() : value
}

export const upperCase = (value) => {
  return value ? value.toString().toUpperCase() : value
}

export const toString = (value) => {
  try {
    return value ? value.toString() : value
  } catch (error) {
    return value
  }
}

export const countDots = (strString, strLetter) => {
  const string = strString.toString()
  return (string.match(RegExp(strLetter, 'g')) || []).length
}

// eslint-disable-next-line no-extend-native
String.prototype.expandExponential = function () {
  return this.replace(/^([+-])?(\d+).?(\d*)[eE]([-+]?\d+)$/, function (x, s, n, f, c) {
    // eslint-disable-next-line no-redeclare
    var l = +c < 0; var i = n.length + +c; var x = (l ? n : f).length
    // eslint-disable-next-line no-redeclare
    var c = ((c = Math.abs(c)) >= x ? c - x + l : 0)
    var z = (new Array(c + 1)).join('0'); var r = n + f
    // eslint-disable-next-line no-return-assign
    return (s || '') + (l ? r = z + r : r += z).substr(0, i += l ? z.length : 0) + (i < r.length ? '.' + r.substr(i) : '')
  })
}

const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export const splitDecimalNumber = (strNumInput) => {
  const strNum = (strNumInput + '').expandExponential()
  // let strNum = (strNumInput + '')
  if (strNum === 'NaN') return { first: '.', decimal: '..' }
  if (strNum === '-') return { first: '-', decimal: '' }
  if (strNum !== '0') {
    const numSlice = strNum.toString().split('.')
    const decimalWithoutZero = scientificToDecimal(numSlice[1] ? parseFloat(`0.${numSlice[1]}`) : '0.0')
    let firstData = numSlice[0]
    if (firstData.includes('e,')) {
      firstData = firstData.replace('e,', 'e')
    }
    const arrDecimal = {
      first: numberWithCommas((firstData + '').expandExponential()),
      decimal: decimalWithoutZero > 0
        ? decimalWithoutZero.toString().replace('0.', '.')
        : ''
    }

    return arrDecimal
  }
  return { first: 0, decimal: '' }
}

// Resolve the display symbol + placement for a currency code, mirroring how
// FiatBalance renders currency (CURRENCY_DATA symbol with prefix/suffix position)
// instead of appending the raw currency code. Falls back to USD.
export const getCurrencySymbolData = (currencyCode) => {
  const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
  return { symbol: cur.symbol, position: cur.position }
}

export const convertAddressArrToString = (arrAddress = '', numStart = 6, numEnd = 6) => {
  try {
    if (arrAddress && arrAddress[0] && arrAddress.length === 1) {
      return arrAddress[0] && arrAddress[0].substring(0, numStart) + '...' + arrAddress[0].substring(arrAddress[0].length - numEnd, arrAddress[0].length)
    } else if (arrAddress && arrAddress[0] && (arrAddress.length > 1)) {
      let stringTemp = ''
      arrAddress.map((item, index) => {
        index !== arrAddress.length - 1 ? stringTemp += convertAddressArrToString([item]) + '\n' : stringTemp += convertAddressArrToString([item])
      })

      return stringTemp
    }
  } catch (error) {
    return ''
  }
}

export const formatNumber = (strNumber, isFiatMoney = false, precisionFiat = 2, separator = '.', stripInsignificantZeros = false) => {
  strNumber = Number.parseFloat(strNumber).toFixed(10).replace(/\.?0+$/, '')
  strNumber = (strNumber + '').expandExponential()
  const dotsCountStr = countDots(strNumber.toString(), '\\.')
  if (dotsCountStr === 1) {
    const arrNum = strNumber.toString().split('.')
    if (arrNum && arrNum[1] && arrNum[1].length > 2) {
      arrNum[1] = arrNum[1].substring(0, 8)
    }
    strNumber = arrNum.join('.')
  }

  let stringNumber = Number.parseFloat(strNumber).toFixed(8).replace(/\.?0+$/, '')
  stringNumber = (stringNumber + '').expandExponential()
  const dotsCount = countDots(stringNumber, '\\.')
  let precision = null
  if (dotsCount === 1) {
    let decimalCount = stringNumber.length - stringNumber.indexOf('.') - 1
    decimalCount = decimalCount <= 2 ? 2 : decimalCount
    precision = decimalCount > 8 ? 8 : decimalCount
  } else {
    precision = 2
  }
  const value = I18n.toNumber(stringNumber,
    {
      separator: separator === '.' ? '.' : ',',
      precision: isFiatMoney ? precisionFiat : precision,
      delimiter: separator === '.' ? ',' : '.',
      strip_insignificant_zeros: stripInsignificantZeros
    })
  return value === 'NaN' ? '...' : value
}

// Convert 2e8 to real number
export const scientificToDecimal = (num) => {
  const sign = Math.sign(num)
  // if the number is in scientific notation remove it
  // eslint-disable-next-line no-useless-escape
  if (/\d+\.?\d*e[\+\-]*\d+/i.test(num)) {
    const zero = '0'
    const parts = String(num).toLowerCase().split('e') // split into coeff and exponent
    const e = parts.pop() // store the exponential part
    let l = Math.abs(e) // get the number of zeros
    const direction = e / l // use to determine the zeroes on the left or right
    const coeffArray = parts[0].split('.')

    if (direction === -1) {
      coeffArray[0] = Math.abs(coeffArray[0])
      num = zero + '.' + new Array(l).join(zero) + coeffArray.join('')
    } else {
      const dec = coeffArray[1]
      if (dec) l = l - dec.length
      num = coeffArray.join('') + new Array(l + 1).join(zero)
    }
  }

  if (sign < 0) {
    num = -num
  }
  return num
}

export const keyExtractor = (itm, idx) => {
  if (itm && (itm._id || itm.id)) {
    return itm._id ? itm._id.toString() : itm.id.toString()
  } else {
    return idx.toString()
  }
}

export const formatDate = (date = new Date(), format, isUnixTime) => {
  if (!format) {
    const localeRedux = ReduxService.getReduxDataByKey('localeRedux')
    format = localeRedux === LOCALE.JP ? 'YYYY/MM/DD HH:mm' : 'DD/MM/YYYY HH:mm'
  }
  const strTime = (isUnixTime ? moment.unix(date) : moment(date)).format(format)
  return strTime
}

export const formatNumberBro = (number, mantissa = 8, isReturnNaN, textNa, numberFormat = { thousandSeparated: true, trimMantissa: true }) => {
  if (number !== false && number !== 'null' && number !== null && !isNaN(number) && number !== undefined && number !== 'NaN' && number !== Infinity) {
    if (number.toString().length > 0) {
      // eslint-disable-next-line no-useless-escape
      return numeral(number.toString().replace(/\,/g, '')).format({ trimMantissa: true, thousandSeparated: numberFormat?.thousandSeparated, mantissa })
    }
  }
  return isReturnNaN ? (textNa || 'N/A') : 0
}

export const convertBalanceToWei = (numberInString, iDecimal = 18) => {
  numberInString = removeCommasFromNumer(numberInString)
  try {
    return ethers.utils.parseUnits(numberInString.toString(), iDecimal).toString()
  } catch (error) {
    return '0'
  }
}

export const convertWeiToBalance = (strValue, iDecimal = 18) => {
  try {
    return ethers.utils.formatUnits(strValue.toString(), iDecimal)
  } catch (error) {
    return 0
  }
}

export const generateDataToken = (amount = 0, address) => {
  const transferOpCode = '0xa9059cbb'
  const ABIValueToTransfer = zeroPadLeft(numberToHex(BigInt(amount.toString().split('.')[0])).replace('0x', ''), 64)

  if (address) {
    const ethNakedAddress = address.toLowerCase().replace('0x', '')
    const ABIAddressTarget = zeroPadLeft(ethNakedAddress)
    return transferOpCode + ABIAddressTarget + ABIValueToTransfer
  } else {
    return transferOpCode + ABIValueToTransfer
  }
}

const zeroPadLeft = (text, length = 64) => {
  while (text.length < length) {
    text = '0' + text
  }
  return text
}

export const isObject = (data, checkEmpty = false) => {
  const isObj = data && typeof data === 'object'
  return checkEmpty
    ? isObj && Object.keys(data).length > 0
    : isObj
}

export const isString = (data) => {
  return data && typeof data === 'string'
}

export const jsonStr2Obj = (str, defaultValue = false) => {
  try {
    if (isObject(str)) {
      return str
    }
    return JSON.parse(str)
  } catch (e) {
    return defaultValue
  }
}

export const array2Object = (arr, key, defaultValue = undefined) => {
  return Array.isArray(arr)
    ? arr.reduce((obj, item) => Object.assign(obj, { [item[key]]: defaultValue === undefined ? item : defaultValue }), {})
    : {}
}

export const isValidEVMAddressFormat = (address) => {
  try {
    return address && isString(address) && address.startsWith('0x') && address.length === 42
  } catch (error) {
    return false
  }
}

// Liquidity Management V2 is single-address & EVM-only. Old app versions could
// persist several registered addresses (including a Solana one). Collapse the
// stored list to the single active address: the first valid EVM address
// (ethers' isAddress). Returns '' when none qualifies.
export const getActiveLiquidityAddress = (addressRegisteredLiquidity) => {
  try {
    return (addressRegisteredLiquidity || []).find((item) => ethers.utils.isAddress(item)) || ''
  } catch (error) {
    return ''
  }
}

export const isHideMenuForAppleReview = () => {
  const appVersion = APP_VERSION.replace(/\./g, '')
  const isHideForReview = ReduxService.getSettingOther(`keyring_IS_HIDE_FOR_REVIEW_${appVersion}`)

  return ISIOS ? isHideForReview === 'true' : false
}

export const isURL = (str) => {
  try {
    return str ? (str.startsWith('http://') || str.startsWith('https://')) : false
  } catch (e) {
    return false
  }
}

export const generateNewEvmAccount = () => {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return { address: lowerCase(account.address), privateKey: remove0xFromPrivateKey(privateKey), chain: 'evm' }
}

export const generateEvmAccountFromPrivateKeyEvm = (privateKey, isFromKeyCard = false, addressProps) => {
  try {
    const wallet = privateKeyToAccount(add0xToPrivateKey(privateKey))
    return { chain: STANDARD_CHAIN.Evm, address: addressProps || lowerCase(wallet.address), privateKey: isFromKeyCard ? '' : remove0xFromPrivateKey(privateKey) }
  } catch (error) {
    return null
  }
}

export const getPrivateKeyHashFromNFCData = (hash) => {
  return (hash || '').split('---')?.[0] || ''
}

export const getAddressFromNFCData = (hash) => {
  try {
    let address = (hash || '').split('---')?.[1] || ''
    if (!address) {
      address = JSON.parse(hash)?.address
    }
    return address.toLowerCase()
  } catch (error) {
    return ''
  }
}
export const importPrivateKey = async (
  privateKeyEvm = '',
  accountNameInit = '',
  isFromKeyCard = false,
  passwordFile = '',
  passwordFileEncode = '',
  addressFromKeyCard
) => {
  try {
    const currentAccountList = ReduxService.getAccountList()
    const accountName = accountNameInit || I18n.t('v2.addAccount.normalAccount', { count: currentAccountList.length + 1 })
    const evmAccount = generateEvmAccountFromPrivateKeyEvm(remove0xFromPrivateKey(privateKeyEvm), isFromKeyCard, addressFromKeyCard)

    // case wrong private key, ex: incluce invalid character in private key
    if (!evmAccount) {
      return null
    }

    // Reject duplicates — an address already tracked in the app must not be
    // added again (caller shows a "duplicate account" message on null).
    const isDuplicate = currentAccountList.some(
      (a) => lowerCase(a?.address) === lowerCase(evmAccount.address)
    )
    if (isDuplicate) {
      return null
    }

    // store private key to secure storage
    storePrivateKeyByAddress(evmAccount.address, evmAccount.privateKey)
    // remove private key from object
    delete evmAccount.privateKey

    const commonAccountInfo = {
      isFromKeyCard,
      passwordFile: passwordFile,
      passwordFileEncode: passwordFileEncode,
      status: true,
      // Stamp account type at the source so UI can render the badge immediately
      // (no wait for the boot backfill). NFC keycard ⇒ cold, otherwise hot.
      accountType: isFromKeyCard ? ACCOUNT_TYPE.COLD : ACCOUNT_TYPE.HOT
    }

    const accountData = { ...evmAccount, ...commonAccountInfo, name: accountName }

    if (isFromKeyCard) {
      // Check again if need to do something for account from key card in the future
    }

    ReduxService.setAccountList([...currentAccountList, accountData])

    return accountData
  } catch (e) {
    // error
  }
}

export const inpreciseRound = (value, decPlaces) => {
  return scientificToDecimal(Math.floor(value * Math.pow(10, decPlaces)) / Math.pow(10, decPlaces))
}

// UPDATE_NEW_CHAIN
export const routeLinkScanWithHash = (hash, targetChainTypeOrChainId, isReturnString = false) => {
  const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux', [])

  const chainId = targetChainTypeOrChainId

  const linkHashScan = blockchainListRedux?.[chainId]?.linkScanHash
  if (linkHashScan) {
    if (isReturnString) {
      return `${linkHashScan + hash}`
    } else {
      handleOpenUrl(`${linkHashScan + hash}`)
    }
  }
}

// Open (or return) the explorer token-contract page: `{explorer}/token/{address}`.
// Uses the chain's `explorer` base from blockchainListRedux and normalizes the
// trailing slash so it works whether `explorer` ends with one or not (e.g.
// 'https://etherscan.io' -> 'https://etherscan.io/token/0x...'). There's no
// dedicated linkScanToken field on the chain, so this is the canonical helper
// for token links (mirrors routeLinkScanWithHash).
export const routeLinkScanWithToken = (tokenAddress, chainIdOrChainType, isReturnString = false) => {
  if (!tokenAddress) return isReturnString ? '' : undefined
  const explorer = getChainInfo(chainIdOrChainType)?.explorer
  if (!explorer) return isReturnString ? '' : undefined
  const url = `${String(explorer).replace(/\/+$/, '')}/token/${tokenAddress}`
  if (isReturnString) return url
  handleOpenUrl(url)
}

export const hexToString = (hex) => {
  if (!hex.match(/^[0-9a-fA-F]+$/)) {
    throw new Error('is not a hex string.')
  }
  if (hex.length % 2 !== 0) {
    hex = '0' + hex
  }
  var str = ''
  for (var n = 0; n < hex.length; n += 2) {
    var code = parseInt(hex.substr(n, 2), 16)
    str += String.fromCharCode(code)
  }
  return str
}

export const isValidContract = async (chainTypeOrChainId, address) => {
  try {
    const rpcUrl = getRpcUrlByChain(chainTypeOrChainId)
    const client = createPublicClient({ transport: http(rpcUrl) })
    // viem returns undefined for an EOA (no code) and the bytecode hex for a contract
    const code = await client.getCode({ address })
    return !!code && code !== '0x'
  } catch (error) {
    return false
  }
}

// Read a token's { name, symbol, decimal } from an explicit RPC URL. Supports
// both string and legacy bytes32 name/symbol encodings (older tokens like MKR).
export async function getTokenName (protocolLink, contractAddress) {
  const client = createPublicClient({ transport: http(protocolLink) })
  const address = contractAddress
  const nullChar = String.fromCharCode(0)

  const stringAbi = [
    { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
    { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }
  ]
  const bytes32Abi = [
    { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
    { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }
  ]
  const decimalsAbi = [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }]

  const readDecimal = async () => {
    try {
      const d = await client.readContract({ address, abi: decimalsAbi, functionName: 'decimals' })
      return d != null ? Number(d) : 18
    } catch (e) {
      return 18
    }
  }

  try {
    const [name, symbol] = await Promise.all([
      client.readContract({ address, abi: stringAbi, functionName: 'name' }),
      client.readContract({ address, abi: stringAbi, functionName: 'symbol' })
    ])
    return { name, symbol, decimal: await readDecimal() }
  } catch (error) {
    // Fallback: bytes32-encoded name/symbol -> decode + trim null padding
    const [nameHex, symbolHex] = await Promise.all([
      client.readContract({ address, abi: bytes32Abi, functionName: 'name' }),
      client.readContract({ address, abi: bytes32Abi, functionName: 'symbol' })
    ])
    const nameFormat = viemHexToString(nameHex).split(nullChar)[0]
    const symbolFormat = viemHexToString(symbolHex).split(nullChar)[0]
    return { name: nameFormat || symbolFormat, symbol: symbolFormat, decimal: await readDecimal() }
  }
}

export const getRpcUrlByChain = (targetChainTypeOrChainId) => {
  try {
    const chainId = targetChainTypeOrChainId
    let rpcUrl = settings().rpcUrlByChainId?.[chainId]

    if (!rpcUrl) {
      const rpcInfo = getChainInfo(targetChainTypeOrChainId)
      rpcUrl = rpcInfo?.linkProvider
    }

    return rpcUrl
  } catch (error) {
    const chainId = targetChainTypeOrChainId
    const rpcInfo = getChainInfo(chainId)
    return rpcInfo?.linkProvider
  }
}

export const isArrayWithData = (arr, needToCheckNotEmpty = true) => {
  try {
    const isArray = arr && Array.isArray(arr)
    if (isArray) {
      if (needToCheckNotEmpty) {
        return arr.length > 0
      } else {
        return true
      }
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

export const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export const convertNFCPayloadTextToReadableText = (ndef) => {
  const text = Ndef.text.decodePayload(ndef.payload)
  return text
}

export const formatJsonRpcErrorForWalletConnectV2 = (payload, errorMessage) => {
  const { id } = payload
  return formatJsonRpcError(id, errorMessage || getSdkError('USER_REJECTED_METHODS').message)
}

export const checkNFCDataFormat = (nfcDataPayload, privateKeyHash) => {
  if (nfcDataPayload && nfcDataPayload.payload) {
    if (privateKeyHash && privateKeyHash.length > 0 && nfcDataPayload.tnf === 1) {
      const isHaveAddress = getAddressFromNFCData(privateKeyHash)
      const isHaveHashKey = getPrivateKeyHashFromNFCData(privateKeyHash)

      if (isHaveAddress && isHaveHashKey) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  } else {
    return false
  }
}

export const createNewWalletDataV2 = async (accountName) => {
  let currentAccountList = JSON.parse(JSON.stringify(ReduxService.getAccountList()))
  if (!Array.isArray(currentAccountList)) {
    currentAccountList = []
  }
  const defaultAccountName = accountName || I18n.t('v2.addAccount.normalAccount', { count: currentAccountList.length + 1 })

  const evmAccount = generateNewEvmAccount()
  const privateKeyEvm = evmAccount.privateKey

  // store private key to secure storage
  storePrivateKeyByAddress(evmAccount.address, privateKeyEvm)
  // delete private key from evmAccount
  delete evmAccount.privateKey

  // Freshly generated on-device key ⇒ hot account. Stamp at the source so the
  // badge shows immediately without waiting for the boot backfill.
  const accountData = { ...evmAccount, ...{ name: defaultAccountName, status: true, accountType: ACCOUNT_TYPE.HOT } }

  ReduxService.setAccountList([...currentAccountList, accountData])

  return accountData
}

export const getChainInfo = (chainId) => {
  try {
    const blockchainList = ReduxService.getBlockchainListRedux()
    const chainInfo = blockchainList?.[chainId]
    return chainInfo
  } catch (e) {
    return {}
  }
}

export const getDotColorFromAddress = (address) => {
  const stc = require('string-to-color')
  // need to have a random string to make color more different each address
  const randomString = 'zd4Jxx95Jp'
  const addressWithout0x = address ? address.replace('0x', '').toUpperCase() : ''
  const color = stc(randomString + addressWithout0x)
  return color
}

export const getAffiliateAddress = () => {
  return AFFILIATE_FEE_RECIPIENT
}

// Slug for app.uniswap.org's `?chain=` param. The interface also accepts a raw
// numeric chainId, which is what newer chains fall back to below — a wrong slug
// is worse than a number, because Uniswap silently resolves an unknown slug to
// Ethereum mainnet and the user is shown someone else's pool.
export const convertChainIdToUniswap = (chainId) => {
  switch (chainId) {
    case 1:
      return 'mainnet'

    case 56:
      return 'bnb'

    case 137:
      return 'polygon'

    case 10:
      return 'optimism'

    case 42161:
      return 'arbitrum'

    case 8453:
      return 'base'

    case 43114:
      return 'avalanche'

    case 130:
      return 'unichain'

    case 4663:
      return 'robinhood'

    default:
      return 'mainnet'
  }
}

export const convertChainIdToPancakeswap = (chainId) => {
  switch (chainId) {
    case 1:
      return 'eth'

    case 56:
      return 'bsc'

    case 137:
      return 'polygonZkEVM'

    // case 10:
    //    return 'optimism'
    //
    case 42161:
      return 'arb'

    case 8453:
      return 'base'

    case 59144:
      return 'linea'

    default:

      return 'eth'
  }
}

export const comparePrice = (price, priceOld) => {
  try {
    const tempPrice = isNaN(price) ? 0 : price
    const tempPriceOld = isNaN(priceOld) ? 0 : priceOld
    if (BigNumber(tempPrice).gt(tempPriceOld)) {
      return 'UP'
    } else if (BigNumber(tempPrice).lt(tempPriceOld)) {
      return 'DOWN'
    }
    return 'NO_CHANGE'
  } catch (error) {
    return 'NO_CHANGE'
  }
}

export const formatNameFunctionWC = (text) => {
  if (!text) return ''
  const arrayConst = ['NFT', 'ERC20', 'ERC721', 'TOKEN', 'NFT']
  const words = text.match(/[A-Z]+[^A-Z]*|[^A-Z]+/g)
  // Iterate over each word and convert it to title case
  const formattedWords = words.map(word => {
    // If the word is found in arrayConst, use it as is
    if (arrayConst.includes(word.toUpperCase())) {
      return word.toUpperCase()
    }
    // Otherwise, convert it to title case
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })

  // Join the formatted words with space and return
  return formattedWords.join(' ')
}

export const deepRemoveFields = (data, fieldsToRemove) => {
  try {
    // Convert single field to array
    const fields = Array.isArray(fieldsToRemove) ? fieldsToRemove : [fieldsToRemove]

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => deepRemoveFields(item, fields))
    }

    // Handle objects
    if (data !== null && typeof data === 'object') {
      return Object.entries(data).reduce((acc, [key, value]) => {
        // Skip if key is in fieldsToRemove
        if (fields.includes(key)) {
          return acc
        }

        // Recursively process nested objects/arrays
        acc[key] = deepRemoveFields(value, fields)
        return acc
      }, {})
    }

    // Return primitive values as is
    return data
  } catch (error) {
    return data
  }
}

export const removeSensitiveKeysFromString = (text) => {
  return (text || '')
    // EVM private key: 0x + 64 hex chars OR standalone 64 hex chars
    .replace(/(?:0x)?[A-Fa-f0-9]{64,}/g, '[REDACTED]')
    // Solana secret key: base58, 87-88 chars
    .replace(/[1-9A-HJ-NP-Za-km-z]{87,}/g, '[REDACTED]')
    // Bitcoin WIF key: starts with L, K, or 5, 51-52 base58 chars
    .replace(/[LK5][1-9A-HJ-NP-Za-km-z]{50,}/g, '[REDACTED]')
}

/**
 * User-facing text for an error coming out of the web3 stack.
 *
 * NEVER surface viem's `error.message`: it splices in `metaMessages`, which is
 * the full RPC URL — including the API key in the path of a paid endpoint — plus
 * the entire signed request body, none of which belongs on screen (screenshots
 * and support tickets would carry it).
 *
 * `details` (the node's own reason, e.g. "intrinsic gas too low") and
 * `shortMessage` (viem's one-liner) carry the part worth showing and neither
 * contains the URL. A plain non-viem Error has neither, and its `message` is
 * usually our own copy — worth keeping, hence the fallback.
 *
 * Everything still goes through removeSensitiveKeysFromString: that only strips
 * long key-shaped blobs (>= 64 hex), so it is a backstop, NOT the defence here —
 * an RPC API key is far shorter than that and would sail straight through it.
 *
 * @param {any} error     a viem error, a plain Error, or a string
 * @param {string} fallback shown when nothing usable could be extracted
 * @returns {string}
 */
export const formatWeb3Error = (error, fallback = '') => {
  // String-only picks. removeSensitiveKeysFromString does `(text || '').replace(...)`,
  // which THROWS on a truthy non-string — and this runs inside catch blocks, where
  // an exception would escape as an unhandled rejection and strand the UI mid-send.
  // A thrown object with a non-string `message`/`details` is unlikely but cheap to
  // rule out entirely.
  const pick = (value) => (typeof value === 'string' ? value : '')

  if (typeof error === 'string') return removeSensitiveKeysFromString(error) || fallback

  // `message` stays ahead of `error.error`, matching BOTH call sites this replaced,
  // so nothing but the viem case changes shape. A viem error never reaches it:
  // `details`/`shortMessage` are always set on BaseError and short-circuit first,
  // which is what keeps the RPC URL out.
  const text = pick(error?.details) ||
    pick(error?.shortMessage) ||
    pick(error?.message) ||
    pick(error?.error)

  return removeSensitiveKeysFromString(text) || fallback
}

export const cloneData = (data) => {
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    return data
  }
}
/**
 * Removes duplicate slashes from a URL path while preserving the protocol prefix (e.g., http:// or https://).
 *
 * @param {string} url - The raw URL string to be cleaned.
 * @returns {string} The sanitized URL with normalized slashes, or an empty string if input is falsy.
 *
 * @example
 * // returns "https://wallet-api.pantograph.app/token-list/all?chainId=8453"
 * sanitizeUrl("https://wallet-api.pantograph.app//token-list/all?chainId=8453");
 */
export function sanitizeUrl (url) {
  if (!url) return ''
  return url.replace(/([^:]\/)\/+/g, '$1')
}

export function formatInputNumberDecimal (value, decimal = 18) {
  if (!Number.isFinite(Number(value))) return value

  const str = value.toString()

  if (!str.includes('.')) {
    // No decimal part
    return value ? value?.slice(0, 18) : ''
  }

  const [integer, fraction] = str.split('.')
  return `${integer}.${fraction.slice(0, BigNumber(decimal).toNumber())}`
}
