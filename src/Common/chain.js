import DeviceInfo from 'react-native-device-info'
import { REVIEW_URL_STATUS } from './constants/app'
import { chainType, SUPPORTED_BLOCKCHAIN_DATA } from 'common/constants/chain'
import { formatJsonRpcErrorForWalletConnectV2, handleOpenUrl, isURL, lowerCase } from './function'
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

/**
 * Replace the account a WalletConnect V2 session is connected with.
 *
 * V2 binds a session to exactly ONE account, so this SWAPS the address on every
 * chain of the session (the old account is dropped, not kept alongside):
 *   1. `updateSession` rewrites namespaces.eip155.accounts (the source of truth),
 *   2. `accountsChanged` is emitted per chain so the dApp reacts without a reconnect.
 * Chains / methods / events are left exactly as approved, so the session keeps
 * satisfying the proposal's requiredNamespaces.
 *
 * Pending requests were addressed to the OLD address and can never be signed once
 * it is gone, so they are rejected and cleared.
 *
 * Note: `accountsChanged` is best-effort — a dApp that only reads accounts at
 * connect time needs a page reload to pick the new one up.
 *
 * @param {number} walletConnectIndex index of the session in walletConnectRedux
 * @param {object} newAccount account from accountListRedux (needs `address`)
 * @param {Function} [callbackOnDone]
 * @param {Function} [callbackOnError]
 */
export const switchAccountV2 = async (
  walletConnectIndex,
  newAccount,
  callbackOnDone,
  callbackOnError
) => {
  try {
    const address = newAccount?.address
    const walletConnectRedux = ReduxService.getReduxDataByKey('walletConnectRedux', [])
    const walletConnectItem = walletConnectRedux?.[walletConnectIndex]

    if (!address || !walletConnectItem) {
      throw new Error('switchAccountV2: missing account or session')
    }

    const wcWeb3Wallet = await getConnectorV2()
    const currentNamespace = walletConnectItem.currentNamespace
    const authNamespace = walletConnectItem?.session?.namespaces?.eip155
    const currentEip155 = currentNamespace?.supportedNamespaces?.eip155 || authNamespace
    // Keep the approved chains untouched — only the account changes. chainArray is
    // the fallback for sessions stored before currentNamespace existed.
    const chains = (currentEip155?.chains?.length > 0 ? currentEip155.chains : walletConnectItem.chainArray) || []

    if (chains.length === 0) {
      throw new Error('switchAccountV2: session has no eip155 chain')
    }

    const accountArr = chains.map((chain) => `${chain}:${address}`)
    const accountArrInfo = chains.map(() => ({ address }))
    const newNamespace = {
      ...currentNamespace,
      supportedNamespaces: {
        eip155: {
          chains: [...chains],
          accounts: accountArr,
          methods: [...(currentEip155?.methods || [])],
          events: [...(currentEip155?.events || [])]
        }
      }
    }

    // Tell the dApp FIRST: if the session is already dead, redux must not be left
    // pointing at an account the dApp never received.
    await wcWeb3Wallet.updateSession({
      topic: walletConnectItem.topic,
      namespaces: { ...newNamespace.supportedNamespaces }
    })

    // EIP-1193 accountsChanged, one emit per chain — a dApp only listens on the
    // chain it is currently on and we don't know which one that is. One chain
    // rejecting the event must not abort the switch.
    for (const chain of chains) {
      try {
        await wcWeb3Wallet.emitSessionEvent({
          topic: walletConnectItem.topic,
          event: {
            name: 'accountsChanged',
            data: [address]
          },
          chainId: chain
        })
      } catch (error) {
        // do nothing
      }
    }

    const walletConnectReduxClone = walletConnectRedux.slice()
    walletConnectReduxClone[walletConnectIndex] = {
      ...walletConnectItem,
      accountArr,
      accountArrInfo,
      // Binds the session to the new account — the connected-dApps list is
      // filtered by this address.
      accountAddress: lowerCase(address),
      currentNamespace: newNamespace,
      // Keep the stored session snapshot in sync (it is the fallback namespace
      // source for sessions restored from storage).
      session: authNamespace
        ? {
          ...walletConnectItem.session,
          namespaces: {
            ...walletConnectItem.session.namespaces,
            eip155: {
              ...authNamespace,
              accounts: accountArr
            }
          }
        }
        : walletConnectItem.session
    }
    ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect(walletConnectReduxClone))

    await rejectPendingRequestsV2(walletConnectIndex, wcWeb3Wallet)

    callbackOnDone && callbackOnDone()
  } catch (error) {
    callbackOnError && callbackOnError(error)
  }
}

/**
 * Reject + clear every pending request of one session. Used when the connected
 * account changes: those requests name the old address, so nothing can sign them.
 *
 * @param {number} walletConnectIndex index of the session in walletConnectRedux
 * @param {object} wcWeb3Wallet the WalletKit instance from getConnectorV2()
 */
const rejectPendingRequestsV2 = async (walletConnectIndex, wcWeb3Wallet) => {
  const callRequestRedux = ReduxService.getReduxDataByKey('callRequestRedux', [])
  const pendingRequests = callRequestRedux?.[walletConnectIndex] || []

  if (pendingRequests.length === 0) return

  for (const request of pendingRequests) {
    try {
      await wcWeb3Wallet.respondSessionRequest({
        topic: request.topic,
        response: formatJsonRpcErrorForWalletConnectV2(request)
      })
    } catch (error) {
      // Already answered / expired — drop it from redux anyway.
    }
  }

  const callRequestReduxClone = callRequestRedux.slice()
  callRequestReduxClone[walletConnectIndex] = []
  ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestReduxClone))
  ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
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

/**
 * Does this chain have a native coin at all?
 *
 * True everywhere except the handful of chains that charge gas in an ERC20
 * stablecoin and have no native asset (Tempo/4217 — see the note on its entry
 * in constants/chain). On those, `eth_getBalance` returns a meaningless
 * sentinel, so anything derived from a native balance (the balance row, the
 * "not enough for the fee" check) has to be skipped rather than shown.
 *
 * Source order — the API answer wins, the bundled constant is the fallback:
 *   1. blockchainListRedux, but ONLY when it holds a real boolean. That is the
 *      live copy, so a chain the API later flags is picked up without an app
 *      update.
 *   2. SUPPORTED_BLOCKCHAIN_DATA. Needed because redux is PERSISTED and
 *      refeshBlockChainList only re-pins the icon on entries that already
 *      exist: a user who already has the chain stored keeps an entry with no
 *      such field, and reading redux alone would silently answer "has native".
 *
 * @param {number|string} chainId
 * @returns {boolean}
 */
export const hasNativeTokenByChain = (chainId) => {
  const fromRedux = ReduxService.getReduxDataByKey('blockchainListRedux')?.[chainId]?.hasNativeToken
  if (typeof fromRedux === 'boolean') return fromRedux
  return SUPPORTED_BLOCKCHAIN_DATA[Number(chainId)]?.hasNativeToken !== false
}

/**
 * Can `contractAddress` pay the gas fee on this chain?
 *
 * Only meaningful on chains that charge gas in a token (see
 * hasNativeTokenByChain). Tempo restricts it to TIP-20 tokens whose currency is
 * USD — a transfer of anything else is charged to the protocol default instead,
 * so "not in the list" must NOT be read as "this token pays".
 *
 * Same source order as hasNativeTokenByChain: the live API copy wins, the
 * bundled constant covers users whose persisted entry predates the field.
 *
 * @param {number|string} chainId
 * @param {string} contractAddress
 * @returns {boolean}
 */
export const isFeeTokenByChain = (chainId, contractAddress) => {
  if (!contractAddress) return false
  // A NON-EMPTY array is the live answer; `[]` is treated as no answer and falls
  // back to the constant. The API merge keeps arrays verbatim (only null and
  // blank strings are stripped), so an empty one is far more likely to be a
  // field the backend hasn't filled in than a real "nothing may pay fees here".
  const fromRedux = ReduxService.getReduxDataByKey('blockchainListRedux')?.[chainId]?.feeTokens
  const list = Array.isArray(fromRedux) && fromRedux.length > 0
    ? fromRedux
    : SUPPORTED_BLOCKCHAIN_DATA[Number(chainId)]?.feeTokens
  if (!Array.isArray(list)) return false
  const address = contractAddress.toLowerCase()
  return list.some((item) => `${item}`.toLowerCase() === address)
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
    handleOpenUrl(`${linkScan}/${userAddress}`.replace(/([^:]\/)\/+/g, '$1'))
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

  // Collapse duplicate slashes in the path but keep the `://` after the scheme
  return linkScanHash.replace(/([^:]\/)\/+/g, '$1')
}

export const handleCopyExplorerHash = (chainTypeOrChainId, txHash, showAlertFunc) => {
  Clipboard.setString(getUrlExplorerHash(txHash, chainTypeOrChainId))
  showAlertFunc && showAlertFunc(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), '', { type: 'toast' })
}
