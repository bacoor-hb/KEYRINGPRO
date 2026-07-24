import React from 'react'
import { View, StyleSheet, StatusBar } from 'react-native'
import Modal from 'react-native-modalbox'
import { connect } from 'react-redux'
import BaseContainer from 'frontend/Container/BaseContainer'
import containerStyles from 'frontend/Container/styles'
import ToastNotification from 'frontend/Components/Alert/Alert'
import MyDrawerUI from 'frontend/Components/UI/MyDrawer/ui'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import { ThemeContext, defaultContext } from 'frontend/Contexts/ThemeContext'
import { width, getHeightHeader, getHeightScreen } from 'common/styles'
import RequestDetailDrawer from 'frontend/Screen/WalletConnect/Component/RequestDetailDrawer'
import WalletConnectRequestsModal from 'frontend/Screen/WalletConnect/Component/WalletConnectRequestsModal'
import SignatureRequestCard from 'frontend/Screen/WalletConnect/Component/SignatureRequestCard'
import { registerWcRequestsOpener, unregisterWcRequestsOpener, stashLockedWcRequest } from 'common/walletConnectPending'
import { hasPassword as hasVaultPassword, isUnlocked } from 'common/secureVault'
import { ANIMATION_DRAWER } from 'common/constants/drawer'

const SIGN_METHODS = ['personal_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4']

/**
 * Always-mounted, transparent overlay (rendered at the app root) that hosts the
 * WalletConnect requests drawer. An incoming request opens this drawer over
 * WHATEVER screen the user is on — no navigation to the WalletConnect screen.
 *
 * It extends BaseContainer to reuse its drawer/modal/alert system + nfcProxy, so
 * RequestCard's `_this` (signing, sub-modals, alerts) keeps working unchanged.
 * render() is overridden to draw only the overlays (Toast + popup Modal + Drawer)
 * with pointerEvents='box-none' so touches pass through to the screen below when
 * nothing is open.
 */
class WalletConnectRequestHost extends BaseContainer {
  componentDidMount () {
    registerWcRequestsOpener(this.openRequestsDrawer)
  }

  componentWillUnmount () {
    super.componentWillUnmount()
    unregisterWcRequestsOpener(this.openRequestsDrawer)
  }

  getAccountIndexByTopic = (topic) => {
    const { walletConnectRedux } = this.props
    return (walletConnectRedux || []).findIndex((s) => s?.session?.topic === topic)
  }

  // Opens WalletConnect request UI over whatever screen the user is on.
  //   - A signature request always shows as its OWN content-fit drawer (independent,
  //     over the current screen) — an incoming sign request does NOT force the dApp
  //     detail open.
  //   - The dApp detail (anchored) opens when the user TAPS a dApp (fromTap), or for
  //     an incoming non-signature (tx) request. When tapping a dApp that has a pending
  //     signature, the signature drawer stacks on top of the detail; rejecting/signing
  //     closes only the top one, leaving the full-height detail intact (no squishing).
  openRequestsDrawer = (topic, { fromTap = false } = {}) => {
    if (!topic) return

    // SECURITY: an incoming request (not a user tap) that arrives while the vault
    // is locked must not show over the unlock screen. The request stays in
    // callRequestRedux; stash the topic and replay it after unlock
    // (UnlockScreen.afterUnlock → flushLockedWcRequests). fromTap only happens from
    // an already-unlocked screen, so it's never gated.
    if (!fromTap && hasVaultPassword() && !isUnlocked()) {
      stashLockedWcRequest(topic)
      return
    }

    const { walletConnectRedux, callRequestRedux } = this.props
    const accountIndex = (walletConnectRedux || []).findIndex((s) => s?.session?.topic === topic)
    const requests = callRequestRedux?.[accountIndex] || []
    const signRequest = requests.find((r) => SIGN_METHODS.includes(r?.method))

    // dApp detail: on tap (always), or for an incoming tx request. Never just to
    // host a signature — the signature drawer stands on its own.
    const shouldOpenDetail = fromTap || !signRequest
    if (shouldOpenDetail && this._openDetailTopic !== topic) {
      this._openDetailTopic = topic
      // This drawer (only) should reach up to just below the PAGE HEADER — not the
      // header+title anchor the default height uses. Passing an explicit heightDrawer
      // overrides BaseContainer's heightPopupDefault for this drawer alone, so other
      // screens/drawers keep their normal (shorter) height.
      const detailHeightDrawer = getHeightScreen() - getHeightHeader(true)
      this.openDrawer({
        heightDrawer: detailHeightDrawer,
        onClose: () => { this._openDetailTopic = null },
        children: <WalletConnectRequestsModal topic={topic} _this={this} />
      })
    }

    // Signature request: independent content-fit drawer (stacks over whatever is
    // currently shown — the current screen, or the dApp detail when tapped).
    if (signRequest && this._openSignId !== signRequest.id) {
      this._openSignId = signRequest.id
      this.drawer.current.openDrawer({
        addDrawer: true,
        // Dim the layer behind (the detail drawer / current screen) like a modal.
        backdrop: true,
        onClose: () => { this._openSignId = null },
        animation: ANIMATION_DRAWER.SLIDE_FROM_BOTTOM,
        children: (
          <SignatureRequestCard
            item={signRequest}
            accountIndex={accountIndex}
            showAlert={this.showAlert}
            _this={this}
          />
        )
      }, null)
    }
  }

  // Opens the request-detail info modal (the "?" icon on a request card).
  onHandleShowInfoReqest = (item) => {
    // Stacked drawer (on top of the requests/sign drawer), new design — replaces
    // the legacy this.popup + InfoRequestDetail.
    const detailHeightDrawer = getHeightScreen() - getHeightHeader(true)
    this.openDrawer({
      heightDrawer: detailHeightDrawer,
      addDrawer: true,
      backdrop: true,
      children: <RequestDetailDrawer request={item} _this={this} />
    })
  }

  render () {
    return (
      <ThemeContext.Consumer>{(context = defaultContext) => {
        return (
          <View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
            <ToastNotification ref={this.setRefsAlert} />
            <Modal
              keyboardTopOffset={0}
              disableKeyboardHandling={this.disableModalKeyboardHandling}
              style={[containerStyles.modalFormStyle, this.popsitionPopup === 'bottom' && containerStyles.flexEnd, (this.heightPopupDefault || this.heightPopup) && { height: (this.heightPopup || this.heightPopupDefault) }]}
              swipeToClose={this.swipeToClose}
              backdropPressToClose={this.backdropPressToClose}
              entry={this.entryPopup}
              position={this.popsitionPopup}
              ref={this.setRefsPopup}
              swipeArea={this.swipeArea}
              onOpened={() => {
                this.setStatusBarBackgroundColor(context.modeTheme)
              }}
              onClosed={() => {
                this.popupIsOpenRef.current = false
                this.setStatusBarBackgroundColor()
                this.onPopupClosed && this.onPopupClosed()
                this.onPopupClosed = null
                this.configLinearGradient = null
                this.disableModalKeyboardHandling = false
              }}
            >
              {
                this.popup && (
                  <StatusBar
                    translucent
                    backgroundColor={this.calculateStatusBarBackgroundColor(context.modeTheme)}
                    barStyle={this.setStatusBarColor(context.modeTheme)} />
                )
              }
              <MyLinearGradient variant='modal' {...this.configLinearGradient}>
                <View style={[{ width: width(100) }, (this.heightPopupDefault || this.heightPopup) && { height: (this.heightPopup || this.heightPopupDefault) }]}>
                  {this.popup}
                </View>
              </MyLinearGradient>
            </Modal>

            <MyDrawerUI ref={this.drawer} />
          </View>
        )
      }}
      </ThemeContext.Consumer>
    )
  }
}

const mapStateToProps = (state) => ({
  walletConnectRedux: state.walletConnectRedux,
  callRequestRedux: state.callRequestRedux
})

export default connect(mapStateToProps)(WalletConnectRequestHost)
