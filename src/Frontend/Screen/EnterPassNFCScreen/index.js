import React from 'react'
import I18n from 'assets/Lang'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'
import { decryptBackupFileContent, decryptPrivateKeyFromKeyringHardwalletWeb } from 'common/function'
import { connect } from 'react-redux'
import ModalRestoreFinish from './components/ModalRestoreFinish'
import ModalWrongPassword from './components/ModalWrongPassword'
import { bindActionCreators } from 'redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { NavigationActions } from 'src/navigation/NavigationService'

class EnterPassNFCScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      fileEncryptContent: '',
      fileName: '',
      isRestoring: false,
      enterPin: ''
    }

    this.pincodeSize = props.route.params.isNfcFromKHW ? 6 : 4
  }

  onShowModalFinish = () => {
    this.popup = (
      <ModalRestoreFinish
        isRestoring={this.state.isRestoring}
        closeModal={this.closeModal} />
    )
    this.swipeToClose = false
    this.openModal()
  }

  onShowModalWrongPass = () => {
    const onResetPass = () => {
      this.setState({ enterPin: '' })
    }
    this.popup = (
      <ModalWrongPassword
        onResetPass={onResetPass}
        isRestoring={this.state.isRestoring}
        closeModal={this.closeModal} />
    )
    this.swipeToClose = false
    this.openModal()
  }

  onChangeEnterPIN = (value) => () => {
    const newEnterPin = this.state.enterPin + value
    this.setState({ enterPin: newEnterPin }, () => {
      newEnterPin.length === this.pincodeSize && this.checkPass()
    })
  }

  checkPass = () => {
    const {
      isNfcFromKHW,
      privateKeyEncryptFromKHW,
      callBackFunction,
      passwordFile,
      passwordFileEncode
    } = this.props.route.params || {}

    const { enterPin } = this.state

    let isCorrectPass = false
    let privateKeyForCallBack

    if (isNfcFromKHW) {
      const privateKeyDecryptFromKHW = decryptPrivateKeyFromKeyringHardwalletWeb(privateKeyEncryptFromKHW, enterPin)
      isCorrectPass = !!privateKeyDecryptFromKHW
      privateKeyForCallBack = privateKeyDecryptFromKHW
    } else {
      const decodeHash = decryptBackupFileContent(passwordFileEncode, enterPin)
      isCorrectPass = decodeHash === passwordFile
    }

    if (isCorrectPass) {
      callBackFunction(privateKeyForCallBack)
    } else {
      this.onShowModalWrongPass()
    }
  }

  showError = () => {
    this.showAlert(I18n.t('v2.file.cantRestoreBackup'), '', { type: true })
    this.setState({
      enterPin: ''
    })
  }

  onDeleteNumber = () => () => {
    const newEnterPin = this.state.enterPin.slice(0, -1)
    this.setState({ enterPin: newEnterPin })
  }

  onOpenOptionPopup = (popup, popsitionPopup = 'bottom') => () => {
    this.popsitionPopup = popsitionPopup
    this.popup = popup

    this.openModal()
  }

  onChangeText = (text) => {
    this.setState({ password: text })
  }

  onBackRoute = () => {
    NavigationActions.goBack()
  }

  render () {
    const Template = this.view
    return (
      <Template
        noFooter
        func={this}
        props={this.props}
        state={this.state}
      />
    )
  }
}

const mapDispatchToProps = (dispatch) => ({
  setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch)
})

const mapStateToProps = (state) => ({})

export default connect(mapStateToProps, mapDispatchToProps)(EnterPassNFCScreen)
