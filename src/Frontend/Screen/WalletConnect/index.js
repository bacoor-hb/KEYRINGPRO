import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import { InteractionManager } from 'react-native'
import Page from './page'
import I18n from 'assets/Lang'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import MyButton from 'frontend/Components/UI/MyButton'
import { connect } from 'react-redux'
import { lowerCase } from 'common/function'
import { getHeightHeader, getHeightScreen } from 'common/styles'
import HistoryWCPay from './Component/HistoryWCPay'
import WalletConnectConnectModal from './Component/WalletConnectConnectModal'
import ReduxService from 'common/redux'
import {
  consumePendingWcConnect,
  approveWalletConnectProposal,
  rejectWalletConnectProposal
} from 'src/Services/WalletConnectSession'
import { getWcRequestsOpener } from 'common/walletConnectPending'
import { REDUX_KEY } from 'common/constants/redux'

class WalletConnectScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page

    // The connected-dApps list is read from walletConnectRedux in page.js.
    this.state = {}
  }

  componentDidMount () {
    // This screen hosts the CONNECT drawer (after scanning, handed off + consumed
    // on focus). Incoming REQUESTS are handled by the global
    // WalletConnectRequestHost overlay instead, so they show over any screen.
    this.unsubscribeFocus = this.props.navigation?.addListener('focus', this.onScreenFocus)
    this.onScreenFocus()
  }

  componentWillUnmount () {
    super.componentWillUnmount()
    this.unsubscribeFocus && this.unsubscribeFocus()
  }

  // Defer consuming the hand-off until the navigation transition / layout has
  // settled. On a FRESH mount opening a drawer synchronously in componentDidMount
  // is too early and the sheet doesn't show; runAfterInteractions waits for the
  // screen to be ready.
  onScreenFocus = () => {
    InteractionManager.runAfterInteractions(() => {
      this.checkPendingConnect()
    })
  }

  checkPendingConnect = () => {
    const pending = consumePendingWcConnect()
    if (pending) {
      this.openConnectWhenReady(pending)
    }
  }

  // The connect modal's root is flex:1, so it needs an ANCHORED drawer height. On a
  // FRESH screen mount (mobile deep link cold-starts straight onto this screen) the
  // layout isn't measured yet → heightPopupDefault is 0 → the drawer would open
  // content-fit and the flex:1 modal collapses to nothing. Retry until the layout
  // has been measured (or give up after ~1s and open anyway).
  openConnectWhenReady = (pending, attempt = 0) => {
    this.getHeightLayoutModal()
    if (this.heightPopupDefault > 0 || attempt >= 10) {
      this.openConnectDrawer(pending)
    } else {
      setTimeout(() => this.openConnectWhenReady(pending, attempt + 1), 100)
    }
  }

  // Opens the dApp connect confirmation as a drawer on THIS screen.
  openConnectDrawer = ({ proposal, uri, isFromDeepLink, siteIcon, siteName, siteUrl }) => {
    this._wcProposal = proposal
    this._wcUri = uri
    this._wcFromDeepLink = isFromDeepLink
    // Dismissing the drawer without pressing Connect must reject the proposal.
    this._wcActionTaken = false

    // Anchor the sheet right BELOW the account header (name + address), not below
    // the 'WalletConnect' title. heightPopupDefault = container − title anchor, so
    // adding the anchor height back gives the FULL page height → the sheet top sits
    // just under the nav header. A small gap is left so the sheet's rounded top /
    // pinned header doesn't clip the address line. Passed as heightDrawer so only
    // this drawer is affected (other drawers on this screen keep the default height).
    this.getHeightLayoutModal()
    // This drawer (only) should reach up to just below the PAGE HEADER — not the
    // header+title anchor the default height uses. Passing an explicit heightDrawer
    // overrides BaseContainer's heightPopupDefault for this drawer alone, so other
    // screens/drawers keep their normal (shorter) height.
    const detailHeightDrawer = getHeightScreen() - getHeightHeader(true)

    this.openDrawer({
      // The modal keeps its own header pinned and a plain ScrollView scrolls the
      // body within this height.
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
      onClose: () => this.closeDrawer(),
      onError: () => this.showAlert('', '', { type: true })
    })
  }

  handleRejectConnect = () => {
    this._wcActionTaken = true
    rejectWalletConnectProposal(this._wcProposal, () => this.closeDrawer())
  }

  handleOpenDetail = (item) => {
    // Tapping a dApp opens its detail via the global host overlay; fromTap also
    // stacks the signature drawer on top when a sign request is pending (incoming
    // sign requests instead show the signature drawer on its own).
    getWcRequestsOpener()?.(item?.topic, { fromTap: true })
  }

  handleDisconnect = (topic) => {
    // Removes the session from redux + tears down the WC session/pairing. The
    // list (page.js) re-renders from walletConnectRedux automatically.
    ReduxService.disconnectWalletConnectV2(topic, true)
  }

  // Topics of the dApps connected with the CURRENT account (matches the list).
  getCurrentAccountTopics = () => {
    const { walletConnectRedux } = this.props
    const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
    const addr = lowerCase(activeAccount?.account?.address || '')
    return (walletConnectRedux || [])
      .filter((item) => item?.isWalletConnectV2 && item?.session?.topic)
      .filter((item) => {
        const owner = item?.accountAddress || lowerCase(item?.accountArr?.[0]?.split(':')?.[2] || '')
        return !owner || owner === addr
      })
      .map((item) => item.session.topic)
  }

  handleDisconnectAll = () => {
    this.getCurrentAccountTopics().forEach((topic) => ReduxService.disconnectWalletConnectV2(topic, true))
  }

  handleViewHistoryWCP = () => {
    this.openDrawer({
      children: <HistoryWCPay />
    })
  }

  render () {
    const Template = this.view
    const hasConnections = this.getCurrentAccountTopics().length > 0

    return (
      <Template
        noFooter
        _this={this}
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader showAlert={this.showAlert} />}
        rightView={hasConnections
          ? (
            <MyButton
              isUseHeader
              size='small'
              variant='dangerous'
              noMinWidth
              label={I18n.t('v2.walletConnect.disconnectAll')}
              onPress={this.handleDisconnectAll}
            />
          )
          : null}
      />
    )
  }
}

const mapDispatchToProps = (dispatch) => {
  return {}
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  walletConnectRedux: state.walletConnectRedux
})

export default connect(mapStateToProps, mapDispatchToProps)(WalletConnectScreen)
