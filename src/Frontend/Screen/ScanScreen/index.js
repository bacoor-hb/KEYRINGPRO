import React from 'react'
import I18n from 'assets/Lang'
import { AppState, Alert } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { isPaymentLink as isWCPaymentLink } from '@reown/walletkit'
import BaseContainer from 'frontend/Container/BaseContainer'
import {
  sleep,
  debugInfo,
  isURL
} from 'common/function'
import { connect } from 'react-redux'
import { check, PERMISSIONS, RESULTS, request, openSettings, requestNotifications } from 'react-native-permissions'
import Page from './page'
import ReduxService from 'common/redux'
import { bindActionCreators } from 'redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import messaging from '@react-native-firebase/messaging'
import { setPendingWcConnect, approveWalletConnectProposal, rejectWalletConnectProposal } from 'src/Services/WalletConnectSession'
import WalletConnectConnectModal from 'frontend/Screen/WalletConnect/Component/WalletConnectConnectModal'
import AddChainPopup from 'frontend/Components/AddChainPopup'
import { getSdkError } from '@walletconnect/utils'
import { getConnectorV2, isWalletConnectPattern, redirectBackToDapp } from 'common/walletconnect'
import { getHeightHeader, getHeightScreen } from 'common/styles'
import { NavigationActions, navigationRef } from 'src/navigation/NavigationService'
import WalletConnectPay from 'common/walletConnectPay'
import { NAME_SCREEN } from 'common/constants/navigation'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { REDUX_KEY } from 'common/constants/redux'

const INITIAL_STATE = {
  QRCodeData: '',
  isTorchOn: false,
  isActiveCamera: false,
  isLoadingRoute: false,
  lastScanTime: null,
  isStopScan: false,
  connector: null,
  uri: '',
  isLoadingWalletConnect: false,
  isLoadingWalletConnectPay: false,
  selectedAccount: {},
  isNeedUpdateCamera: true,
  isHidePasteArea: false,
  wcSessionProposal: null,
  wcAuthenticatePayload: null,
  wcUriPaste: '',
  isFocusPasteView: false
}

class ScanScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      ...INITIAL_STATE
    }
    this.forceCheckPermissionCamera = false
  }

  async componentDidMount () {
    const {
      walletConnectUriInit
    } = this.props.route.params || {}

    if (walletConnectUriInit) {
      try {
        this.setState({
          isStopScan: true
        }, async () => {
          let connector

          try {
            // Scan - Step 1 - init connector
            connector = await getConnectorV2()
          } catch (e) {
            ReduxService.remoteDebugLog('didMount-getConnectorV2() catch-error', e?.message || 'no error message')
            // error
          }

          if (connector) {
            this.setState({
              lastScanTime: (new Date()).getTime(),
              connector,
              isStopScan: true,
              uri: connector.uri || walletConnectUriInit,
              isActiveCamera: false,
              isLoadingWalletConnect: true
            }, async () => {
              await this.subscribeToEventsV2(true)
            })
          } else {
            Alert.alert(I18n.t('WalletConnect.errorConnect'))
          }
        })
      } catch (e) {
        ReduxService.remoteDebugLog('didMount-final-catch-error', e?.message || 'no error message')
        this.setState({ ...INITIAL_STATE, isActiveCamera: true })
      }
    } else {
      check(ISIOS ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA).then(async (response) => {
        if (response === RESULTS.DENIED || response === RESULTS.UNAVAILABLE) {
          this.requestActivePermissionCamera()
        } else if (response !== RESULTS.GRANTED) {
          this.requestPermissionCameraInSetting()
        }
      })
      this.updateCameraStatus()
      this.appStateSubscription = AppState.addEventListener('change', this.onAppStateChange)
    }
  }

  componentWillUnmount () {
    this.appStateSubscription && this.appStateSubscription.remove()
  }

  onHandleRejectRequestDirectly = (item) => {
    const { accountIndex } = this.props
    !ISIOS && this.closeModal()
    ReduxService.rejectRequestWalletConnect(item, accountIndex, null, this.showAlert)
  }

  onAppStateChange = (appState) => {
    // fix error when scan qr code and open nfc card
    if (appState === 'active' && this.state.isNeedUpdateCamera) {
      this.updateCameraStatus(true)
    }
  }

  updateCameraStatus = (isAppState) => {
    check(ISIOS ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA).then(async (response) => {
      if (response === RESULTS.GRANTED) {
        this.setState({ isActiveCamera: true })
      } else if (ISIOS && isAppState && response !== RESULTS.GRANTED && this.forceCheckPermissionCamera) {
        this.forceCheckPermissionCamera = false
        Alert.alert(
          I18n.t('Permission.denied'),
          I18n.t('Permission.camera'),
          [
            {
              text: I18n.t('Initial.cancel'),
              onPress: () => {
                NavigationActions.reset('home')
              }
            }
          ],
          { cancelable: false }
        )
      }
    })
  }

  requestActivePermissionCamera = async () => {
    if (ISIOS) {
      request(PERMISSIONS.IOS.CAMERA)
        .then(res => {
          this.setState({ isActiveCamera: res === RESULTS.GRANTED })
          if (res !== RESULTS.GRANTED) {
            NavigationActions.reset('home')
          }
        }).catch()
    } else {
      try {
        const granted = await request(
          PERMISSIONS.ANDROID.CAMERA,
          {
            title: I18n.t('Permission.denied'),
            message: I18n.t('Permission.wouldLikeAccess', { name: 'Camera' })
          }
        )
        if (granted === RESULTS.GRANTED) {
          this.setState({ isActiveCamera: true })
        } else {
          NavigationActions.reset('home')
        }
      } catch (err) {
        // error
      }
    }
  }

  requestPermissionCameraInSetting = () => {
    Alert.alert(
      I18n.t('Permission.denied'),
      I18n.t('Permission.wouldLikeAccess', { name: 'Camera' }),
      [
        {
          text: I18n.t('Initial.cancel'),
          onPress: () => {
            NavigationActions.reset('home')
          }
        },
        {
          text: I18n.t('Initial.ok'),
          onPress: () => {
            this.forceCheckPermissionCamera = true
            openSettings()
          }
        }
      ],
      { cancelable: false }
    )
  }

  requestPermissionNoti = () => {
    Alert.alert(
      I18n.t('Permission.denied'),
      I18n.t('Permission.noti'),
      [
        {
          text: I18n.t('Initial.cancel'),
          onPress: () => this.setState({ ...INITIAL_STATE, isActiveCamera: true })
        },
        {
          text: I18n.t('Initial.ok'),
          onPress: () => {
            this.setState({ ...INITIAL_STATE, isActiveCamera: true })
            openSettings()
          }
        }
      ],
      { cancelable: false }
    )
  }

  onPasteWalletConnectCode = async () => {
    this.dismissKeyboard()
    const confirmProp = (value) => {
      if (value) {
        // this.closeModal()
        this.onBarCodeRead({ data: value ? value.trim() : '' }, true)
      }
    }

    const text = await Clipboard.getString()

    if (text && text.trim().startsWith('wc:')) {
      // setTxtValue(text)
      this.setState({
        wcUriPaste: text.trim()
      }, async () => {
        await sleep(500)
        confirmProp(text.trim())
      })
    } else {
      if (isWCPaymentLink(text.trim())) {
        this.handleWalletConnectPay(text.trim())
      } else {
        this.setState({
          wcUriPaste: text.trim()
        })
        this.showAlert(I18n.t('WalletConnect.errorConnect'), '', { type: true })
      }
    }
  }

  onHandleOpenAddChainPopup = (qrcodeString) => {
    this.setState({
      isStopScan: true,
      isActiveCamera: false,
      isHidePasteArea: true
    }, () => {
      const fieldString = qrcodeString.split('?')[1] ? qrcodeString.split('?')[1] : []
      const dataNewChain = {
        name: '',
        chainid: '',
        rpc: '',
        symbol: '',
        decimal: '',
        explorer: ''
      }
      let fieldArr
      if (fieldString && fieldString.length > 0) {
        fieldArr = fieldString.split('&')
        fieldArr.map((itemLink, itemLinkIndex) => {
          dataNewChain[itemLink.split('=')[0].trim()] = itemLink.split('=')[1].trim()
        })

        const closeModalFuc = () => {
          this.setState({ ...INITIAL_STATE, isActiveCamera: true, isStopScan: false }, () => {
            this.closeModal()
          })
        }

        if (dataNewChain && dataNewChain.name.length > 0 && dataNewChain.chainid.length > 0 && dataNewChain.rpc.length > 0 && dataNewChain.symbol.length > 0 && dataNewChain.decimal.length > 0) {
          this.dismissKeyboard()
          this.popup = (
            <AddChainPopup
              showAlert={this.showAlert}
              dataNewChain={dataNewChain}
              closeModal={closeModalFuc}
              _this={this} />
          )
          this.backdropPressToClose = false
          this.swipeToClose = false
          this.popsitionPopup = 'center'
          this.openModal()
        }
      }
    })
  }

  onFocusAction = (isFocusPasteView) => {
    this.setState({
      isFocusPasteView: isFocusPasteView
    })
  }

  handleWalletConnectPay = async (link, requestAgain = 2) => {
    try {
      this.setState({ isLoadingWalletConnectPay: true, isStopScan: true, isActiveCamera: false })
      const reScan = () => {
        this.setState({ isLoadingWalletConnectPay: false, isStopScan: false, isActiveCamera: true })
      }
      const isSupport = await WalletConnectPay.isSupport()

      if (!isSupport) {
        this.showAlert(I18n.t('WalletConnect.errorConnect'), '', { type: true, callback: reScan })
        return
      }

      const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
      const { account } = activeAccount
      const addressCurrent = account.address

      const arrChainPayment = []
      let isSupportPaymentInServices = false

      const paymentOptions = await WalletConnectPay.getPaymentOptions(link, [addressCurrent])
      if (!paymentOptions) {
        this.showAlert(I18n.t('WalletConnect.errorConnect'), '', { type: true, callback: reScan, timeout: 4000 })
        return
      }
      if (paymentOptions?.options?.length === 0) {
        this.showAlert(I18n.t('Content.notEnoughBalance'), '', { type: true, callback: reScan, timeout: 4000 })
        return
      }

      paymentOptions?.options?.forEach(option => {
        if (option?.actions?.length > 0) {
          isSupportPaymentInServices = true
        }
        const chainId = option?.account?.split(':')?.[1]
        if (chainId) {
          arrChainPayment.push(Number(chainId))
        }
      })

      if (!isSupportPaymentInServices) {
        if (requestAgain === 0) {
          this.showAlert(I18n.t('v2.scan.tryAgainPayment'), '', { type: true, callback: reScan, timeout: 4000 })
        } else {
          await sleep(1000)
          await this.handleWalletConnectPay(link, requestAgain - 1)
        }
        return
      }

      await refreshAccountTokens(addressCurrent, { chainIds: arrChainPayment })

      NavigationActions.navigate(NAME_SCREEN.walletConnectPay, {
        payLink: link,
        paymentOptions
      })
      this.setState({ ...INITIAL_STATE, isActiveCamera: true })
    } catch (error) {
      // console.log('handleWalletConnectPay unexpected error:', error)
      this.showAlert(I18n.t('WalletConnect.errorConnect'), '', { type: true })
    }
  }

  onBarCodeRead = async (event, isFromPasteCode) => {
    try {
      const QRCodeData = isFromPasteCode
        ? event?.data
        : event?.nativeEvent?.codeStringValue

      const { lastScanTime, isStopScan } = this.state
      const currentScreen = NavigationActions.getCurrentScreen()
      const diffSecond = lastScanTime ? ((new Date()).getTime() - lastScanTime) / 1000 : 4

      const isCanScan = currentScreen === 'scanScreen' && !isStopScan && diffSecond > 2 && QRCodeData

      if (isCanScan || isFromPasteCode) {
        this.setState({
          QRCodeData,
          lastScanTime: (new Date()).getTime(),
          isLoadingWalletConnect: true
        })

        if (isWCPaymentLink(QRCodeData)) {
          await this.handleWalletConnectPay(QRCodeData)
        } else if (QRCodeData.includes('add-chain')) {
          this.onHandleOpenAddChainPopup(QRCodeData)
        } else if (isWalletConnectPattern(QRCodeData) || isFromPasteCode) {
          this.setState({
            isStopScan: true,
            isActiveCamera: false,
            isFocusPasteView: false
          }, async () => {
            try {
              // eslint-disable-next-line no-unused-vars
              const notiSettings = await requestNotifications(['alert'])

              const authStatus = await messaging().requestPermission()
              const isEnabledPushNoti = authStatus === messaging.AuthorizationStatus.AUTHORIZED || authStatus === messaging.AuthorizationStatus.PROVISIONAL
              // const isEnabledPushNotiAndroid = await NotificationManager.areNotificationsEnabled()

              if (!isEnabledPushNoti) {
                ReduxService.remoteDebugLog('!isEnabledPushNoti', 'calling requestPermissionNoti()')
                this.requestPermissionNoti()
              } else {
                let tokenFireBase
                let connector

                try {
                  tokenFireBase = await messaging().getToken()
                } catch (error) {
                  ReduxService.remoteDebugLog('messaging().getToken()-error', error?.message || 'no error message')
                  // do nothing
                }

                const wcV2 = QRCodeData.includes('@2')

                try {
                  connector = await getConnectorV2()

                  const clientId = await connector.core.crypto.getClientId()

                  connector.registerDeviceToken({
                    token: tokenFireBase, // device token
                    clientId,
                    notificationType: 'fcm', // notification type
                    enableEncrypted: true // flag that enabled detailed notifications
                  })
                } catch (e) {
                  ReduxService.remoteDebugLog('registerDeviceToken() catch-error', e?.message || 'no error message')
                  // error
                }

                if (connector) {
                  this.setState({
                    lastScanTime: (new Date()).getTime(),
                    connector,
                    isStopScan: true,
                    uri: connector.uri || QRCodeData,
                    isActiveCamera: false,
                    isLoadingWalletConnect: true
                  }, async () => {
                    if (wcV2) {
                      await this.subscribeToEventsV2()
                    }
                  })
                } else {
                  ReduxService.remoteDebugLog('!connector', isFromPasteCode ? 'from paste code' : 'from scan qr code')
                  Alert.alert(I18n.t('WalletConnect.errorConnect'), null, [
                    {
                      text: 'OK',
                      onPress: () => {
                        this.setState({
                          ...INITIAL_STATE,
                          isActiveCamera: true,
                          wcUriPaste: isFromPasteCode ? this.state.wcUriPaste : 'null'
                        })
                      }
                    }
                  ])
                }
              }
            } catch (e) {
              ReduxService.remoteDebugLog('scan WC - catch', e?.message || 'no message')
              Alert.alert(I18n.t('WalletConnect.errorConnect'), null, [
                {
                  text: 'OK',
                  onPress: () => {
                    this.setState({
                      ...INITIAL_STATE,
                      isActiveCamera: true,
                      wcUriPaste: isFromPasteCode ? this.state.wcUriPaste : 'null'
                    })
                  }
                }
              ])
            }
          })
        } else {
          Clipboard.setString(QRCodeData)
          this.showAlert(I18n.t('Initial.copyDone', { value: 'Content' }), '', { type: 'toast' })
        }
      }
    } catch (e) {
      // console.log('e' + e)
    }
  }

  // Scan - Step 2 - pairing and listen event
  subscribeToEventsV2 = async (isFromDeepLink = false) => {
    const { uri } = this.state
    const connectorV2 = await getConnectorV2()

    // let canConnect = false
    // setTimeout(() => {
    //   if (canConnect === false) {
    //     Alert.alert(I18n.t('WalletConnect.errorConnect'), null, [
    //       {
    //         text: 'OK',
    //         onPress: () => {
    //           this.setState({ ...INITIAL_STATE, isActiveCamera: true })
    //         }
    //       }
    //     ])
    //   }
    // }, 10000)

    if (connectorV2) {
      try {
        connectorV2.on('session_authenticate', async (wcAuthenticatePayload) => {
          // SIWE / WalletConnect one-click-auth is temporarily unsupported —
          // reject the request instead of prompting. Set the payload + connector
          // first so rejectWCAuthSession can read them from state.
          this.setState({
            wcAuthenticatePayload: wcAuthenticatePayload,
            connector: connectorV2,
            isLoadingWalletConnect: false
          }, () => {
            this.rejectWCAuthSession(isFromDeepLink)
          })
        })

        connectorV2.on('session_proposal', async (proposal) => {
          debugInfo('session_proposal', { proposal })
          // Hand the proposal off to the WalletConnect management screen, which
          // hosts the connect drawer — the confirm sheet should appear there,
          // not on the scan/camera screen.
          this.setState({
            wcSessionProposal: proposal,
            connector: connectorV2,
            isLoadingWalletConnect: false
          }, () => {
            this.handoffConnectProposal(proposal, isFromDeepLink)
          })
        })

        await connectorV2.pair({ uri: uri })
      } catch (e) {
        ReduxService.remoteDebugLog('subscribeToEventsV2', e?.message || 'no message')
        Alert.alert(I18n.t('WalletConnect.errorConnect'), null, [
          {
            text: 'OK',
            onPress: () => {
              this.setState({ ...INITIAL_STATE, isActiveCamera: true })
            }
          }
        ])
      }
    }
  }

  rejectWCAuthSession = async (isFromDeepLink) => {
    const { connector, wcAuthenticatePayload } = this.state
    try {
      if (connector) {
        await connector.rejectSessionAuthenticate(
          {
            id: wcAuthenticatePayload.id,
            error: getSdkError('USER_REJECTED')
          }
        )
      }
      this.closeModal()
      this.setState({ ...INITIAL_STATE, isActiveCamera: true }, () => {
        if (isFromDeepLink) {
          redirectBackToDapp(this.showAlert)
        }
      })
    } catch (e) {
      NavigationActions.goBack()
    }
  }

  /**
   * Scan - Step 3 - 1 - APPROVE the session_proposal.
   *
   * New model (v2): connect with the CURRENT account only, across ALL eip155
   * chains the dApp requests (required + optional). No account/chain picker —
   * the modal just confirms the dApp. The redux session entry keeps the legacy
   * shape (so signing / manageRequestScreenV2 keep working) and additionally
   * stores `accountAddress` so connected dApps can be listed per account.
   */
  getUrlIconWalletConnect = (urlIcon, urlSite) => {
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

  // Route the WC session_proposal to the right place to show the connect drawer.
  //  - MOBILE deep link: stay on the scan screen and open the drawer HERE (no
  //    account context yet — the user picks one in the drawer). After connecting
  //    we switch to that account and land on its WalletConnect screen.
  //  - Scanned FROM the WalletConnect screen (current account): hand the proposal
  //    off to that screen, which hosts the drawer, then leave the camera screen.
  handoffConnectProposal = (proposal, isFromDeepLink = false) => {
    let siteIcon = proposal?.params?.proposer?.metadata?.icons?.[0]
    const siteUrl = proposal?.params?.proposer?.metadata?.url
    const siteName = proposal?.params?.proposer?.metadata?.name
    siteIcon = this.getUrlIconWalletConnect(siteIcon, siteUrl)

    const pending = { proposal, uri: this.state.uri, isFromDeepLink, siteIcon, siteName, siteUrl }

    if (isFromDeepLink) {
      this.setState({ isActiveCamera: false }, () => {
        this.openConnectWhenReady(pending)
      })
      return
    }

    setPendingWcConnect(pending)
    this.setState({ ...INITIAL_STATE, isActiveCamera: false })
    this.goToWalletConnectScreen()
  }

  // The drawer height is computed deterministically in openConnectDrawer (screen
  // height − header), so we no longer need to wait for the global layout anchors
  // to be measured before opening.
  openConnectWhenReady = (pending) => {
    this.openConnectDrawer(pending)
  }

  // Opens the dApp connect confirmation as a drawer on the scan screen (deep link).
  openConnectDrawer = ({ proposal, uri, isFromDeepLink, siteIcon, siteName, siteUrl }) => {
    this._wcProposal = proposal
    this._wcUri = uri
    this._wcFromDeepLink = isFromDeepLink
    // Dismissing the drawer without pressing Connect must reject the proposal.
    this._wcActionTaken = false

    // This drawer (only) should reach up to just below the PAGE HEADER — not the
    // header+title anchor the default height uses. Passing an explicit heightDrawer
    // overrides BaseContainer's heightPopupDefault for this drawer alone, so other
    // screens/drawers keep their normal (shorter) height.
    const detailHeightDrawer = getHeightScreen() - getHeightHeader(true)

    this.openDrawer({
      heightDrawer: detailHeightDrawer,
      onClose: () => {
        if (!this._wcActionTaken) {
          this.handleRejectConnect()
        }
      },
      children: (
        <WalletConnectConnectModal
          proposal={proposal}
          siteIcon={siteIcon}
          siteName={siteName}
          siteUrl={siteUrl}
          isFromDeepLink={isFromDeepLink}
          onApprove={this.handleApproveConnect}
          onReject={this.handleRejectConnect}
        />
      )
    })
  }

  handleApproveConnect = (chainIds, account, urlVerifyState) => {
    this._wcActionTaken = true
    approveWalletConnectProposal({
      proposal: this._wcProposal,
      uri: this._wcUri,
      isFromDeepLink: this._wcFromDeepLink,
      chainIds,
      account,
      urlVerifyState,
      onClose: () => {
        this.closeDrawer()
        // Switch to the account that connected, then land on its WalletConnect
        // screen (the list there is filtered by the current account).
        if (account?.address) {
          ReduxService.setActiveAccount(account)
        }
        this.setState({ ...INITIAL_STATE, isActiveCamera: false }, () => {
          // Mobile deep link: the scan screen was only opened to handle the URI.
          // REPLACE it (don't navigate/push) so it isn't left in the back stack —
          // otherwise pressing back from the WalletConnect screen returns to the
          // camera. (Desktop pops the scan screen before showing the drawer.)
          NavigationActions.replace(NAME_SCREEN.walletConnect)
        })
      },
      onError: () => this.showAlert('', '', { type: true })
    })
  }

  handleRejectConnect = () => {
    this._wcActionTaken = true
    rejectWalletConnectProposal(this._wcProposal, () => {
      this.closeDrawer()
      // Mobile deep link: don't leave the user staring at the camera after a
      // reject. Pop the scan screen off the stack (it sits above home) and bounce
      // back to the dApp, matching the deep-link auth-reject flow.
      this.setState({ ...INITIAL_STATE, isActiveCamera: false }, () => {
        if (this._wcFromDeepLink) {
          redirectBackToDapp(this.showAlert)
        }
        NavigationActions.goBack()
      })
    })
  }

  // Land on the WalletConnect screen WITHOUT stacking up scan screens. RN v7's
  // navigate() no longer pops back to an existing screen, so opening scan→connect
  // repeatedly (scan is opened FROM the WalletConnect screen) would pile scan
  // screens under it. So:
  //  - if a WalletConnect screen is already in the stack, pop straight back to it
  //    (dropping the scan screens above);
  //  - else if the scan screen is on top (e.g. opened directly from home when no
  //    dApp is connected yet), REPLACE it so pressing back from WalletConnect
  //    returns to home, not the camera. The pending proposal is stored in
  //    setPendingWcConnect and re-hosted by the WalletConnect screen on mount, so
  //    unmounting the scan screen here is safe (unlike the deep-link flow, which
  //    hosts its own drawer and never reaches this method).
  goToWalletConnectScreen = () => {
    const routes = navigationRef.isReady() ? (navigationRef.getState()?.routes || []) : []
    const wcIndex = routes.map((r) => r.name).lastIndexOf(NAME_SCREEN.walletConnect)
    const topIndex = routes.length - 1
    if (wcIndex >= 0 && wcIndex < topIndex) {
      NavigationActions.pop(topIndex - wcIndex)
    } else if (routes[topIndex]?.name === NAME_SCREEN.scanScreen) {
      NavigationActions.replace(NAME_SCREEN.walletConnect)
    } else {
      NavigationActions.navigate(NAME_SCREEN.walletConnect)
    }
  }

  setDefaultClose = () => {
    this.closeModal()
    this.setState({ isStopScan: false })
    NavigationActions.navigate('home')
  }

  handleToBack = () => {
    NavigationActions.goBack()
  }

  render () {
    const Template = this.view

    return (
      <Template
        noHeader
        noFooter
        _this={this}
      />
    )
  }
}

const mapStateToProps = (state) => ({
  walletConnectRedux: state.walletConnectRedux,
  callRequestRedux: state.callRequestRedux,
  accountListRedux: state.accountListRedux,
  blockchainListRedux: state.blockchainListRedux
})

const mapDispatchToProps = (dispatch) => {
  return {
    setWalletConnect: bindActionCreators(StorageReduxAction.setWalletConnect, dispatch),
    setCallRequest: bindActionCreators(StorageReduxAction.setCallRequest, dispatch)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(ScanScreen)
