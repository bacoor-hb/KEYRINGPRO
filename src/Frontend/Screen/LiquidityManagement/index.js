import BaseContainer from 'frontend/Container/BaseContainer'
import I18n from 'assets/Lang'
import React from 'react'
import { connect } from 'react-redux'
import Page from './page'
import RegisterAddress from './Component/RegisterAddress'
import DetailPool from './Component/DetailPool'
import MyButton from 'frontend/Components/UI/MyButton'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { getActiveLiquidityAddress } from 'common/function'
import { ACCOUNT_TYPE } from 'common/constants/account'

class LiquidityManagement extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = { }
  }

  // Register / Change address — opens a drawer (BottomSheet) instead of the clipped modal,
  // same pattern as the Setting screen. The drawer is the verified-safe teardown path, so it
  // avoids the Fabric "recycle a mounted view" crash the modal gradient caused on close.
  // heightDrawer omitted → openDrawer falls back to heightPopupDefault, which anchors the
  // sheet just under the screen header.
  handleOpenRegister = () => {
    this.openDrawer({
      children: <RegisterAddress _this={this} />,
      scrollView: false
    })
  }

  // Pool detail — same drawer pattern. DetailPool manages its own ScrollView, so scrollView:false
  // (BottomSheetView) and the default anchored height bound it for the inner scroll.
  handleOpenDetail = (item, tokenInfo0, tokenInfo1, dataListAddressCoinPoolChecked) => {
    this.openDrawer({
      children: (
        <DetailPool
          item={item}
          tokenInfo0={tokenInfo0}
          tokenInfo1={tokenInfo1}
          dataListAddressCoinPoolChecked={dataListAddressCoinPoolChecked}
        />
      ),
      scrollView: false
    })
  }

  // When registered, the header shows the account info (name + address) if the
  // address belongs to an in-app account, otherwise "Register address" + address.
  // View-only accounts are treated as not-in-app here → show "Register address".
  renderMiddleView (activeLiquidityAddress) {
    const list = this.props.accountListRedux || []
    const target = activeLiquidityAddress.toLowerCase()
    const idx = list.findIndex(a => [a?.address].some(x => x?.toLowerCase() === target))
    const isViewOnly = idx > -1 && list[idx]?.accountType === ACCOUNT_TYPE.VIEW_ONLY
    const name = idx > -1 && !isViewOnly ? (list[idx]?.name || `Account ${idx + 1}`) : I18n.t('v2.liquidity.registerAddress')
    // An LP address can be registered from outside the app, in which case it is no
    // account of this wallet and the header's view-only test can only answer "no" —
    // it would never badge an LP address that really is a contract. For those, the
    // bytecode alone decides. An LP address that IS one of the wallet's accounts
    // keeps the normal rule (view-only + contract), so a hot account of your own
    // is not badged here when it would not be badged anywhere else.
    const isInWallet = idx > -1
    return (
      <InfoAccountHeader
        infoAccount={{ name, address: activeLiquidityAddress }}
        showAlert={this.showAlert}
        alwaysCheckContract={!isInWallet}
      />
    )
  }

  render () {
    const Template = this.view
    // Single active address = first valid EVM address (old versions may have
    // stored extra / Solana addresses). '' when none registered.
    const activeLiquidityAddress = getActiveLiquidityAddress(this.props.addressRegisteredLiquidity)
    const isRegistered = !!activeLiquidityAddress
    this.state = { ...this.state, activeLiquidityAddress: activeLiquidityAddress, isRegistered }
    return (
      <Template
        noFooter
        headerBlur
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={isRegistered ? this.renderMiddleView(activeLiquidityAddress) : undefined}
        rightView={(
          <MyButton
            size='small'
            label={isRegistered ? I18n.t('v2.common.change') : I18n.t('Initial.register')}
            onPress={this.handleOpenRegister}
          />
        )}
      />
    )
  }
}

const mapStateToProps = (state) => ({
  addressRegisteredLiquidity: state.addressRegisteredLiquidity,
  addressDeletedLiquidity: state.addressDeletedLiquidity,
  accountListRedux: state.accountListRedux
})

export default connect(mapStateToProps)(LiquidityManagement)
