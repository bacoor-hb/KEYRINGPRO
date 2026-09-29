import '@walletconnect/react-native-compat'
// Must sit between the compat polyfills and WalletKit — see the file for why.
import './textDecoderShim'
import { Core } from '@walletconnect/core'
import { WalletKit } from '@reown/walletkit'
import ReduxService from './redux'
import { DEFAULT_WC_APP_METADATA } from './constants/app'
import notifee from '@notifee/react-native'
import { formatJsonRpcResult } from '@json-rpc-tools/utils'
import { Platform } from 'react-native'
// import Minimizer from 'react-native-minimizer'
import I18n from 'assets/Lang'
import Config from 'react-native-config'
import { KEYSTORE } from './constants/redux'
import { getDataFromSecureStorage } from './storage/secureStorage'
import messaging from '@react-native-firebase/messaging'
import { Minimizer } from './NativeModules/Minimizer'
import { isURL } from './function'

let walletconnectV2Core
let walletKit

// EIP-5792: reject these with Method Not Found (wallet doesn't implement send/status flow)
const UNSUPPORTED_EIP5792_METHODS = [
  'wallet_sendCalls',
  'wallet_getCallsStatus',
  'wallet_showCallsStatus'
]

// Build wallet_getCapabilities response per WalletConnect docs — return success with
// atomic.status = "unsupported" for each requested chain.
// Ref: https://docs.walletconnect.network/wallet-sdk/web/eip5792
const buildGetCapabilitiesResult = (requestEvent) => {
  const reqParams = requestEvent?.params?.request?.params || []
  const requestedChains = Array.isArray(reqParams[1]) ? reqParams[1] : null

  let chains = requestedChains
  if (!chains || chains.length === 0) {
    // Fallback to the session's approved EVM chains
    const namespaces = requestEvent?.params?.chainId ? [requestEvent.params.chainId] : []
    chains = namespaces
      .filter(c => typeof c === 'string' && c.startsWith('eip155:'))
      .map(c => '0x' + parseInt(c.split(':')[1], 10).toString(16))
  }

  const result = {}
  for (const chainHex of chains || []) {
    result[chainHex] = { atomic: { status: 'unsupported' } }
  }
  return result
}

export const isWalletConnectPattern = (uri = '') => {
  if (uri && uri.startsWith('wc:')) {
    return true
  } else {
    return false
  }
}

// getConnectorV2 runs on every cold start, so reporting the same failure every time
// would flood the remote debug log. Report each distinct step+message once per session.
const reportedInitErrors = new Set()

const reportInitError = (from, step, error) => {
  const message = error?.message || 'no error message'
  const key = `${step}|${message}`

  if (reportedInitErrors.has(key)) {
    return
  }
  reportedInitErrors.add(key)

  const stack = String(error?.stack || '-').slice(0, 500)
  ReduxService.remoteDebugLog(
    'getConnectorV2-catch-error',
    `[from=${from}][step=${step}] ${message} | stack: ${stack}`
  )
}

export const getConnectorV2 = async (from = '?') => {
  // Which init step we reached, reported on failure. Release builds are minified, so
  // the stack alone can't say where it died — this marker is a plain string and survives.
  let step = 'core'

  try {
    if (!walletconnectV2Core) {
      walletconnectV2Core = new Core({
        projectId: Config.WALLETCONNECT_PROJECT_ID
      })
    }

    if (!walletKit) {
      step = 'init'

      // Build into a local and publish the singleton only once every listener is
      // attached. Assigning walletKit up front means a throw further down leaves a
      // connector that still pairs but never emits session_request — the dApp then
      // waits forever while the wallet shows no popup, and no further error is logged
      // because the next call sees a truthy walletKit and skips this whole block.
      const kit = await WalletKit.init({
        core: walletconnectV2Core,
        metadata: DEFAULT_WC_APP_METADATA
      })

      step = 'listeners'

      kit.on('session_delete', (session) => {
        // The WalletConnect screen is a reactive list bound to walletConnectRedux,
        // so removing the session here updates the UI in place — no navigation needed.
        ReduxService.disconnectWalletConnectV2(session.topic, true)
      })

      kit.on('session_request', async (requestEvent) => {
        const method = requestEvent?.params?.request?.method

        // Always respond so the dApp's pending promise resolves — otherwise dApp blocks its own queue
        if (method === 'wallet_getCapabilities') {
          try {
            const result = buildGetCapabilitiesResult(requestEvent)
            const response = formatJsonRpcResult(requestEvent.id, result)
            await kit.respondSessionRequest({ topic: requestEvent.topic, response })
          } catch (err) {
            // do nothing
          }
          return
        }

        if (UNSUPPORTED_EIP5792_METHODS.includes(method)) {
          try {
            await kit.respondSessionRequest({
              topic: requestEvent.topic,
              response: {
                id: requestEvent.id,
                jsonrpc: '2.0',
                error: { code: -32601, message: `Method not supported: ${method}` }
              }
            })
          } catch (err) {
            // do nothing
          }
          return
        }

        try {
          ReduxService.addCallRequestWalletConnectV2(requestEvent)
        } catch (e) {
          // do nothing
        }
      })

      step = 'onTokenRefresh'

      // Keeping the relay's device token fresh is a bonus — it must never abort init,
      // so it gets its own guard and its own log key.
      try {
        messaging().onTokenRefresh(async (token) => {
          try {
            await kit.registerDeviceToken({
              token, // device token, already provided by the event
              clientId: await kit.core.crypto.getClientId(), // your instance clientId
              notificationType: 'fcm', // notification type
              enableEncrypted: true // flag that enabled detailed notifications
            })
          } catch (e) {
            ReduxService.remoteDebugLog('onTokenRefresh-register-error', e?.message || 'no error message')
          }
        })
      } catch (e) {
        ReduxService.remoteDebugLog('onTokenRefresh-listen-error', e?.message || 'no error message')
      }

      step = 'ready'
      walletKit = kit
    }

    return walletKit
  } catch (error) {
    // walletconnectV2Core is deliberately left in place: building a fresh Core on every
    // retry would leak the previous relay socket.
    reportInitError(from, step, error)
    return null
  }
}

export const handleWCv2PushNotifications = async (notification) => {
  try {
    // get the topic, encrypted message & tag from the notification payload
    const { topic } = notification.data

    const walletConnectRedux = getDataFromSecureStorage(KEYSTORE.SET_WALLET_CONNECT)
    const findWalletconnect = (walletConnectRedux || []).filter((item, index) => {
      return item?.session?.topic === topic
    })

    const dappName = findWalletconnect?.[0]?.session?.peer?.metadata?.name || 'Dapp'

    // Create a channel (required for Android)
    const channelId = await notifee.createChannel({
      id: 'walletConnect-signature-requests',
      name: 'New Requests'
    })

    // Display a notification
    await notifee.displayNotification({
      title: 'KEYRING PRO',
      body: `New Request from ${dappName}`,
      android: {
        channelId,
        smallIcon: 'ic_stat_name',
        // pressAction is needed if you want the notification to open the app when pressed
        pressAction: {
          id: 'default'
        }
      }
    })

    // with this information you can show a local push notification to the user
  } catch (error) {
    // do nothing
  }
}

export const getUrlIconWalletConnect = (urlIcon, urlSite) => {
  if (!urlIcon && isURL(urlSite)) {
    // get site icon from google favicon service
    // https://miletadulovic.me/blog/get-any-website-favicon-using-free-google-api
    const url = new URL(urlSite)
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
  }

  if (isURL(urlIcon)) {
    return urlIcon
  }

  if (urlIcon?.startsWith('ipfs://')) {
    return urlIcon.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }

  if (typeof urlIcon === 'string' && isURL(urlSite)) {
    const url = new URL(urlSite)
    if (urlIcon?.startsWith('/')) {
      return url.origin + urlIcon
    } else {
      return url.origin + '/' + urlIcon
    }
  }

  return urlIcon
}

export const redirectBackToDapp = async (showAlertRefFunc, delayForRedirect = 1000) => {
  if (ISIOS && parseInt(Platform.Version) >= 17) {
    setTimeout(() => {
      showAlertRefFunc && showAlertRefFunc(I18n.t('WalletConnect.pleaseReturnToWebsite'), '', { type: 'toast', timeout: 4000 })
    }, 3000)
  } else {
    setTimeout(() => {
      Minimizer.goBack()
    }, delayForRedirect)
  }
}
