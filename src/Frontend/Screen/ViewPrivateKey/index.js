import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import Page from './page'
import MyButton from 'frontend/Components/UI/MyButton'
import QRPrivateKey from './Component/QRPrivateKey'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { connect } from 'react-redux'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n from 'assets/Lang'
import { getPrivateKeyByAddress } from 'common/wallet'
import { requestReauth } from 'common/secureVault'

class ViewPrivateKeyScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {}
  }

  getInfoAccount = () => {
    const { accountListRedux, route } = this.props
    const indexAccount = route?.params?.indexAccount
    return accountListRedux[indexAccount] || {}
  }

  handleShowPK = async () => {
    const address = this.getInfoAccount().address
    if (!address) return
    // Re-auth gate: when a vault password is set, force password / biometric
    // verification before revealing the PK — defense against shoulder surfing
    // on an already-unlocked app. Resolves true immediately if no password.
    const ok = await requestReauth()
    if (!ok) return
    const privateKey = getPrivateKeyByAddress(address)
    if (!privateKey) return
    this.openDrawer({
      children: (
        <QRPrivateKey privateKey={privateKey} onCopy={this.handleCopyPK} />
      )
    })
  }

  handleCopyPK = (privateKey) => {
    if (!privateKey) return
    Clipboard.setString(privateKey)
    this.showAlert(I18n.t('Initial.copyDone', { value: 'Private key' }), '', { type: 'toast' })
  }

  render () {
    const Template = this.view
    const infoAccount = this.getInfoAccount()
    return (
      <Template
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader infoAccount={infoAccount} />}
        rightView={(
          <MyButton
            isUseHeader
            onPress={this.handleShowPK}
            size='small'
            variant='dangerous'
            style={{ minWidth: 100 }}
            label={I18n.t('v2.common.view')}
          />
        )}
      />
    )
  }
}
const mapDispatchToProps = (dispatch) => {
  return {}
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux
})

export default connect(mapStateToProps, mapDispatchToProps)(ViewPrivateKeyScreen)
