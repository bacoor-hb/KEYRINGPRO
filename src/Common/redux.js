import PageReduxAction from 'controller/Redux/actions/pageAction'
import I18n from 'assets/Lang'
import storeRedux from 'controller/Redux/store/configureStore'
import initState from 'controller/Redux/lib/initState'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler'
import {
  jsonStr2Obj,
  formatJsonRpcErrorForWalletConnectV2,
  isArrayWithData,
  debugInfo,
  lowerCase,
  isValidEVMAddressFormat,
  removeSensitiveKeysFromString,
  cloneData
} from './function'
import DeviceInfo from 'react-native-device-info'
import Keys from 'react-native-keys'
import FormData from 'form-data'
import RNRestart from 'react-native-restart'
import moment from 'moment'
import Sound from 'react-native-sound'
import sounds from 'assets/Sound'
import '@walletconnect/react-native-compat'

import {
  NFT_TYPE_MAP
} from 'common/constants/app'
import {
  chainType,
  SUPPORTED_BLOCKCHAIN_DATA
} from 'common/constants/chain'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { Vibration } from 'react-native'
import BaseAPI from 'controller/API/BaseAPI'
import NagemonAPI from 'controller/API/NagemonAPI'
// eslint-disable-next-line import/no-duplicates
import { getSdkError } from '@walletconnect/utils'
import { formatJsonRpcResult } from '@json-rpc-tools/utils'
import { removeCallRequest } from './chain'
import { resetSuggestions } from './aiSearchHistory'
import { getConnectorV2, redirectBackToDapp } from './walletconnect'
import { ethers } from 'ethers'
import { hexToBigInt } from 'viem'
import { NavigationActions } from 'src/navigation/NavigationService'
import { clearSecureStorage } from './storage/secureStorage'
import { clearSavedPassword } from './keychain'
import { NAME_SCREEN } from './constants/navigation'
import { getWcRequestsOpener } from './walletConnectPending'
import { createRef } from 'react'

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true
}
export default class ReduxService {
  static refLayoutContainerDefault = createRef(null)
  static refLayoutHeaderAnchorDefault = createRef(null)
  static refLayoutContainer = createRef(null)
  static refLayoutHeaderAnchor = createRef(null)

  static resetChainIdByAddressScreen (chainId) {
    const reduxData = storeRedux.getState()
    const { activeAccount } = reduxData
    const activeAccountTemp = cloneData(activeAccount)
    if (activeAccountTemp?.chainIdScreen) {
      Object.keys(activeAccountTemp.chainIdScreen).forEach(key => {
        if (activeAccountTemp.chainIdScreen[key]?.toString() === chainId?.toString()) {
          delete activeAccountTemp.chainIdScreen[key]
        }
      })
      ReduxService.callDispatchAction(StorageReduxAction.setActiveAccount(activeAccountTemp))
    }
  }

  static setChainIdByAddressScreen (chainId, nameScreen) {
    let chainIdByAddressScreenTemp = {}
    const reduxData = storeRedux.getState()
    const { activeAccount } = reduxData
    const activeAccountTemp = cloneData(activeAccount)
    const { chainIdScreen, account } = activeAccount

    if (account) {
      const { address } = account
      if (chainIdScreen) {
        chainIdByAddressScreenTemp = { ...chainIdScreen }
      }

      chainIdByAddressScreenTemp[address + '_' + nameScreen] = chainId
      activeAccountTemp.chainIdScreen = chainIdByAddressScreenTemp
      ReduxService.callDispatchAction(StorageReduxAction.setActiveAccount(activeAccountTemp))
    }
  }

  static getChainIdByAddressScreen (nameScreen, defaultChainId = 1) {
    const reduxData = storeRedux.getState()
    const { activeAccount } = reduxData
    const { chainIdScreen, account } = activeAccount
    if (account) {
      const { address } = account
      if (chainIdScreen) {
        if (chainIdScreen[address + '_' + nameScreen]) {
          return chainIdScreen[address + '_' + nameScreen]
        }
      }
    }
    return defaultChainId
  }

  static setActiveAccount (account) {
    const reduxData = storeRedux.getState()
    const { activeAccount, accountListRedux } = reduxData
    const activeAccountTemp = cloneData(activeAccount)

    const indexAccount = accountListRedux.findIndex((item) => item.address === account.address)

    activeAccountTemp.account = {
      ...account,
      indexAccount
    }
    activeAccountTemp.indexAccount = indexAccount
    ReduxService.callDispatchAction(StorageReduxAction.setActiveAccount(activeAccountTemp))
  }

  static getReduxDataByKey (key, defaultValue) {
    try {
      const reduxData = storeRedux.getState()
      return reduxData?.[key] === undefined ? defaultValue : reduxData[key]
    } catch (error) {
      return defaultValue
    }
  }

  static async resetReduxData (isResetWallet = false) {
    const dataReset = async (isResetWallet) => {
      const storageRedux = [
        { action: StorageReduxAction.setWalletConnect, init: initState.arrInit.slice() },
        { action: StorageReduxAction.setCallRequest, init: initState.arrInit.slice() },
        { action: StorageReduxAction.setCurrentCallRequest, init: initState.nullInit },
        { action: StorageReduxAction.setActiveAccount, init: initState.activeAccount }
      ]
      if (isResetWallet) {
        storageRedux.push({ action: StorageReduxAction.setBlockChainList, init: initState.blockchainList })
        storageRedux.push({ action: StorageReduxAction.setAccountList, init: initState.arrInit.slice() })
        // try to reset all data
        storageRedux.push({ action: StorageReduxAction.setCurrency, init: initState.currencyInit })
        storageRedux.push({ action: StorageReduxAction.setFiatRate, init: initState.fiatRate })
        storageRedux.push({ action: StorageReduxAction.setTokenJWT, init: initState.nullInit })
        storageRedux.push({ action: StorageReduxAction.setGasPriceSlideValue, init: initState.gasPriceSlideValue })
        storageRedux.push({ action: StorageReduxAction.setAddressRegisteredLiquidity, init: initState.addressRegisteredLiquidity })
        storageRedux.push({ action: StorageReduxAction.setAddressDeletedLiquidity, init: initState.addressDeletedLiquidity })
        storageRedux.push({ action: StorageReduxAction.setAddressBookHistory, init: initState.arrInit })
        storageRedux.push({ action: StorageReduxAction.setAddressBookInfo, init: initState.objInit })
        storageRedux.push({ action: StorageReduxAction.setMigrationFlags, init: initState.migrationFlags })
        storageRedux.push({ action: StorageReduxAction.setActiveEvmChainIds, init: initState.activeEvmChainIds })
        storageRedux.push({ action: StorageReduxAction.setAccountTokenList, init: initState.accountTokenList })
        storageRedux.push({ action: StorageReduxAction.setAiSearchHistory, init: initState.aiSearchHistory })
        // The threads are gone, so no thread can still be "dismissed" — the pills
        // must be back up the next time AI Search is opened.
        resetSuggestions()
        storageRedux.push({ action: StorageReduxAction.setNotificationReadIds, init: initState.arrInit })
        storageRedux.push({ action: StorageReduxAction.setNotificationList, init: initState.arrInit })
      }

      // remove all data in SecureStorage
      try {
        clearSecureStorage()
      } catch (error) {
        // error clearing secure storage
      }

      await Promise.all(storageRedux.map((itm) => {
        ReduxService.callDispatchAction(itm.action(itm.init))
      }))
    }
    try {
      await dataReset(isResetWallet)
      setTimeout(() => {
        ReduxService.setAppSettings()
      }, 1000)
    } catch (error) {
      // error
    }
  }

  static async restoreWallet () {
    try {
      await clearSavedPassword()
      await ReduxService.resetReduxData(true)
      NavigationActions.reset(NAME_SCREEN.welcome)
    } catch (error) {
      await clearSavedPassword()
      await ReduxService.resetReduxData(true)
      RNRestart.Restart()
    }
  }

  static async disconnectAllWalletConnect () {
    const { walletConnectRedux } = storeRedux.getState()
    const walletConnectTemp = walletConnectRedux.slice()
    try {
      ReduxService.callDispatchAction(StorageReduxAction.setCallRequest([]))

      walletConnectTemp.forEach(async (item, index) => {
        if (item && item.isWalletConnectV2) {
          // walletconnect v2
          item.connector.disconnectSession({
            topic: item.session.topic,
            reason: getSdkError('USER_REJECTED_METHODS')
          })
          // Trying to disconnect all current pairing
          const connectorV2 = await getConnectorV2()
          if (connectorV2) {
            // Returns an array of all existing pairings.
            const pairings = connectorV2.core.pairing.getPairings()
            if (isArrayWithData(pairings)) {
              pairings.forEach(async (pairing) => {
                // Disconnects/Removes a pairing, by providing the pairing topic.
                await connectorV2.core.pairing.disconnect({ topic: pairing.topic })
              })
            }
          }
        }
      })

      ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect([]))
    } catch (_error) {
      ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect([]))
      ReduxService.callDispatchAction(StorageReduxAction.setCallRequest([]))
      return null
    }
  }

  static async disconnectWalletConnectV2 (topic = '', isNeedDiconnectSession = false) {
    const { walletConnectRedux, callRequestRedux } = storeRedux.getState()
    const walletConnectTemp = walletConnectRedux.slice()
    const callRequestTemp = callRequestRedux.slice()

    try {
      let accountIndex = 0
      const findConnector = walletConnectTemp.filter((item, index) => {
        if (item?.session.topic === topic) {
          accountIndex = index

          return true
        }
      })
      if (findConnector?.[0]) {
        walletConnectTemp.splice(accountIndex, 1)
        callRequestTemp.splice(accountIndex, 1)

        ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect(walletConnectTemp))
        ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestTemp))

        if (isNeedDiconnectSession) {
          const connectorV2 = await getConnectorV2()
          const activeSessions = connectorV2.getActiveSessions()

          // disconnect session
          if (activeSessions?.[topic]) {
            await connectorV2.disconnectSession({
              topic: topic,
              reason: getSdkError('USER_DISCONNECTED')
            })
          }

          // disconnect pairing
          await connectorV2.core.pairing.disconnect({ topic: findConnector[0].pairingTopic })
        }
      }
    } catch (_error) {
      // logDebug('----------------------------disconnectWalletConnectV2 - err----------------------------')
      // logDebug(_error?.message)
      // logDebug('----------------------------')
      return null
    }
  }

  /// ..... //
  static async addCallRequestWalletConnectV2 (payload, needAddWalletAccountIfNotExist = true) {
    const { walletConnectRedux, callRequestRedux, stopAddingRequestRedux } = storeRedux.getState()
    const callRequestReduxTemp = callRequestRedux.slice()
    const walletConnectReduxClone = walletConnectRedux.slice()
    let formatedPayload = {
      ...payload,
      createAt: new Date(),
      createAtUTC: moment().utc()
    }

    debugInfo('addCallRequestWalletConnectV2', { payload })

    const playSound = (mp3Link) => {
      try {
        Sound.setCategory('Ambient')
        // sound && sound.stop()
        const sound = new Sound(mp3Link, (e) => {
          if (!e) {
            sound.setVolume(0.7).play(success => {
              success && sound.release()
            })
          }
        })
      } catch (error) {
        // do nothing
      }
    }
    if (!stopAddingRequestRedux) {
      ReduxService.callDispatchAction(StorageReduxAction.setStopAddingRequest(true))

      try {
        let accountIndex = 0
        const findWalletConnect = walletConnectReduxClone.filter((item, index) => {
          if (item?.session.topic === payload.topic) {
            accountIndex = index

            return true
          }
        })
        let isRequestExisted = false

        if (findWalletConnect?.[0]?.connector) {
          const walletConnectItem = { ...findWalletConnect[0] }

          if (callRequestReduxTemp.length > 0 && callRequestReduxTemp[accountIndex]) {
            isRequestExisted = callRequestReduxTemp[accountIndex].some(item => {
              return item.id === payload.id
            })
          }

          if (!isRequestExisted) {
            const methodFromRequest = payload?.params?.request?.method || ''
            const chainIdFromRequest = payload?.params?.chainId || ''
            const paramsFromRequest = payload?.params?.request?.params?.[0]

            // EIP155
            if (
              ['transaction_sign', 'eth_sendTransaction', 'eth_signTransaction'].includes(methodFromRequest)
            ) {
              const paramData = paramsFromRequest.data
              const splitData = paramData.split('--')

              let txData = splitData[2] || splitData[0]

              if (!(txData || '').startsWith('0x')) {
                txData = '0x' + txData
              }

              formatedPayload = {
                id: payload.id,
                topic: payload.topic,
                method: methodFromRequest,
                chainId: chainIdFromRequest.split(':')[1],
                namespace: chainIdFromRequest.split(':')[0],
                addressAccount: paramsFromRequest.from,
                params: [
                  {
                    ...paramsFromRequest,
                    data: txData,
                    information: jsonStr2Obj(splitData[1]) || {},
                    createAt: new Date(),
                    createAtUTC: moment().utc(),
                    gasLimit: paramsFromRequest.gas
                  }
                ]
              }

              if (paramData !== '0x' && paramData !== '' && chainIdFromRequest.split(':')[1]) {
                const dataTx = paramsFromRequest.data || '0x'
                formatedPayload.forceGetMethodName = true
                formatedPayload.dataTx = dataTx
              }
            } else if (['personal_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4'].includes(methodFromRequest)) {
              formatedPayload = {
                ...formatedPayload,
                method: methodFromRequest,
                topic: payload.topic,
                id: payload.id,
                addressAccount: (
                  isValidEVMAddressFormat(payload.params.request.params[0])
                    ? payload.params.request.params[0]
                    : isValidEVMAddressFormat(payload.params.request.params[1])
                      ? payload.params.request.params[1]
                      : ''
                )
              }

              if (chainIdFromRequest.includes('eip155')) {
                formatedPayload.chainId = chainIdFromRequest.split(':')[1]
                formatedPayload.namespace = chainIdFromRequest.split(':')[0]
              }
            } else if (['wallet_addEthereumChain', 'wallet_switchEthereumChain'].includes(methodFromRequest)) {
              formatedPayload = {
                ...formatedPayload,
                chainId: (
                  ethers.utils.isHexString(paramsFromRequest.chainId)
                    ? hexToBigInt(paramsFromRequest.chainId).toString()
                    : paramsFromRequest.chainId
                ),
                method: methodFromRequest,
                topic: payload.topic,
                id: payload.id,
                addressAccount: ''
              }
              if (chainIdFromRequest.includes('eip155')) {
                formatedPayload.namespace = chainIdFromRequest.split(':')[0]
              }
            }

            if (callRequestReduxTemp && callRequestReduxTemp[accountIndex]) {
              callRequestReduxTemp[accountIndex].push(formatedPayload)
            } else {
              callRequestReduxTemp.push([formatedPayload])
            }

            ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestReduxTemp))

            playSound(sounds.iphoneNotification)
            ReactNativeHapticFeedback.trigger('notificationSuccess', options)
            Vibration.vibrate()

            try {
              // Open the request in the NEW requests drawer hosted by the global
              // WalletConnectRequestHost overlay — it shows over WHATEVER screen
              // the user is on, no navigation. (Not the legacy
              // manageRequestScreenV2.)
              const topic = walletConnectItem?.session?.topic
              if (topic) {
                getWcRequestsOpener()?.(topic)
              }
            } catch (e) {
              //
            }

            // this.handleCheckShouldApproveRequest(formatedPayload, accountIndex)
          }
        }
        setTimeout(() => {
          ReduxService.callDispatchAction(StorageReduxAction.setStopAddingRequest(false))
        }, 1500)
      } catch (_error) {
        ReduxService.callDispatchAction(StorageReduxAction.setStopAddingRequest(false))
        return null
      }
    }
  }

  static async rejectRequestWalletConnect (payload, accountIndex = 0, messageInput = '', showAlert = null) {
    const { walletConnectRedux } = storeRedux.getState()
    try {
      if (walletConnectRedux?.[accountIndex]) {
        removeCallRequest(accountIndex, payload, false)
        if (walletConnectRedux[accountIndex].isWalletConnectV2) {
          const connector = await getConnectorV2()
          const response = formatJsonRpcErrorForWalletConnectV2(payload)
          await connector.respondSessionRequest({
            topic: payload.topic,
            response: response
          })
        }

        if (walletConnectRedux[accountIndex].isFromDeepLink) {
          redirectBackToDapp(showAlert)
        }
      }
    } catch (_error) {
      removeCallRequest(accountIndex, payload)
      return null
    }
  }

  static getAppSettingByKey (key, defaultValue = '') {
    const { settingsRedux } = storeRedux.getState()
    if (settingsRedux && settingsRedux.others && settingsRedux.others[key]) {
      return settingsRedux.others[key]
    } else {
      return defaultValue
    }
  }

  static async handleConnection (connection) {
    // "Online" = the network interface is up, nothing more. We deliberately do
    // NOT look at `isInternetReachable`: that flag is the result of a probe that
    // reports false-negatives on every background/resume cycle (iOS kills the
    // in-flight probe when the app is suspended, Android revokes
    // NET_CAPABILITY_VALIDATED / NOT_SUSPENDED while dozing), which showed the
    // offline icon on a perfectly working connection.
    const isOnline = !!connection && connection.isConnected !== false

    // Offline is surfaced inline where it matters (e.g. TokenList balance),
    // so we only keep the redux flag up to date here.
    ReduxService.callDispatchAction(PageReduxAction.setInternet(isOnline))
  }

  // Tracking crash app and send report
  static async activeCrashReport () {
    try {
      setJSExceptionHandler(this.exceptionhandler, false)
      setNativeExceptionHandler((errorString) => this.exceptionhandler(errorString, null, true), ISIOS)
    } catch (_error) {
      return null
    }
  }

  // Post a message to the internal ChatWork crash/debug room.
  // Token + room id are injected from keys.release.json (react-native-keys) so
  // they never live in source. Public / OSS builds ship placeholder keys, so
  // this becomes a no-op there instead of leaking or failing.
  static async sendChatworkMessage (body) {
    try {
      const token = Keys.secureFor('SERVICE_CHATWORK_API_TOKEN')
      const roomId = Keys.secureFor('SERVICE_CHATWORK_ROOM_ID')
      // Skip when not configured (placeholder values start with "your_").
      if (!token || !roomId || token.startsWith('your_')) return

      const formData = new FormData()
      formData.append('body', body)

      await fetch(`https://api.chatwork.com/v2/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-ChatWorkToken': token
        },
        body: formData
      })
    } catch {
      // Best-effort reporting; never let it break the caller.
    }
  }

  static async exceptionhandler (err, isFatal, isNative) {
    try {
      if (isFatal || isNative) {
        const isErrorString = typeof err === 'string' || err instanceof String

        // Remove sensitive data from error message and stack trace
        const errorMessage = removeSensitiveKeysFromString(`${isErrorString ? err : err?.message || 'Unknown Error Message'}`)
        const errorStack = removeSensitiveKeysFromString(`${isErrorString ? '-' : err?.stack || '-'}`)
        const messageCrash = `
          **************** ${ISIOS ? 'iOS' : 'Android'} [${DeviceInfo.getVersion()} - ${DeviceInfo.getBuildNumber()}] ${DeviceInfo.isTablet() ? '[tablet]' : ''} ${__DEV__ ? '[isDev]' : ''}****************
          Device Name: ${DeviceInfo.getDeviceNameSync()}
          Device Brand: ${DeviceInfo.getBrand()}
          Device Model: ${DeviceInfo.getModel()}
          Device Manufacturer: ${DeviceInfo.getManufacturerSync()}
          Device Id: ${DeviceInfo.getDeviceId()}
          Device Type: ${DeviceInfo.getDeviceType()}
          SystemName: ${DeviceInfo.getSystemName()}
          SystemVersion: ${DeviceInfo.getSystemVersion()}
          Page: ${NavigationActions.getCurrentScreen() || 'Unknown Screen'}
          Error Name: ${err?.name || 'Unknown Error Name'}
          Error Message: ${errorMessage}
          Error Stack: ${errorStack}
          ****************
        `
        ReduxService.sendChatworkMessage(messageCrash)
        // turn on notify chat
        NavigationActions.navigate('crashAppScreen')
      }
    } catch (error) {
      const messageCrash = `
        **************** ${ISIOS ? 'iOS' : 'Android'} - catch - ${__DEV__ ? 'isDev' : ''}****************
        ${removeSensitiveKeysFromString(error?.name ? error?.name : 'Unknown Error Name')}
        ${removeSensitiveKeysFromString(error?.message ? error?.message : 'Unknown Error Message')}
        Page: ${NavigationActions.getCurrentScreen() || 'Unknown Screen'}
        ****************
      `
      ReduxService.sendChatworkMessage(messageCrash)
      NavigationActions.navigate('crashAppScreen')
    }
  }

  static async remoteDebugLog (screen = '-', log = '') {
    try {
      const logStringWithoutSensitiveData = removeSensitiveKeysFromString(log)

      const logString = `
          **************** Remote debug info ****************
          **************** ${ISIOS ? 'iOS' : 'Android'} [${DeviceInfo.getVersion()} - ${DeviceInfo.getBuildNumber()}] ${DeviceInfo.isTablet() ? '[tablet]' : ''} ${__DEV__ ? '[isDev]' : ''}****************
          Device Name: ${DeviceInfo.getDeviceNameSync()}
          Device Brand: ${DeviceInfo.getBrand()}
          Device Model: ${DeviceInfo.getModel()}
          Device Manufacturer: ${DeviceInfo.getManufacturerSync()}
          Device Id: ${DeviceInfo.getDeviceId()}
          Device Type: ${DeviceInfo.getDeviceType()}
          SystemName: ${DeviceInfo.getSystemName()}
          SystemVersion: ${DeviceInfo.getSystemVersion()}
          Function: ${screen}
          Log: ${logStringWithoutSensitiveData}
          ****************
        `
      ReduxService.sendChatworkMessage(logString)
    } catch (error) {
      // error
    }
  }

  static async setAppSettings () {
    const configs = await BaseAPI.getAppSettings()

    if (configs?.others) {
      this.callDispatchAction(StorageReduxAction.setAppSettings(configs))
    }
  }

  static async refeshBlockChainList () {
    try {
      const { blockchainListRedux } = storeRedux.getState()

      // Start from current state (plain object keyed by chainId), then prune
      // deprecated chains (heco/128) before re-seeding defaults.
      const blockchainListReduxFinal = { ...blockchainListRedux }
      delete blockchainListReduxFinal[128]
      Object.keys(blockchainListReduxFinal).forEach((id) => {
        if (blockchainListReduxFinal[id]?.chain === chainType.heco) {
          delete blockchainListReduxFinal[id]
        }
      })

      Object.values(SUPPORTED_BLOCKCHAIN_DATA).forEach((defaultChain) => {
        const id = defaultChain.chainId
        if (!blockchainListReduxFinal[id]) {
          blockchainListReduxFinal[id] = {
            ...defaultChain,
            keychain: `${defaultChain.chain}${id}`,
            isSupportedChain: true
          }
        } else {
          // Re-pin the bundled local icon for existing default-chain entries so
          // users upgrading from a build that persisted a remote icon URL get the
          // fast local asset back — independent of whether the API refresh below
          // succeeds.
          blockchainListReduxFinal[id].icon = defaultChain.icon
        }
      })

      const ids = Object.keys(blockchainListReduxFinal)
      await Promise.all(ids.map(async (id) => {
        const itemChain = blockchainListReduxFinal[id]
        if (!itemChain || itemChain.isChainAddManually) return
        try {
          const resApi = await BaseAPI.getBlockChainWithChainId(itemChain.chainId)

          // Strip empty fields ('', null, undefined) from the API response so
          // they don't override valid existing/default values on merge (e.g. a
          // blank `name` wiping out the chain name in the selector).
          const resApiClean = {}
          Object.keys(resApi || {}).forEach((key) => {
            const value = resApi[key]
            const isBlankString = typeof value === 'string' && value.trim() === ''
            if (value !== null && value !== undefined && !isBlankString) {
              resApiClean[key] = value
            }
          })

          let isSupportedChain = itemChain?.isSupportedChain
          if ([chainType.tomo, chainType.fantom, chainType.one, chainType.okt].includes(itemChain?.chain)) {
            isSupportedChain = false
          }

          // For default chains we ship a bundled local icon (see
          // SUPPORTED_BLOCKCHAIN_DATA[...].icon). Never let the API's remote icon
          // URL override it — the local asset loads instantly and stays stable.
          const defaultChain = SUPPORTED_BLOCKCHAIN_DATA[itemChain.chainId]
          if (defaultChain) {
            delete resApiClean.icon
          }

          blockchainListReduxFinal[itemChain.chainId] = {
            ...blockchainListReduxFinal[itemChain.chainId],
            ...resApiClean,
            ...(defaultChain ? { icon: defaultChain.icon } : {}),
            keyChain: lowerCase(`${itemChain.chain}${itemChain.chainId}`),
            isSupportedChain
          }
        } catch (e) {
          // skip on api error
        }
      }))

      this.callDispatchAction(StorageReduxAction.setBlockChainList(blockchainListReduxFinal))
    } catch (error) {
      // err
    }
  }

  /**
   * Ensure every chain in `activeEvmChainIdsRedux` has a matching entry in
   * `blockchainListRedux`. Old-account migration adds chainIds to the active
   * list straight from the account data, but a chain that is neither a current
   * default nor already in the persisted blockchain list would otherwise have
   * no metadata (name/icon/rpc) — the chain selector shows "Chain <id>" and
   * balance fetching has no RPC. Seed missing ones from SUPPORTED_BLOCKCHAIN_DATA
   * when known (offline/instant), otherwise fetch from the Keyring chain API.
   */
  static async seedMissingActiveChains () {
    try {
      const activeIds = (this.getActiveEvmChainIds() || []).map(Number)
      if (!activeIds.length) return

      const list = { ...(this.getBlockchainListRedux() || {}) }
      const missing = activeIds.filter((id) => Number.isFinite(id) && id > 0 && !list[id])
      if (!missing.length) return

      await Promise.all(missing.map(async (id) => {
        const def = SUPPORTED_BLOCKCHAIN_DATA[id]
        if (def) {
          list[id] = { ...def, keychain: `${def.chain}${id}`, isSupportedChain: true }
          return
        }
        try {
          const info = await BaseAPI.getBlockChainWithChainId(id)
          if (info && info.chainId) {
            const chain = String(info.chain || '').toLowerCase()
            list[id] = { ...info, chain, keyChain: `${chain}${id}` }
          }
        } catch (e) {
          // leave it missing on api error — next launch retries
        }
      }))

      this.callDispatchAction(StorageReduxAction.setBlockChainList(list))
    } catch (error) {
      // do nothing
    }
  }

  /**
   * Reset ONLY the slices that a restored backup repopulates, so the imported
   * wallet doesn't inherit the previous wallet's data:
   *   - accountList        → [] (then set from backup)
   *   - activeEvmChainIds  → [] (then set from backup / derived)
   *   - blockchainList     → defaults (custom chains re-added by seedMissingActiveChains)
   *   - accountTokenList   → {} (per-account tokens refetched fresh)
   *   - addressRegisteredLiquidity / addressDeletedLiquidity → init (liquidity
   *     registrations are account-specific; don't carry the old wallet's pools)
   * Everything else — the secure-vault password (needed to encrypt the imported
   * keys), theme, currency, language, JWT — is intentionally preserved. This is
   * NOT a full wipe; use resetReduxData(true) for the "Reset wallet" feature.
   */
  static resetWalletDataForRestore = () => {
    this.callDispatchAction(StorageReduxAction.setAccountList(initState.arrInit.slice()))
    this.callDispatchAction(StorageReduxAction.setActiveEvmChainIds(initState.activeEvmChainIds))
    this.callDispatchAction(StorageReduxAction.setBlockChainList(initState.blockchainList))
    this.callDispatchAction(StorageReduxAction.setAccountTokenList(initState.accountTokenList))
    // Drop the previous wallet's AI Search history so it can't resurface under a
    // restored account that happens to share an address.
    this.callDispatchAction(StorageReduxAction.setActiveAccount(initState.activeAccount))
    this.callDispatchAction(StorageReduxAction.setAiSearchHistory(initState.aiSearchHistory))
    // …and with it the dismissed-pill state, so the restored wallet opens AI
    // Search on a fresh thread WITH its init suggestions rather than an empty
    // chat whose pills are still hidden from before the restore.
    resetSuggestions()
    // Drop the previous wallet's liquidity registration/deletion state so the
    // restored wallet doesn't inherit pools tied to a different account.
    this.callDispatchAction(StorageReduxAction.setAddressRegisteredLiquidity(initState.addressRegisteredLiquidity.slice()))
    this.callDispatchAction(StorageReduxAction.setAddressDeletedLiquidity({ ...initState.addressDeletedLiquidity }))
  }

  static async setTokenJWT () {
    const nagemonAuth = await NagemonAPI.getAuth()
    if (nagemonAuth?.key) {
      this.callDispatchAction(StorageReduxAction.setTokenJWT(nagemonAuth.key))
    }
  }

  static getSettingOther (key, defaultValue = '') {
    const { settingsRedux } = storeRedux.getState()
    if (settingsRedux && settingsRedux.others && settingsRedux.others[key]) {
      return settingsRedux.others[key]
    } else {
      return defaultValue
    }
  }

  static async callDispatchAction (action) {
    storeRedux.dispatch(action)
  }

  static setAccountList = (data) => {
    this.callDispatchAction(StorageReduxAction.setAccountList(data))
  }

  static getAccountList = () => {
    const { accountListRedux } = storeRedux.getState()
    return accountListRedux
  }

  static getBlockchainListRedux = () => {
    const { blockchainListRedux } = storeRedux.getState()
    return blockchainListRedux
  }

  static getCanShowAppRatingRedux = () => {
    const { canShowAppRating } = storeRedux.getState()
    return canShowAppRating
  }

  static setCanShowAppRatingRedux = () => {
    const { canShowAppRating } = storeRedux.getState()
    this.callDispatchAction(StorageReduxAction.setCanShowAppRating({ ...canShowAppRating, alreadyShow: true }))
  }

  static getMigrationFlags = () => {
    const { migrationFlagsRedux } = storeRedux.getState()
    return migrationFlagsRedux || {}
  }

  static changeCurrency = async (newCurrency) => {
    this.callDispatchAction(StorageReduxAction.setCurrency(newCurrency))
    let fiatRate = 1
    if (newCurrency !== 'USD') {
      fiatRate = await BaseAPI.convertUSD2NewCurrency(newCurrency === 'RMB' ? 'CNY' : newCurrency)
    }
    this.callDispatchAction(StorageReduxAction.setFiatRate(fiatRate))
  }

  static updateFiatRate = async () => {
    const { currencyRedux } = storeRedux.getState()
    let fiatRate = 0
    if (currencyRedux !== 'USD') {
      fiatRate = await BaseAPI.convertUSD2NewCurrency(currencyRedux === 'RMB' ? 'CNY' : currencyRedux)
    } else {
      fiatRate = 1
    }
    fiatRate > 0 && this.callDispatchAction(StorageReduxAction.setFiatRate(fiatRate))
  }

  static async approveCustomRequestWalletConnect (payload, accountIndex = 0, result = {}, closeModalProps = () => {}, showAlert = null) {
    const { walletConnectRedux } = storeRedux.getState()
    try {
      if (walletConnectRedux?.[accountIndex]) {
        if (result) {
          !ISIOS && closeModalProps && closeModalProps()
          if (walletConnectRedux[accountIndex].isWalletConnectV2) {
            const connectorV2 = await getConnectorV2()
            const response = formatJsonRpcResult(payload.id, result)
            await connectorV2.respondSessionRequest({ topic: payload.topic, response })
          } else {
            walletConnectRedux[accountIndex].connector.approveRequest({
              id: payload.id,
              result: result
            })
          }
        }

        removeCallRequest(accountIndex, payload)
        setTimeout(() => {
          ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
        }, 2000)

        if (walletConnectRedux[accountIndex].isFromDeepLink) {
          redirectBackToDapp(showAlert)
        }
      }
    } catch (_error) {
      !ISIOS && closeModalProps && closeModalProps()
      if (walletConnectRedux[accountIndex].isWalletConnectV2) {
        const connectorV2 = await getConnectorV2()
        const response = formatJsonRpcErrorForWalletConnectV2(payload)
        await connectorV2.respondSessionRequest({
          topic: payload.topic,
          response: response
        })
        showAlert && showAlert(I18n.t('v2.walletConnect.failedOrRejected'), '', { type: 'toast', timeout: 4000 })
        removeCallRequest(accountIndex, payload)
        if (walletConnectRedux[accountIndex].isFromDeepLink) {
          redirectBackToDapp(showAlert)
        }
      } else if (walletConnectRedux?.[accountIndex]?.connector) {
        walletConnectRedux[accountIndex].connector.rejectRequest({
          id: payload.id,
          error: { message: I18n.t('v2.walletConnect.failedOrRejected') }
        })
        showAlert && showAlert(I18n.t('v2.walletConnect.failedOrRejected'), '', { type: 'toast', timeout: 4000 })
        removeCallRequest(accountIndex, payload)
        if (walletConnectRedux[accountIndex].isFromDeepLink) {
          redirectBackToDapp(showAlert)
        }
      }
    }
  }

  static async processCustomRequestWalletConnect (payload, accountIndex = 0, showAlert = null, closeModalProps = () => {}) {
    const { walletConnectRedux } = storeRedux.getState()

    try {
      if (walletConnectRedux?.[accountIndex]?.connector) {
        if (payload?.params[0]?.type === NFT_TYPE_MAP.SCAN_QR) {
          NavigationActions.reset('scanScreen')
          ReduxService.approveCustomRequestWalletConnect(payload, accountIndex, {}, null, showAlert)
        }
      }
    } catch (_error) {
      !ISIOS && closeModalProps()
      if (walletConnectRedux?.[accountIndex]?.connector) {
        walletConnectRedux[accountIndex].connector.rejectRequest({
          id: payload.id,
          error: { message: I18n.t('v2.walletConnect.failedOrRejected') }
        })
        showAlert && showAlert(I18n.t('v2.walletConnect.failedOrRejected'), '', { type: 'toast', timeout: 4000 })
        removeCallRequest(accountIndex, payload)
        if (walletConnectRedux[accountIndex].isFromDeepLink) {
          redirectBackToDapp(showAlert)
        }
      }
    }
  }

  static getLiquidityList () {
    const { addressRegisteredLiquidity } = storeRedux.getState()

    return addressRegisteredLiquidity
  }

  static getCurrencyRedux () {
    const { currencyRedux } = storeRedux.getState()

    return currencyRedux
  }

  static getFiatRateRedux () {
    const { fiatRateRedux } = storeRedux.getState()

    return fiatRateRedux
  }

  static getAddressDeletedLiquidity () {
    const { addressDeletedLiquidity } = storeRedux.getState()

    return addressDeletedLiquidity
  }

  // -- v2 token list (per-account, EVM-only) --
  static getAccountTokenList = () => {
    const { accountTokenListRedux } = storeRedux.getState()
    return accountTokenListRedux || {}
  }

  static setAccountTokenList = (data) => {
    this.callDispatchAction(StorageReduxAction.setAccountTokenList(data))
  }

  // -- per-address token loading state (in-memory, not persisted) --
  static getTokenLoading = () => {
    const { tokenLoadingRedux } = storeRedux.getState()
    return tokenLoadingRedux || {}
  }

  static isTokenLoading = (address) => {
    if (!address) return false
    return !!ReduxService.getTokenLoading()[lowerCase(address)]
  }

  // Ref-counted per address: each refresh increments on start and decrements on
  // finish. Two overlapping refreshes for the SAME address (e.g. the restore
  // kick-off + TokenList's mount auto-refresh) keep the count > 0 until BOTH
  // finish, so the loading icon doesn't clear while a fetch is still running.
  // Safe without locking: the read-modify-write below is fully synchronous
  // (callDispatchAction dispatches synchronously, no await), so concurrent calls
  // can't interleave on the JS thread.
  static setTokenLoading = (address, isLoading) => {
    if (!address) return
    const key = lowerCase(address)
    const current = ReduxService.getTokenLoading()
    const prevCount = current[key] || 0
    const nextCount = isLoading ? prevCount + 1 : Math.max(0, prevCount - 1)
    // Skip the dispatch when the count is unchanged so subscribed account rows
    // don't re-render on every redundant set.
    if (nextCount === prevCount) return
    const next = { ...current }
    if (nextCount > 0) next[key] = nextCount
    else delete next[key]
    this.callDispatchAction(PageReduxAction.setTokenLoading(next))
  }

  static getActiveEvmChainIds = () => {
    const { activeEvmChainIdsRedux } = storeRedux.getState()
    return activeEvmChainIdsRedux || []
  }
}
