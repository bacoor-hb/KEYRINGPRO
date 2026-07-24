import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { NavigationActions } from 'src/navigation/NavigationService'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { lowerCase } from 'common/function'
import { storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import Page from './page'
import AIChainSelector, { AI_SEARCH_CHAIN_STORAGE_KEY } from './Component/AIChainSelector'

class AISearchScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    // A chainId handed in via route params (e.g. opening AI search from a
    // token's detail) seeds the selected chain so the screen opens on it,
    // overriding the picker's stored last-chain init.
    const initialChainId = props?.route?.params?.chainId
    this.state = {
      selectedChainId: initialChainId != null ? Number(initialChainId) : null
    }
  }

  componentDidMount () {
    // Persist the seeded chain like a normal chain switch so the picker's stored
    // last-chain follows (next open without a param lands on the same chain).
    const initialChainId = this.props?.route?.params?.chainId
    if (initialChainId != null) {
      storeDataToAsyncStorage(AI_SEARCH_CHAIN_STORAGE_KEY, Number(initialChainId))
    }
  }

  setSelectedChainId = (chainId) => {
    this.setState({ selectedChainId: chainId })
  }

  handleClose = () => {
    NavigationActions.goBack()
  }

  render () {
    const Template = this.view
    const { accountListRedux = [], activeAccount, route } = this.props
    // No address param (e.g. opened from the footer search or the NFC helper) →
    // fall back to the currently-active account, NOT accountListRedux[0], so the
    // header + chat history match the account the user is actually on.
    const paramAddress = lowerCase(route?.params?.address || activeAccount?.account?.address || '')
    const infoAccount = accountListRedux.find((a) => lowerCase(a?.address) === paramAddress) ||
      accountListRedux[0] ||
      {}

    return (
      <Template
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        headerBlur
        paddingTop={0}
        leftAction={this.handleClose}
        middleView={<InfoAccountHeader infoAccount={infoAccount} showAlert={this.showAlert} />}
        rightView={(
          <AIChainSelector
            isUseHeader
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
  activeAccount: state.activeAccount,
  aiSearchHistoryRedux: state.aiSearchHistoryRedux,
  userLocationRedux: state.userLocationRedux
})

const mapDispatchToProps = (dispatch) => ({
  setAiSearchHistory: bindActionCreators(StorageReduxAction.setAiSearchHistory, dispatch)
})

export default connect(mapStateToProps, mapDispatchToProps)(AISearchScreen)
