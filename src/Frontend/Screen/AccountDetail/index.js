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
import { getPrivateKeyByAddress, isAccountFromKeyCard } from 'common/wallet'
import { requestReauth } from 'common/secureVault'
import DeleteAccount from './Component/DeleteAccount'
import I18n from 'assets/Lang'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { REDUX_KEY } from 'common/constants/redux'
import { removeAiMessages } from 'common/aiSearchHistory'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { Share } from 'react-native'

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
      case 'view_private_key':
        this.handleViewPrivateKey()
        return
      case 'share-link':
        Share.share({
          url: `https://account.keyring.app/address/${account.address}`
        })
        return
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

  handleDeleteAccount = async (callback = () => {}) => {
    let privateKey = ''
    let isErrorGetPrivateKey = false

    const { activeAccount, accountListRedux } = this.props
    const { account } = activeAccount
    const address = account.address
    const isFormKeyCard = isAccountFromKeyCard(address)

    const ok = await requestReauth()

    if (!ok) {
      callback?.(false)
      return
    }

    if (account?.accountType !== ACCOUNT_TYPE.VIEW_ONLY) {
      if (isFormKeyCard) {
        privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address, null, {
          callbackReject: () => {
            isErrorGetPrivateKey = true
          }
        })
      } else {
        privateKey = getPrivateKeyByAddress(address)
      }

      if (isErrorGetPrivateKey || !privateKey) {
        callback?.(false)
        return
      }
    }

    const accountListReduxNew = accountListRedux.filter((_, index) => index !== account.indexAccount)
    this.props.setAccountList(accountListReduxNew)
    // Drop this address's AI Search history too, so it doesn't linger (or
    // resurface if the same address is re-added later). removeAiMessages returns
    // the same map when the address has no history, so skip a redundant dispatch.
    const aiHistory = ReduxService.getReduxDataByKey('aiSearchHistoryRedux')
    const aiHistoryNext = removeAiMessages(aiHistory, account.address)
    if (aiHistoryNext !== aiHistory) {
      ReduxService.callDispatchAction(StorageReduxAction.setAiSearchHistory(aiHistoryNext))
    }
    deleteSuccess = true
    callback?.(true)
  }

  handleViewPrivateKey = async () => {
    let privateKey = ''
    let isErrorGetPrivateKey = false
    const activeAccount = this.props.activeAccount
    const { account } = activeAccount
    const address = account.address
    const isFormKeyCard = isAccountFromKeyCard(address)
    const ok = await requestReauth()
    if (!ok) return

    if (isFormKeyCard) {
      privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address, null, {
        callbackReject: () => {
          isErrorGetPrivateKey = true
        }
      })
    } else {
      privateKey = getPrivateKeyByAddress(address)
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
