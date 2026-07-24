import BaseContainer from 'frontend/Container/BaseContainer'
import React, { createRef } from 'react'
import Page from './page'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import ReduxService from 'common/redux'
import { connect } from 'react-redux'
import { SUPPORTED_CHAINS_BY_SERVICE_MORALIS } from 'common/constants/chain'
import ChainSelectorDropdown from 'frontend/Components/UI/ChainSelectorDropdown'

class SendReceivedHistoryScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.layoutContainerRef = createRef()
    this.typeScreen = props.route.params.typeScreen || 'send'
    this.state = { chainId: null }
  }

  componentDidMount () {
    const { activeEvmChainIdsRedux } = this.props
    let chainIdDefault = ReduxService.getChainIdByAddressScreen(this.typeScreen, null)

    // default active chain
    if (!chainIdDefault && activeEvmChainIdsRedux?.includes(1)) {
      chainIdDefault = 1
    }

    for (const chainId of activeEvmChainIdsRedux) {
      if (!chainIdDefault && SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]) {
        chainIdDefault = chainId
      }
    }

    if (chainIdDefault) {
      this.setState({ chainId: chainIdDefault })

      ReduxService.setChainIdByAddressScreen(chainIdDefault, this.typeScreen)
    }
  }

  handleLayoutContainer = (e) => {
    const { height } = e.nativeEvent.layout
    this.layoutContainerRef.current = { height }
  }

  handleSelectChainId=(chainId) => {
    this.setState({ chainId })
    ReduxService.setChainIdByAddressScreen(chainId, this.typeScreen)
  }

  renderSelectChain = () => {
    const { activeEvmChainIdsRedux } = this.props
    const chainsValid = []

    for (const chainId of activeEvmChainIdsRedux) {
      if (SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]) {
        chainsValid.push(chainId)
      }
    }

    return <ChainSelectorDropdown isUseHeader maxShow={4} selectedChainId={this.state.chainId} onSelectChain={this.handleSelectChainId} data={chainsValid} />
  }

  render () {
    const Template = this.view
    return (
      <Template
        _this={this}
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader showAlert={this.showAlert} />}
        rightView={this.renderSelectChain()}
        headerBlur

      />
    )
  }
}
const mapStateToProps = (state) => ({
  activeEvmChainIdsRedux: state.activeEvmChainIdsRedux
})
export default connect(mapStateToProps)(SendReceivedHistoryScreen)
