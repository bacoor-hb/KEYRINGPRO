import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import { connect } from 'react-redux'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { lowerCase } from 'common/function'
import Page from './page'
import RightHeaderChainSelector from './Component/RightHeaderChainSelector'
import HiddenTokenList from './Component/HiddenTokenList'
import AddTokenDrawer from './Component/AddTokenDrawer'
import ReduxService from 'common/redux'
import { NAME_SCREEN } from 'common/constants/navigation'

class TokenListScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    const savedChainId = ReduxService.getChainIdByAddressScreen(NAME_SCREEN.tokenList, null)
    const activeEvmChainIds = (props?.activeEvmChainIdsRedux || []).map(Number)
    // Guard the initial value too: a persisted chain may have been hidden while
    // this screen was closed — fall back to "All" instead of a dangling chain.
    const isActive = savedChainId == null || activeEvmChainIds.includes(Number(savedChainId))
    this.state = { selectedChainId: isActive ? savedChainId : null }
    this.needsPersistSync = !isActive
  }

  componentDidMount () {
    // The persisted chain was hidden while this screen was closed: the initial
    // state already fell back to "All", now also clear the stale value in redux
    // so it doesn't linger. (Dispatch here, not in the constructor.)
    if (this.needsPersistSync) {
      this.needsPersistSync = false
      ReduxService.setChainIdByAddressScreen(null, NAME_SCREEN.tokenList)
    }
  }

  componentDidUpdate () {
    // If the currently-selected chain is hidden (no longer in the active EVM
    // list), fall back to "All" so the header/filter don't point at a chain
    // the user can't see anymore.
    const { selectedChainId } = this.state
    const activeEvmChainIds = this.props?.activeEvmChainIdsRedux || []
    if (
      selectedChainId != null &&
      !activeEvmChainIds.map(Number).includes(Number(selectedChainId))
    ) {
      this.setSelectedChainId(null)
    }
  }

  setSelectedChainId = (chainId) => {
    this.setState({ selectedChainId: chainId })
    ReduxService.setChainIdByAddressScreen(chainId, NAME_SCREEN.tokenList)
  }

  handleOpenAddToken = () => {
    this.openDrawer({
      children: <AddTokenDrawer _this={this} />
    })
  }

  handleOpenHiddenTokens = () => {
    const address = lowerCase(this.props?.route?.params?.address || '')
    this.openDrawer({
      children: (
        <HiddenTokenList
          address={address}
          selectedChainId={this.state.selectedChainId}
          onClose={this.closeModal}
        />
      )
    })
  }

  render () {
    const Template = this.view
    const { accountListRedux = [], route } = this.props
    const paramAddress = lowerCase(route?.params?.address || '')
    const paramIndex = route?.params?.indexAccount
    const infoAccount = (typeof paramIndex === 'number' && accountListRedux[paramIndex]) ||
      accountListRedux.find((a) => lowerCase(a?.address) === paramAddress) ||
      {}

    return (
      <Template
        noFooter
        headerBlur
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader infoAccount={infoAccount} showAlert={this.showAlert} />}
        rightView={(
          <RightHeaderChainSelector
            selectedChainId={this.state.selectedChainId}
            onSelect={this.setSelectedChainId}
          />
        )}
      />
    )
  }
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  activeEvmChainIdsRedux: state.activeEvmChainIdsRedux
})

export default connect(mapStateToProps)(TokenListScreen)
