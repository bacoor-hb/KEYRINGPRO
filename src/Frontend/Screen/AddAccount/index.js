import React from 'react'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n from 'assets/Lang'
import BaseContainer from 'frontend/Container/BaseContainer'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import ReduxService from 'common/redux'
import { createNewWalletDataV2, importPrivateKey, lowerCase } from 'common/function'
import { registerViewOnlyAccount } from 'common/wallet'
import { NavigationActions } from 'src/navigation/NavigationService'
import Page from './page'
import CreateAccountModal from 'frontend/Components/AddAccountModals/CreateAccountModal'
import ImportAccountModal from 'frontend/Components/AddAccountModals/ImportAccountModal'
import EnterPrivateKeyModal from 'frontend/Components/AddAccountModals/EnterPrivateKeyModal'
import RegisterAccountModal from 'frontend/Components/AddAccountModals/RegisterAccountModal'
import EditLabel from 'frontend/Screen/AccountDetail/Component/EditLabel'

class AddAccountScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {}
  }

  // ── Account creation helpers (mirror WelcomeScreen so the shared modals
  // behave identically here). ─────────────────────────────────────────────────
  generateNewAccount = async (accountName) => {
    try {
      const evmAccount = await createNewWalletDataV2(accountName)
      this.addActiveEvmChainId(1)
      return evmAccount
    } catch (error) {
      return null
    }
  }

  generateAccountFromPrivateKey = async (privateKey, accountName) => {
    try {
      const evmAccount = await importPrivateKey(
        privateKey,
        accountName,
        false,
        '',
        '',
        null
      )
      if (!evmAccount) return null
      this.addActiveEvmChainId(1)
      return evmAccount
    } catch (error) {
      return null
    }
  }

  registerAccount = async (address, accountName) => {
    try {
      const evmAccount = registerViewOnlyAccount(address, accountName)
      if (!evmAccount) return null
      this.addActiveEvmChainId(1)
      return evmAccount
    } catch (error) {
      return null
    }
  }

  addActiveEvmChainId = (chainId) => {
    const { setActiveEvmChainIds, activeEvmChainIdsRedux } = this.props
    const current = activeEvmChainIdsRedux || []
    if (current.includes(chainId)) return
    setActiveEvmChainIds([...current, chainId])
  }

  // ── Success-screen actions (import private key / register address only) ──
  // Copy the new account address and show the standard "copied" toast.
  handleCopyAddress = (address) => {
    if (!address) return
    Clipboard.setString(address)
    this.showAlert(I18n.t('Initial.copyDone', { value: I18n.t('Initial.address') }), '', { type: 'toast' })
  }

  // Open the shared EditLabel drawer stacked on top of the success screen.
  // `onUpdated` lets the underlying modal reflect the new name in its own state
  // (the new account isn't the activeAccount, so EditLabel runs in props mode).
  handleEditAccountName = (account, currentName, onUpdated) => {
    this.openDrawer({
      addDrawer: true,
      children: (
        <EditLabel
          account={account}
          initialName={currentName}
          onSave={(name) => this.handleSaveAccountName(account, name, onUpdated)}
        />
      ),
      // Keep this drawer's close independent of the success drawer's onClose so
      // dismissing EditLabel returns to the success screen instead of popping
      // the AddAccount route.
      onClose: () => {}
    })
  }

  handleSaveAccountName = (account, name, onUpdated) => {
    const { setAccountList } = this.props
    const accountListRedux = ReduxService.getReduxDataByKey('accountListRedux') || []
    const index = accountListRedux.findIndex(
      (a) => lowerCase(a?.address) === lowerCase(account?.address)
    )
    if (index !== -1) {
      const accountListReduxNew = accountListRedux.slice()
      accountListReduxNew[index] = { ...accountListReduxNew[index], name }
      setAccountList(accountListReduxNew)
    }
    onUpdated?.(name)
    this.closeDrawer()
  }

  // After the modal's success screen, defer pop until the drawer finishes
  // closing so the bottom sheet animation doesn't fight the route.
  // (AddAccount is pushed from Home, so we pop back instead of navigating
  // forward — different from Welcome which navigates forward to home.)
  handleAccountCreated = () => {
    this.onDrawerClosed = () => {
      NavigationActions.goBack()
    }
  }

  // Single onClose passed to every drawer. The drawer captures onClose at open
  // time, so to keep the "set behaviour then close" pattern (like the old
  // this.onPopupClosed) we route through a mutable this.onDrawerClosed field.
  handleDrawerClosed = () => {
    const cb = this.onDrawerClosed
    this.onDrawerClosed = null
    if (cb) cb()
  }

  // ── Modal openers — mapped 1:1 to AddAccount page items. ────────────────
  handleGeneratePrivateKey = () => {
    this.onDrawerClosed = null
    this.openDrawer({
      children: (
        <CreateAccountModal
          autoStart
          onGenerateAuto={this.generateNewAccount}
          onSuccess={this.handleAccountCreated}
        />
      ),
      onClose: this.handleDrawerClosed
    })
  }

  handleImportAccount = () => {
    this.onDrawerClosed = null
    this.openDrawer({
      children: (
        <ImportAccountModal
          onSubmit={this.generateAccountFromPrivateKey}
          onSuccess={this.handleAccountCreated}
          onEditName={this.handleEditAccountName}
          onCopyAddress={this.handleCopyAddress}
        />
      ),
      onClose: this.handleDrawerClosed
    })
  }

  handleManualPrivateKey = () => {
    this.onDrawerClosed = null
    this.openDrawer({
      children: (
        <EnterPrivateKeyModal
          onSubmit={this.generateAccountFromPrivateKey}
          onSuccess={this.handleAccountCreated}
          onBack={this.handleBackFromManualPrivateKey}
          successBackEnabled
        />
      ),
      onClose: this.handleDrawerClosed
    })
  }

  // Header back button on the enter-private-key modal. Here the modal is opened
  // directly from the Add-account SCREEN (not a chooser modal), so back just
  // closes the drawer and lands back on Add-account.
  handleBackFromManualPrivateKey = () => {
    this.onDrawerClosed = null
    this.closeDrawer()
  }

  handleRegisterAddress = () => {
    this.onDrawerClosed = null
    this.openDrawer({
      children: (
        <RegisterAccountModal
          onSubmit={this.registerAccount}
          onSuccess={this.handleAccountCreated}
          onEditName={this.handleEditAccountName}
          onCopyAddress={this.handleCopyAddress}
        />
      ),
      onClose: this.handleDrawerClosed
    })
  }

  // When user taps "Manual PK" inside CreateAccountModal, swap to the
  // EnterPrivateKeyModal. Reopen on a delay > the drawer's own close
  // bookkeeping (~400ms in MyDrawer) so the new drawer isn't wiped by the
  // pending close.
  handlePickManual = () => {
    this.onDrawerClosed = null
    this.closeDrawer()
    setTimeout(() => this.handleManualPrivateKey(), 500)
  }

  render () {
    const Template = this.view
    return (
      <Template
        headerBlur
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
      />
    )
  }
}

const mapStateToProps = (state) => ({
  activeEvmChainIdsRedux: state.activeEvmChainIdsRedux,
  accountListRedux: state.accountListRedux
})

const mapDispatchToProps = (dispatch) => ({
  setActiveEvmChainIds: bindActionCreators(StorageReduxAction.setActiveEvmChainIds, dispatch),
  setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch)
})

export default connect(mapStateToProps, mapDispatchToProps)(AddAccountScreen)
