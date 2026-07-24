import '../global.css'
import React, { Component } from 'react'
import { Linking } from 'react-native'
import AppNavigator from './navigation'
import WalletConnectRequestHost from 'frontend/Components/WalletConnectRequestHost'
import { NavigationActions } from './navigation/NavigationService'
import { Provider } from 'react-redux'
import storeRedux from 'controller/Redux/store/configureStore'
import { KEYSTORE } from 'common/constants/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { mapAsyncStorageToRedux, mapSecureStorageToRedux } from 'controller/Redux/lib/reducerConfig'
import { SECURE_STORAGE_REDUX_MAP, buildStorageReduxMap } from 'controller/Redux/lib/storageReduxMaps'
import ReduxService from 'common/redux'
import ThemeContextProvider from 'frontend/Contexts/ThemeContext'
import NetInfo from '@react-native-community/netinfo'
import 'react-native-url-polyfill/auto'
import { resetKeychainWhenAppFirstLaunch, hasSavedPassword, hasLegacyPasscode, clearLegacyPasscode } from 'common/keychain'
import { initAutoLock } from 'common/autoLock'
import { hasPassword as hasVaultPassword, isUnlocked } from 'common/secureVault'
import { setDeepLinkHandler, stashPendingDeepLink } from 'common/deepLink'
import { getConnectorV2, isWalletConnectPattern } from 'common/walletconnect'
import { isExportKeyFromNfc, migratePrivateKeyToSeparateSecureDataInSecureStorage, migrateAccountListToV2, resolveAccountType } from 'common/wallet'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClientProvider } from 'react-query'
import { getDataFromSecureStorage, initSecureStorage } from 'common/storage/secureStorage'
import BootSplash from 'react-native-bootsplash'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AaveClient, AaveProvider } from '@aave/react'
import { NAME_SCREEN } from 'common/constants/navigation'
import { Colors } from 'common/styles'
import { queryClient } from 'common/queryClient'
import { resolveDeviceLocale } from 'assets/Lang'
import { maybeRequestUserLocation } from 'common/userLocation'

export const client = AaveClient.create()
export default class KeyringWallet extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isLoading: true,
      initScreen: NAME_SCREEN.welcome
    }
  }

  async componentDidMount () {
    try {
      // Re-use the secure storage instance if it's already initialized.
      await initSecureStorage()

      // Pre-hydration: move any private keys out of the account list (into the
      // dedicated LIST_PRIVATE_KEY_BY_ADDRESS store) before it is loaded into
      // redux, so private keys never enter the redux store.
      await migratePrivateKeyToSeparateSecureDataInSecureStorage()

      await this.hydrateReduxFromStorage()

      // Read the device region once at startup and keep the stored country in
      // sync (no OS permission / GPS — react-native-localize's getCountry).
      // Used to localize content such as the AI agent's where-to-buy links.
      // Fire-and-forget: never blocks or fails app start.
      maybeRequestUserLocation()

      // Must run BEFORE refeshBlockChainList (in startBackgroundServices) so
      // downstream code sees the migrated blockchainListRedux shape.
      this.migrateBlockchainListShape()

      // Reset iOS keychain on the first launch after a (re)install.
      // https://github.com/oblador/react-native-keychain/issues/135#issuecomment-1016797753
      resetKeychainWhenAppFirstLaunch()

      this.startBackgroundServices()

      const accountList = getDataFromSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, [])
      this.runAccountMigrations(accountList)

      this.setupNetInfo()

      // init @reown/walletkit
      await getConnectorV2()

      const initScreen = await this.resolveInitScreen(accountList)

      initAutoLock()

      this.finishBoot(initScreen)
    } catch (e) {
      // do nothing
    }
  }

  async componentWillUnmount () {
    this.linkingSubscription && this.linkingSubscription.remove()
    this.unsubscribeNetInfo && this.unsubscribeNetInfo()
  }

  // Load persisted values into redux: secure-storage keys first, then
  // AsyncStorage keys. Both batches run in parallel within themselves.
  hydrateReduxFromStorage = async () => {
    // Fresh install: seed the app language from the device's preferred language
    // (falls back to English if unsupported). On an upgrade, the previously saved
    // language is already in AsyncStorage, so this init value is never used and
    // the user's chosen language is preserved.
    const localeInit = resolveDeviceLocale()
    const storageReduxMap = buildStorageReduxMap(localeInit)

    await Promise.all(
      SECURE_STORAGE_REDUX_MAP.map((itm) => mapSecureStorageToRedux(storeRedux, itm.key, itm.action, itm.init))
    )

    await Promise.all(
      storageReduxMap.map((itm) => mapAsyncStorageToRedux(storeRedux, itm.key, itm.action, itm.init))
    )
  }

  // Collapse the legacy blockchainListRedux { object, array } wrapper into a
  // plain object keyed by chainId. Idempotent — detects the wrapper keys first.
  migrateBlockchainListShape = () => {
    const blockchainListReduxState = storeRedux.getState().blockchainListRedux
    if (blockchainListReduxState && (blockchainListReduxState.object || blockchainListReduxState.array)) {
      const flat = blockchainListReduxState.object ||
        (blockchainListReduxState.array || []).reduce((acc, c) => {
          if (c?.chainId != null) acc[c.chainId] = c
          return acc
        }, {})
      storeRedux.dispatch(StorageReduxAction.setBlockChainList(flat))
    }
  }

  // Fire off the non-blocking startup service calls.
  startBackgroundServices = () => {
    ReduxService.updateFiatRate()
    ReduxService.activeCrashReport()
    ReduxService.setAppSettings()
    ReduxService.setTokenJWT()
    ReduxService.refeshBlockChainList()
  }

  runAccountMigrations = (accountList) => {
    // Migrate accountListRedux to the new shape (collapse EVM items by address
    // into one entry with chain = 'evm', collect chainIds into
    // ACTIVE_EVM_CHAIN_IDS). Skip if already migrated.
    const migrationFlags = ReduxService.getMigrationFlags()
    if (!migrationFlags.accountListV2Migrated) {
      const { migratedList, activeEvmChainIds } = migrateAccountListToV2(accountList)
      storeRedux.dispatch(StorageReduxAction.setAccountList(migratedList))
      // Only overwrite when migration actually extracted EVM chainIds. If
      // accountList is already V2-shaped (chain='evm', no chainId), or contains
      // only BTC/Solana, the migrator returns [] — and overwriting would wipe the
      // user's hydrated active chain list. The flag persists via fire-and-forget
      // AsyncStorage, so a killed app before flush can re-run this on next launch.
      if (activeEvmChainIds.length > 0) {
        storeRedux.dispatch(StorageReduxAction.setActiveEvmChainIds(activeEvmChainIds))
      }
      storeRedux.dispatch(StorageReduxAction.setMigrationFlags({ ...migrationFlags, accountListV2Migrated: true }))
    }

    // Backfill `accountType` on any account still missing it. Covers users who
    // migrated to V2 before accountType existed (their accountListV2Migrated flag
    // is set, so the block above is skipped). Dispatches only when at least one
    // account lacks a type — a no-op once every account is stamped.
    const accountListAfterMigrate = ReduxService.getAccountList()
    if (Array.isArray(accountListAfterMigrate) && accountListAfterMigrate.some((a) => a && !a.accountType)) {
      storeRedux.dispatch(StorageReduxAction.setAccountList(
        accountListAfterMigrate.map((a) => ({ ...a, accountType: resolveAccountType(a) }))
      ))
    }

    // Reconcile: every active EVM chain must have a blockchainListRedux entry.
    // Migration adds chainIds to the active list from account data alone, so a
    // removed-default or custom chain can end up active without metadata. Runs
    // unconditionally (covers users already migrated to V2).
    ReduxService.seedMissingActiveChains()
  }

  setupNetInfo = () => {
    NetInfo.configure({
      reachabilityUrl: 'https://clients3.google.com/generate_204',
      reachabilityTest: async (response) => response.status === 204
    })
    this.unsubscribeNetInfo = NetInfo.addEventListener(ReduxService.handleConnection)
  }

  // Decide the first screen from the user's wallet / password state.
  resolveInitScreen = async (accountList) => {
    const hasWallet = accountList && accountList.length > 0
    const hasPassword = hasWallet ? await hasSavedPassword() : false
    const hasLegacy = hasWallet ? await hasLegacyPasscode() : false

    // If the user already has a v6 password but a stale legacy passcode is still
    // hanging around (e.g. upgrade flow was killed before cleanup), silently
    // remove the legacy entries — the new password is authoritative.
    if (hasPassword && hasLegacy) {
      await clearLegacyPasscode()
    }

    return hasPassword
      ? NAME_SCREEN.unlock
      : hasLegacy
        ? NAME_SCREEN.securityUpgrade
        : hasWallet
          ? NAME_SCREEN.home
          : NAME_SCREEN.welcome
  }

  // Reveal the UI, hide the splash, and wire up deep-link handling.
  finishBoot = (initScreen) => {
    this.setState({ initScreen, isLoading: false }, async () => {
      await BootSplash.hide({ fade: true })

      // Let UnlockScreen replay a stashed cold-start deep link through navigate().
      setDeepLinkHandler(this.navigate)

      Linking.getInitialURL().then((url) => {
        if (url) {
          this.navigate({ url })
        }
      })

      setTimeout(() => {
        this.linkingSubscription = Linking.addEventListener('url', this.navigate)
      }, 2000)
    })
  }

  navigate = async (event) => {
    const accountList = getDataFromSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, [])
    let url = event && event.url

    // SECURITY: never act on a deep link while the vault is locked. On a cold
    // start the launch URL is delivered while UnlockScreen is the root (and on a
    // warm auto-lock the vault key is cleared), so opening the target screen here
    // would bypass the password gate. Stash it; UnlockScreen.afterUnlock replays
    // it via flushPendingDeepLink() once the user has unlocked.
    if (url && hasVaultPassword() && !isUnlocked()) {
      stashPendingDeepLink(url)
      return
    }

    if (!(accountList?.length > 0 && url)) return

    try {
      url = decodeURIComponent(url)
    } catch (_e) {
      // ignore malformed URI
    }

    if (isExportKeyFromNfc(url)) {
      NavigationActions.navigate('keyCardOperation', { isShowPrivateKey: true })
      return
    }

    if (url.includes('wc:') || url.includes('wc?uri') || url.includes('wallet-connect')) {
      this.openWalletConnectFromUrl(url)
    } else if (url.includes('how-to-scan')) {
      // Any url containing "how-to-scan" (…-necostore/-misssake/-fanymarket) opens scan.
      NavigationActions.reset('scanScreen')
    } else if (url.includes('add-chain') || url.includes('addchain')) {
      this.openAddChainFromUrl(url)
    }
  }

  /**
   * WalletConnect V2 URI examples:
   *  - init connect:    wc:<topic>@2?relay-protocol=irn&symKey=<key>
   *  - signing request: wc:<topic>@2/wc?requestId=<id>&sessionTopic=<topic>
   */
  openWalletConnectFromUrl = (url) => {
    const walletconnectDeeplinkPattern = url.includes('wc:')
      ? 'wc:'
      : url.includes('wc?uri')
        ? 'wc?uri'
        : 'wallet-connect'
    let wcParentIndex = url.indexOf(walletconnectDeeplinkPattern)
    if (walletconnectDeeplinkPattern !== 'wc:') {
      wcParentIndex = url.indexOf(walletconnectDeeplinkPattern) + walletconnectDeeplinkPattern.length + 1
    }
    const walletConnectUri = url.substring(wcParentIndex)

    // Only WalletConnect V2 URIs (topic marked with @2) are handled.
    if (!url.includes('@2')) return

    // A signing request arrives via walletKit's session_request event and is
    // added to redux (addCallRequestWalletConnectV2), then surfaced on the
    // WalletConnect screen — just land the user there. Otherwise treat it as an
    // init-connect URI and open the scan screen to establish the session.
    if (walletConnectUri.includes('wc?requestId')) {
      NavigationActions.navigate(NAME_SCREEN.walletConnect)
    } else if (isWalletConnectPattern(walletConnectUri)) {
      NavigationActions.navigate('scanScreen', { walletConnectUriInit: walletConnectUri })
    }
  }

  // Parse an add-chain deep link (?name=..&chainid=..&rpc=..&symbol=..&decimal=..&explorer=..)
  // and open the home screen with the add-chain popup when all required fields are present.
  openAddChainFromUrl = (url) => {
    const fieldString = url.split('?')[1]
    if (!fieldString || fieldString.length === 0) return

    const dataNewChain = {
      name: '',
      chainid: '',
      rpc: '',
      symbol: '',
      decimal: '',
      explorer: ''
    }
    fieldString.split('&').forEach((itemLink) => {
      dataNewChain[itemLink.split('=')[0].trim()] = itemLink.split('=')[1].trim()
    })

    if (dataNewChain.name.length > 0 && dataNewChain.chainid.length > 0 && dataNewChain.rpc.length > 0 && dataNewChain.symbol.length > 0 && dataNewChain.decimal.length > 0) {
      NavigationActions.reset('home', { dataNewChain, isOpenAddChainPopup: true })
    }
  }

  isWalletConnectShortPattern = (objData) => {
    if (objData && objData.startsWith('wc:') && !(objData.includes('bridge') || objData.includes('key'))) {
      return true
    } else {
      return false
    }
  }

  render () {
    return (
      <Provider store={storeRedux}>
        {
          this.state.isLoading ? null : (
            <SafeAreaProvider style={{ backgroundColor: Colors.BLACK }}>
              <AaveProvider client={client}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <QueryClientProvider client={queryClient}>
                    <ThemeContextProvider>
                      <AppNavigator initialRouteName={this.state.initScreen} />
                      {/* Global overlay: shows incoming WalletConnect requests over any screen. */}
                      <WalletConnectRequestHost />
                    </ThemeContextProvider>
                  </QueryClientProvider>
                </GestureHandlerRootView>
              </AaveProvider>
            </SafeAreaProvider>
          )
        }
      </Provider>
    )
  }
}
