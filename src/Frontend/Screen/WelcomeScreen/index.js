import React from 'react'
import Clipboard from '@react-native-clipboard/clipboard'
import BaseContainer from 'frontend/Container/BaseContainer'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import ReduxService from 'common/redux'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { createNewWalletDataV2, importPrivateKey, lowerCase } from 'common/function'
import { getHeightHeader, pixelByHeight } from 'common/styles'
import I18n from 'assets/Lang'
import Page from './page'
import CreateAccountModal from 'frontend/Components/AddAccountModals/CreateAccountModal'
import EnterPrivateKeyModal from 'frontend/Components/AddAccountModals/EnterPrivateKeyModal'
import ImportAccountModal from 'frontend/Components/AddAccountModals/ImportAccountModal'
import RestoreFromFileModal, { pickBackupFile } from 'frontend/Components/RestoreFromFileModal'
import EditLabel from 'frontend/Screen/AccountDetail/Component/EditLabel'

class WelcomeScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      password: '',
      isFaceIdOn: false,
      isModalOpen: false
    }
  }

  setModalOpen = (open) => {
    if (this.state.isModalOpen !== open) {
      this.setState({ isModalOpen: open })
    }
  }

  // Default onClosed handler for gated modals — just clears the busy state so
  // the entry buttons re-enable. Modals that chain into the next step (e.g.
  // handlePickManual, handleAccountCreated) replace this.onDrawerClosed with
  // their own; those handlers also manage setModalOpen themselves.
  handleModalClosed = () => {
    this.setModalOpen(false)
  }

  // Single onClose passed to every drawer. The drawer captures onClose at open
  // time, so to keep the "set behaviour then close" pattern (like the old
  // this.onPopupClosed) we route through a mutable this.onDrawerClosed field.
  handleDrawerClosed = () => {
    const cb = this.onDrawerClosed
    this.onDrawerClosed = null
    if (cb) cb()
  }

  // Read the modal anchor height straight from the headerArea native view right
  // before navigating. By tap time the view is laid out, so measure() returns the
  // real height even when the onLayout JS callback hasn't fired yet (busy JS
  // thread on a cold start) or the shared ref was reset by another screen's
  // BaseContainer constructor — which is what made drawers open full-height
  // (anchored at safe-area top). Mirrors handleHeaderAnchorLayout: measured height
  // + the 42px offset. Falls through if the ref/measure isn't available.
  measureHeaderAnchorThen = (next) => {
    const view = this.refHeaderAnchorView
    if (view && view.measure) {
      view.measure((x, y, w, h) => {
        if (h) {
          ReduxService.refLayoutHeaderAnchor.current = { height: (h + pixelByHeight(42)) - getHeightHeader(true), width: w }
        }
        next()
      })
    } else {
      next()
    }
  }

  handleCreateWallet = () => {
    this.measureHeaderAnchorThen(() => {
      this.snapshotLayoutRefs()
      NavigationActions.navigate(NAME_SCREEN.setPassword, {
        onSuccess: this.handlePasswordCreatedForCreate
      })
    })
  }

  handleRestoreFromFile = () => {
    this.measureHeaderAnchorThen(() => {
      this.snapshotLayoutRefs()
      NavigationActions.navigate(NAME_SCREEN.setPassword, {
        onSuccess: this.handlePasswordCreatedForRestoreFile
      })
    })
  }

  handleRestoreWallet = () => {
    this.measureHeaderAnchorThen(() => {
      this.snapshotLayoutRefs()
      NavigationActions.navigate(NAME_SCREEN.setPassword, {
        onSuccess: this.handlePasswordCreatedForRestoreWallet
      })
    })
  }

  handlePasswordCreatedForCreate = (password, isFaceIdOn) => {
    this.setState({ password, isFaceIdOn })
    NavigationActions.goBack()
    this.restoreLayoutRefs()
    setTimeout(() => this.openCreateAccountModal(), 350)
  }

  handlePasswordCreatedForRestoreFile = (password, isFaceIdOn) => {
    this.setState({ password, isFaceIdOn })
    NavigationActions.goBack()
    this.restoreLayoutRefs()
    setTimeout(() => this.openRestoreFromFileModal(), 350)
  }

  handlePasswordCreatedForRestoreWallet = (password, isFaceIdOn) => {
    this.setState({ password, isFaceIdOn })
    NavigationActions.goBack()
    this.restoreLayoutRefs()
    setTimeout(() => this.openImportAccountModal(), 350)
  }

  // SetPassword shares global layout refs (ReduxService.refLayout*) and
  // overwrites them with its own (shrunken-by-keyboard) values. The refs don't
  // re-fire onLayout when Welcome regains focus, so we snapshot Welcome's
  // values before navigating away and restore them on return — guaranteeing
  // openDrawer -> getHeightLayoutModal reads correct height for the bottom drawer.
  snapshotLayoutRefs = () => {
    this.cachedLayout = {
      container: ReduxService.refLayoutContainer.current,
      containerDefault: ReduxService.refLayoutContainerDefault.current,
      headerAnchor: ReduxService.refLayoutHeaderAnchor.current,
      headerAnchorDefault: ReduxService.refLayoutHeaderAnchorDefault.current
    }
  }

  restoreLayoutRefs = () => {
    if (!this.cachedLayout) return
    ReduxService.refLayoutContainer.current = this.cachedLayout.container
    ReduxService.refLayoutContainerDefault.current = this.cachedLayout.containerDefault
    ReduxService.refLayoutHeaderAnchor.current = this.cachedLayout.headerAnchor
    ReduxService.refLayoutHeaderAnchorDefault.current = this.cachedLayout.headerAnchorDefault
  }

  openRestoreFromFileModal = async () => {
    // Pick file BEFORE opening the modal — on iOS the native picker conflicts
    // with a freshly presented RN modal and the modal can fail to appear.
    let file
    try {
      file = await pickBackupFile()
    } catch (_err) {
      this.showAlert(I18n.t('v2.home.cantReadFile'), '', { type: true })
      return
    }
    if (!file) {
      this.setModalOpen(false)
      return
    }
    this.setModalOpen(true)
    this.onDrawerClosed = this.handleModalClosed
    // Defer to next tick so iOS finishes dismissing the file picker before
    // we present the drawer — opening immediately can swallow the presentation.
    setTimeout(() => {
      // The native file picker resigns/re-lays out Welcome, overwriting the layout
      // refs that restoreLayoutRefs() set earlier. Re-assert them right before
      // opening so the drawer anchors correctly instead of filling the screen.
      this.restoreLayoutRefs()
      this.openDrawer({
        children: (
          <RestoreFromFileModal
            initialFileName={file.name}
            initialFileContent={file.content}
            onSuccess={this.handleAccountCreated}
          />
        ),
        onClose: this.handleDrawerClosed
      })
    }, 350)
  }

  openImportAccountModal = () => {
    this.setModalOpen(true)
    this.onDrawerClosed = this.handleModalClosed
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

  openCreateAccountModal = () => {
    this.setModalOpen(true)
    this.onDrawerClosed = this.handleModalClosed
    this.openDrawer({
      heightDrawer: this.heightPopupDefault,
      children: (
        <CreateAccountModal
          onGenerateAuto={this.generateNewAccount}
          onPickManual={this.handlePickManual}
          onSuccess={this.handleAccountCreated}
        />
      ),
      onClose: this.handleDrawerClosed
    })
  }

  generateNewAccount = async (accountName) => {
    try {
      const evmAccount = await createNewWalletDataV2(accountName)
      this.addActiveEvmChainId(1)
      return evmAccount
    } catch (error) {
      this.showAlert(I18n.t('Error.errPrivateKey'), '', { type: true })
      return null
    }
  }

  handlePickManual = () => {
    // Swap the chooser for the key-in modal IN PLACE — openDrawer (addDrawer:false)
    // replaces drawer-0's config so the same BottomSheet stays mounted and only
    // its children change (no hide-then-reopen). No closeDrawer/setTimeout: there's
    // no pending close to wipe the re-open. Mirrors handleBackToCreateAccount.
    this.openEnterPrivateKeyModal()
  }

  openEnterPrivateKeyModal = () => {
    this.setModalOpen(true)
    this.onDrawerClosed = this.handleModalClosed
    this.openDrawer({
      children: (
        <EnterPrivateKeyModal
          onSubmit={this.generateAccountFromPrivateKey}
          onSuccess={this.handleAccountCreated}
          onBack={this.handleBackToCreateAccount}
        />
      ),
      onClose: this.handleDrawerClosed
    })
  }

  // Header back button on the enter-private-key modal: return to the chooser.
  // Re-open WITHOUT closing first — openDrawer (addDrawer:false) replaces the
  // single drawer-0 config, so the same BottomSheet stays mounted and only its
  // children swap in place (no slide-down-then-up). Going through closeDrawer +
  // setTimeout (like the forward step) is what made back feel janky; here there's
  // no pending close to wipe the re-open, so the delay isn't needed.
  handleBackToCreateAccount = () => {
    this.openCreateAccountModal()
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

  addActiveEvmChainId = (chainId) => {
    const { setActiveEvmChainIds, activeEvmChainIdsRedux } = this.props
    const current = activeEvmChainIdsRedux || []
    if (current.includes(chainId)) return
    setActiveEvmChainIds([...current, chainId])
  }

  // ── Success-screen actions for the import / private-key flows ──
  // Copy the new account address and show the standard "copied" toast.
  handleCopyAddress = (address) => {
    if (!address) return
    Clipboard.setString(address)
    this.showAlert(I18n.t('Initial.copyDone', { value: I18n.t('Initial.address') }), '', { type: 'toast' })
  }

  // Open the shared EditLabel drawer stacked on top of the success screen.
  // `onUpdated` lets the underlying modal reflect the new name in its own state
  // (the new account isn't the activeAccount, so EditLabel runs in props mode).
  // From welcome, closing EditLabel (pan-down OR after Save) goes straight to
  // home — onClose drives that for the pan-down case.
  handleEditAccountName = (account, currentName, onUpdated) => {
    this.goingHome = false
    this.openDrawer({
      addDrawer: true,
      children: (
        <EditLabel
          account={account}
          initialName={currentName}
          onSave={(name) => this.handleSaveAccountName(account, name, onUpdated)}
        />
      ),
      onClose: this.goHomeAfterEdit
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
    this.goHomeAfterEdit()
  }

  // Close both the EditLabel and the underlying success drawer and land on home.
  // Guarded + clears onDrawerClosed so the success drawer's own onClose doesn't
  // double-navigate, and closeAllDrawer re-firing this onClose is a no-op.
  goHomeAfterEdit = () => {
    if (this.goingHome) return
    this.goingHome = true
    this.onDrawerClosed = null
    this.closeAllDrawer()
    this.setModalOpen(false)
    NavigationActions.navigate(NAME_SCREEN.home)
  }

  handleAccountCreated = () => {
    this.onDrawerClosed = () => {
      this.setModalOpen(false)
      NavigationActions.navigate(NAME_SCREEN.home)
    }
  }

  render () {
    const Template = this.view
    return (
      <Template
        noFooter
        noHeader
        func={this}
        state={this.state}
        props={this.props}
      />
    )
  }
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  activeEvmChainIdsRedux: state.activeEvmChainIdsRedux
})

const mapDispatchToProps = (dispatch) => ({
  setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch),
  setActiveEvmChainIds: bindActionCreators(StorageReduxAction.setActiveEvmChainIds, dispatch)
})

export default connect(mapStateToProps, mapDispatchToProps)(WelcomeScreen)
