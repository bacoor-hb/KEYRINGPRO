import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import Page from './page'
import QRAddress from './Component/QRAddress'
import MyButton from 'frontend/Components/UI/MyButton'
import EditLabel from './Component/EditLabel'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { connect } from 'react-redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { bindActionCreators } from 'redux'
import ReduxService from 'common/redux'
import ViewPrivateKey from './Component/ViewPrivateKey'
import { getPrivateKeyByAddress, isAccountFromKeyCard, removePrivateKeyByAddress } from 'common/wallet'
import { toLegacyChainPrivateKey } from 'common/legacyChainKey'
import { requestReauth } from 'common/secureVault'
import DeleteAccount from './Component/DeleteAccount'
import I18n from 'assets/Lang'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { REDUX_KEY } from 'common/constants/redux'
import { removeAiMessages, resetSuggestions } from 'common/aiSearchHistory'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { Share } from 'react-native'
import { LOCALE } from 'common/constants/app'
import Config from 'react-native-config'
import { sanitizeUrl } from 'common/function'

let deleteSuccess = false
class AccountDetailScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {}
    deleteSuccess = false
  }

  handleShowOption=(type) => {
    const activeAccount = this.props.activeAccount
    const { account } = activeAccount
    let component = null

    switch (type) {
      case 'delete':
        component = <DeleteAccount _this={this} />
        break
      case 'edit_label':
        component = <EditLabel _this={this} />
        break
      case 'qr_address':
        component = <QRAddress _this={this} address={account.address} />
        break
      case 'view_private_key': {
        this.handleViewPrivateKey()
        return
      }
      case 'share-link': {
        const language = ReduxService.getReduxDataByKey('localeRedux')
        let url = `${Config.KEYRING_ACCOUNT_DOMAIN}/address/${account.address}`

        if (language === LOCALE.JP) {
          url += `?language=${language}`
        }
        url = sanitizeUrl(url)

        if (ISIOS) {
          Share.share({ url })
        } else {
          Share.share({ message: url })
        }

        return
      }
    }

    if (component) {
      this.openDrawer({
        children: component,
        onClose: () => {
          if (deleteSuccess) {
            NavigationActions.reset(NAME_SCREEN.home)
          }
        }
      })
    }
  }

  handleUpdateNameLabel = (name) => {
    const { setAccountList } = this.props

    const accountListRedux = ReduxService.getReduxDataByKey('accountListRedux')
    const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
    const { account, indexAccount } = activeAccount
    const accountListReduxNew = accountListRedux.slice()
    accountListReduxNew[indexAccount].name = name

    setAccountList(accountListReduxNew)
    ReduxService.setActiveAccount({ ...account, name })
    this.closeDrawer()
    this.showAlert(I18n.t('v2.accountDetail.changedLabel'), '')
  }

  handleDeleteAccount = async (onDone = () => {}) => {
    let privateKey = ''
    let isErrorGetPrivateKey = false

    const { activeAccount, accountListRedux } = this.props
    const { account } = activeAccount
    // Two DIFFERENT addresses, and mixing them up is what broke this before.
    // - scanAddress: what the CARD is expected to hold. A legacy BTC/Solana account
    //   was derived from the EVM account of the same card, so its `rootAddress` is
    //   the address written on that card — scanning for its own BTC address would
    //   never match.
    // - account.address: whose key is stored on THIS device. Reading the root here
    //   returned the EVM account's key instead: the wrong key to check, and one
    //   that is simply gone once that account has been deleted, which silently
    //   blocked deleting the BTC/Solana account afterwards.
    // Whether a card is needed at all is asked of the ENTRY (see isAccountFromKeyCard).
    const scanAddress = account?.rootAddress || account.address
    const isFormKeyCard = isAccountFromKeyCard(account)

    const ok = await requestReauth()

    if (!ok) {
      onDone?.(false)
      return
    }

    if (account?.accountType !== ACCOUNT_TYPE.VIEW_ONLY) {
      if (isFormKeyCard) {
        // passwordFile comes from the ENTRY, for the same reason the keycard check
        // does: left to itself getPrivateKeyFromNFC resolves it through
        // getKeyCardPassword(scanAddress), which looks the ROOT up in the account
        // list — gone once the EVM account is deleted. It then decrypts the card
        // with an empty password and reports "tag does not match", blaming the card
        // for a password we simply failed to look up. Every entry of a keycard
        // account carries its own copy.
        privateKey = await this.nfcProxy.getPrivateKeyFromNFC(scanAddress, account?.passwordFile || null, {
          callbackReject: () => {
            isErrorGetPrivateKey = true
          }
        })
      } else {
        privateKey = getPrivateKeyByAddress(account.address)
      }

      if (isErrorGetPrivateKey || !privateKey) {
        onDone?.(false)
        return
      }
    }

    const accountListReduxNew = accountListRedux.filter((_, index) => index !== account.indexAccount)
    this.props.setAccountList(accountListReduxNew)
    // Remove this account's stored private key together with the account, so no
    // key stays in secure storage without an account that owns it. ONLY this
    // account's own address: every account is managed on its own here, so a
    // related account (same card / same root) keeps its key.
    removePrivateKeyByAddress(account.address)
    // Drop this address's AI Search history too, so it doesn't linger (or
    // resurface if the same address is re-added later). removeAiMessages returns
    // the same map when the address has no history, so skip a redundant dispatch.
    const aiHistory = ReduxService.getReduxDataByKey('aiSearchHistoryRedux')
    const aiHistoryNext = removeAiMessages(aiHistory, account.address)
    if (aiHistoryNext !== aiHistory) {
      ReduxService.callDispatchAction(StorageReduxAction.setAiSearchHistory(aiHistoryNext))
    }
    // Unconditional, unlike the dispatch above: a thread can be dismissed without
    // ever having been written to the map (pills tapped, no message sent), so
    // "no history to remove" does not mean "nothing hidden" for this address.
    resetSuggestions(account.address)
    deleteSuccess = true
    onDone?.(true)
  }

  handleViewPrivateKey = async () => {
    let privateKey = ''
    let isErrorGetPrivateKey = false
    const activeAccount = this.props.activeAccount
    const { account } = activeAccount
    // Same split as handleDeleteAccount: the card is scanned for the ROOT address it
    // was written with, but the key HELD ON THIS DEVICE belongs to this account's own
    // address — reading the root here showed the EVM account's key when viewing a
    // legacy BTC/Solana account.
    const scanAddress = account?.rootAddress || account.address
    const isFormKeyCard = isAccountFromKeyCard(account)
    const ok = await requestReauth()
    if (!ok) return

    if (isFormKeyCard) {
      // Entry's own passwordFile — see handleDeleteAccount for why it can't be left
      // to the address lookup inside getPrivateKeyFromNFC.
      privateKey = await this.nfcProxy.getPrivateKeyFromNFC(scanAddress, account?.passwordFile || null, {
        callbackReject: () => {
          isErrorGetPrivateKey = true
        }
      })
      // A card carries ONE key — the EVM one — so a legacy BTC/Solana account of
      // that same card gets it back in EVM form and would show a string no
      // Bitcoin/Solana wallet accepts. Re-encode it into the format the old app
      // stored for that chain (identical key material, different envelope).
      // No-op for every other chain, EVM included.
      privateKey = toLegacyChainPrivateKey(privateKey, account?.chain)
    } else {
      // Hot account: storage already holds the key in this chain's own format
      // (the old app derived and saved it that way), so nothing to re-encode.
      privateKey = getPrivateKeyByAddress(account.address)
    }

    if (!isErrorGetPrivateKey && privateKey) {
      this.openDrawer({
        children: <ViewPrivateKey privateKey={privateKey} />
      })
    }
  }

  render () {
    const Template = this.view

    return (
      <Template
        headerBlur
        noFooter
        func={this}
        props={this.props}
        _this={this}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader showAlert={this.showAlert} />}
        rightView={(
          <MyButton
            isUseHeader
            onPress={() => this.handleShowOption('edit_label')}
            size='small'
            label={I18n.t('v2.accountDetail.editLabel')}
          />
        )}
      />
    )
  }
}
const mapDispatchToProps = (dispatch) => {
  return {
    setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch)
  }
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  activeAccount: state.activeAccount
})

export default connect(mapStateToProps, mapDispatchToProps)(AccountDetailScreen)
