import DeviceInfo from 'react-native-device-info'
import { REVIEW_URL_STATUS } from './constants/app'
import { chainType } from 'common/constants/chain'
import { handleOpenUrl, isURL } from './function'
import ReduxService from './redux'
import BaseAPI from 'controller/API/BaseAPI'
import I18n from 'assets/Lang'
import { getConnectorV2 } from './walletconnect'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import Clipboard from '@react-native-clipboard/clipboard'
import { Alert } from 'react-native'

/**
 * Return a list of fixed chain with init data
 *
 * @param {mixed} initItemData array|object|etc.
 * @returns object
 */
export const prepareDefaultFixedChainData = (initItemData = {}) => {
  let defaultFixedChainData = {}
  for (const chainKey in chainType) {
    defaultFixedChainData[chainType[chainKey]] = initItemData
    defaultFixedChainData = {
      ...defaultFixedChainData,
      [chainType[chainKey]]: initItemData
    }
  }

  return defaultFixedChainData
}

export const getWalletconnectSiteOfficalStatus = async (url) => {
  try {
    let siteStatus = 0
    const deviceID = DeviceInfo.getUniqueIdSync()
    const queryBody = {
      url: url,
      deviceID: deviceID
    }
    const infoReviewUrl = await BaseAPI.getData('keyring/site/assess', queryBody)
    const MAX_REVIEW_COUNT_TO_BELIEVE = 100

    if (infoReviewUrl && (infoReviewUrl.status === REVIEW_URL_STATUS.OFFICIAL || infoReviewUrl.status === REVIEW_URL_STATUS.NOT_OFFICIAL)) {
      siteStatus = infoReviewUrl.status
    } else if (infoReviewUrl && (infoReviewUrl.notOfficialCount >= MAX_REVIEW_COUNT_TO_BELIEVE || infoReviewUrl.officialCount >= MAX_REVIEW_COUNT_TO_BELIEVE)) {
      siteStatus = infoReviewUrl.notOfficialCount >= MAX_REVIEW_COUNT_TO_BELIEVE
        ? REVIEW_URL_STATUS.NOT_OFFICIAL
        : infoReviewUrl.officialCount >= MAX_REVIEW_COUNT_TO_BELIEVE
          ? REVIEW_URL_STATUS.OFFICIAL
          : 0
    } else if (infoReviewUrl && infoReviewUrl.deviceID && (infoReviewUrl.assessStatus !== undefined && infoReviewUrl.status === REVIEW_URL_STATUS.USER_NOT_REVIEW_YET)) {
      siteStatus = REVIEW_URL_STATUS.SERVER_NOT_REVIEW_YET
    } else {
      siteStatus = REVIEW_URL_STATUS.USER_NOT_REVIEW_YET
    }

    return siteStatus
  } catch (error) {
    return 0
  }
}

/**
 *
 * @param {object} requestData = item.params[0]
 * @param {boolean} showLabel need to show label in the case dectect contract method name or not
 * @returns string
 */
export const getWalletconnectRequestMethodName = (requestData, showLabel = false, optionNameDecoded = { nameFunctionDecodedData: '', forceGetMethodName: false }) => {
  if (requestData?.information?.type) {
    const WC_CUSTOM_METHOD_NAME = {
      APPROVE_FOR_CONVERTING: I18n.t('WalletConnect.methodName.aprroveForConverting'),
      APPROVE_FOR_PLAY_GACHA: I18n.t('WalletConnect.methodName.aprroveYoshimotokenForDailyBonus'),
      APPROVE_FOR_SEND: I18n.t('WalletConnect.methodName.aprroveYoshimotokenForSend'),
      APPROVE_FOR_PURCHASE: I18n.t('WalletConnect.methodName.aprroveYoshimotokenForPurchase'),
      SEND_DIRECT_NFT: I18n.t('WalletConnect.methodName.sendDirectNFT'),
      UNLOCK_NFT: I18n.t('WalletConnect.methodName.unlockYourItem'),
      SELL_NFT: I18n.t('WalletConnect.methodName.sellNFT'),
      BUY_NFT: I18n.t('WalletConnect.methodName.buyNFT'),
      PLAY_GACHA: I18n.t('WalletConnect.methodName.playGacha'),
      CHANGE_PRICE_NFT: I18n.t('WalletConnect.methodName.changePriceNFT'),
      RETRIEVE_NFT: I18n.t('WalletConnect.methodName.retrieveNFT'),
      CONFIRM_UNBOXING: I18n.t('WalletConnect.methodName.confirmUnboxing'),
      CONFIRM_UNPACKING: I18n.t('WalletConnect.methodName.confirmUnpacking'),
      APPROVE_UNPACKING: I18n.t('WalletConnect.methodName.approveUnpacking'),
      CONVERT_YOSHIMOTOKEN_GIFT_CARD: I18n.t('WalletConnect.methodName.convertGiftCard'),
      BUY_PACKAGE: I18n.t('WalletConnect.methodName.buyPackage'),
      APPROVE_FOR_PLAY_EXCHANGE_TICKET: I18n.t('WalletConnect.methodName.aprroveForExchangeTicket'),
      PLAY_EXCHANGE_TICKET: I18n.t('WalletConnect.methodName.playExchangeTicket'),
      CONFIRM_CREATE: I18n.t('WalletConnect.methodName.confirmCreation'),
      CONFIRM_REGISTER: I18n.t('WalletConnect.methodName.confirmRegister'),
      CONFIRM_TRANSFER: I18n.t('WalletConnect.methodName.confirmTransfer'),
      CONFIRM_REPLACE: I18n.t('WalletConnect.methodName.confirmReplace'),
      CONFIRM_APPROVE: I18n.t('WalletConnect.methodName.confirmApprove'),
      CONFIRM_CREATE_QR_CODE: I18n.t('WalletConnect.methodName.confirmCreationQRCode'),
      CONFIRM_UNLOCK_NFT: I18n.t('WalletConnect.methodName.confirmUnlockNFT'),
      CONFIRM_DISCARD: I18n.t('WalletConnect.methodName.confirmDiscard'),
      CONFIRM_OPEN_SCAN: I18n.t('WalletConnect.methodName.confirmOpenScan'),
      CONFIRM_PLAYING: I18n.t('WalletConnect.methodName.confirmPlaying'),
      SIGN_LISTING: I18n.t('WalletConnect.methodName.signListing'),
      SIGN_NFT_FOR_LISTING: I18n.t('WalletConnect.methodName.signNftForListing'),
      CLAIM_TOKEN: I18n.t('WalletConnect.methodName.claimToken'),
      MINT_NFT: I18n.t('WalletConnect.methodName.mintNFT'),
      SETTING_NFT_NAME: I18n.t('WalletConnect.methodName.settingNFTName'),
      CLAIM_NFT: I18n.t('WalletConnect.methodName.claimNFT'),
      CREATE: I18n.t('WalletConnect.methodName.create'),
      EDIT_PRICE: I18n.t('WalletConnect.methodName.editPrice'),
      EDIT_FEE: I18n.t('WalletConnect.methodName.editFee')
    }
    // return I18n.t('WalletConnect.methodName.confirmTransfer')
    return WC_CUSTOM_METHOD_NAME?.[requestData?.information?.type] || I18n.t('WalletConnect.confirmProcess')
  } else {
    // **** GET CONTRACT METHOD NAME ****
    let contractMethodName = ''
    if (requestData?.data === '0x' || !requestData?.data || requestData?.data === '') {
      contractMethodName = ''
    } else if (requestData?.contractMethodName) {
      contractMethodName = requestData.contractMethodName.toUpperCase()
    } else if (optionNameDecoded?.forceGetMethodName && optionNameDecoded?.nameFunctionDecodedData) {
      contractMethodName = optionNameDecoded.nameFunctionDecodedData.toUpperCase()
    } else {
      contractMethodName = I18n.t('Initial.unknow')
    }

    if (showLabel) {
      return contractMethodName
        ? `${contractMethodName}`
        : I18n.t('WalletConnect.processingMethod')
    } else {
      return contractMethodName
    }
  }
}

export const getWalletconnectRequestAddressForCheckMalicious = (requestData, functionDecodedData) => {
  const listAddressForCheckMalicious = []
  // address from: request to address
  if (requestData.params?.[0]?.to) {
    listAddressForCheckMalicious.push(requestData.params[0].to)
  }

  // address from functionDecodedData
  (functionDecodedData?.types || []).forEach((type, index) => {
    if (type === 'address') {
      let address = functionDecodedData?.inputs?.[index] || ''
      address = address.startsWith('0x') ? address : `0x${address}`
      listAddressForCheckMalicious.push(address)
    }
  })
  return [...new Set(listAddressForCheckMalicious)]
}

export const switchToNewChainV2 = async (
  walletConnectIndex,
  selectedAccountArrEip155,
  selectedNetworkObj,
  selectedAccountInfoArr,
  chainIdArr = [],
  callbackOnDone,
  callbackOnError
) => {
  try {
    const wcWeb3Wallet = await getConnectorV2()
    const walletConnectRedux = ReduxService.getReduxDataByKey('walletConnectRedux')
    const walletConnectItem = walletConnectRedux[walletConnectIndex]
    const currentNamespace = walletConnectItem.currentNamespace
    const authNamespace = walletConnectItem?.session?.namespaces?.eip155
    const currentEip155 = currentNamespace?.supportedNamespaces?.eip155 || authNamespace

    const newChainEip155Support = chainIdArr.map((chainId) => {
      return `eip155:${chainId}`
    })

    const newNamespace = {
      ...currentNamespace,
      supportedNamespaces: {
        eip155: {
          chains: [
            ...currentEip155.chains,
            ...newChainEip155Support
          ],
          accounts: [
            ...currentEip155.accounts,
            ...selectedAccountArrEip155
          ],
          methods: [...currentEip155.methods],
          events: [...currentEip155.events]
        }
      }
    }
    // Updated walletConnectRedux for walletConnectItem
    walletConnectItem.currentNamespace = { ...newNamespace }
    walletConnectItem.chainArray = [...walletConnectItem.chainArray, ...newChainEip155Support]
    walletConnectItem.accountArr = [...walletConnectItem.accountArr, ...selectedAccountArrEip155]
    walletConnectItem.accountArrInfo = [...walletConnectItem.accountArrInfo, ...selectedAccountInfoArr]
    walletConnectItem.supportedNetwork = { ...walletConnectItem.supportedNetwork, ...selectedNetworkObj }

    walletConnectRedux[walletConnectIndex] = { ...walletConnectItem }

    ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect([...walletConnectRedux]))

    await wcWeb3Wallet.updateSession({
      topic: walletConnectItem.topic,
      namespaces: { ...newNamespace.supportedNamespaces }
    })

    await wcWeb3Wallet.emitSessionEvent({
      topic: walletConnectItem.topic,
      event: {
        name: 'accountsChanged',
        data: selectedAccountInfoArr.map(account => account.address)
      },
      chainId: newChainEip155Support?.[0]
    })

    callbackOnDone && callbackOnDone()
  } catch (error) {
    callbackOnError && callbackOnError()
  }
}

export const removeCallRequest = (walletconnectIndex, request, removeCurrentCallRequest = true) => {
  const callRequestRedux = ReduxService.getReduxDataByKey('callRequestRedux', [])
  const callRequestReduxClone = callRequestRedux.slice()

  callRequestReduxClone[walletconnectIndex] = callRequestRedux[walletconnectIndex].filter(requestItem => { return requestItem.id !== request.id })
  ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestReduxClone))

  if (removeCurrentCallRequest) {
    ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
  }
}

/**
 *
 * @param {number} walletconnectIndex 0 | 1 | 2 | etc.
 * @param {object} addressEip155FromRequest // Ex: eip155:1:0xb8b64a283394855cd61d5e4229aee7276b2f55e2
 * @returns {object} account info from accountListRedux
 */
export const getAccountInfoByRequest = (walletconnectIndex, addressEip155FromRequest) => {
  const walletConnectRedux = ReduxService.getReduxDataByKey('walletConnectRedux', [])
  let accountInfo

  if (walletConnectRedux?.[walletconnectIndex]?.accountArrInfo && walletConnectRedux?.[walletconnectIndex]?.accountArr) {
    let findIndexByAddressNamespace = -1
    walletConnectRedux[walletconnectIndex].accountArr.forEach((accountNamespace, index) => {
      if (accountNamespace.toLowerCase() === addressEip155FromRequest.toLowerCase()) {
        findIndexByAddressNamespace = index
      }
    })
    accountInfo = walletConnectRedux[walletconnectIndex].accountArrInfo[findIndexByAddressNamespace]
  }

  return accountInfo
}

/**
 *
 * @param {number} chainId
 * @returns chain icon
 */
export const getChainIconByChain = (chainId) => {
  try {
    const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')
    return blockchainListRedux?.[chainId]?.icon || ''
  } catch (error) {
    return ''
  }
}
/**
 *
 * @param {number} chainId
 * @returns chain name
 */
export const getChainNameByChain = (chainId) => {
  try {
    const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')
    return blockchainListRedux?.[chainId]?.name || ''
  } catch (error) {
    return ''
  }
}

export const getNativeTokenSymbolByChain = (chainId) => {
  try {
    const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')
    return blockchainListRedux?.[chainId]?.nativeCurrency?.symbol || 18
  } catch (error) {
    return ''
  }
}

export const getNativeTokenDecimalByChain = (chainId) => {
  try {
    const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')
    return blockchainListRedux?.[chainId]?.nativeCurrency?.decimals || ''
  } catch (error) {
    return ''
  }
}

export const handleOpenExplorerUserAddress = (userAddress, chainId) => {
  const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')

  const linkScan = blockchainListRedux?.[chainId]?.linkScan

  if (linkScan) {
    handleOpenUrl(`${linkScan}/${userAddress}`.replace(/\/\//g, '/'))
  } else {
    Clipboard.setString(userAddress)
    Alert.alert(I18n.t('Initial.copyDone', { value: 'Address' }))
  }
}

export const handleOpenExplorerHash = (txHash, chainTypeOrChainId) => {
  if (isURL(txHash)) {
    handleOpenUrl(txHash)
    return
  }

  const linkScanHash = getUrlExplorerHash(txHash, chainTypeOrChainId)

  if (linkScanHash) {
    handleOpenUrl(linkScanHash)
  } else {
    Clipboard.setString(txHash)
    Alert.alert(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }))
  }
}

export const getUrlExplorerHash = (txHash, chainId) => {
  const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')
  let linkScanHash = blockchainListRedux?.[chainId]?.linkScanHash || ''

  if (linkScanHash) {
    linkScanHash = linkScanHash + '/' + txHash
  }

  return linkScanHash.replace(/\/\//g, '/')
}

export const handleCopyExplorerHash = (chainTypeOrChainId, txHash, showAlertFunc) => {
  Clipboard.setString(getUrlExplorerHash(txHash, chainTypeOrChainId))
  showAlertFunc && showAlertFunc(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), '', { type: 'toast' })
}
