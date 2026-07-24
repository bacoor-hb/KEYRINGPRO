import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import { connect } from 'react-redux'
import Page from './page'
import { NAME_SCREEN } from 'common/constants/navigation'
import ChangeLanguage from './Component/ChangeLanguage'
import ChangeRegionalCurrency from './Component/ChangeRegionalCurrency'
import CustomRpc from './Component/CustomRpc'
import RestWallet from './Component/Reset'
import Information from './Component/Information'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { bindActionCreators } from 'redux'

class SettingScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {}
  }

  handleChooseLanguage = async (locale) => {
    const { setLanguage } = this.props
    setLanguage(locale)
  }

  handleMenu= (key) => {
    let popup = null

    switch (key) {
      case NAME_SCREEN.changeLanguage:
        popup = <ChangeLanguage _this={this} />
        break
      case NAME_SCREEN.regionalCurrency:
        popup = <ChangeRegionalCurrency _this={this} />
        break

      case NAME_SCREEN.customRPC:
        popup = <CustomRpc _this={this} />
        break

      case NAME_SCREEN.resetWallet:
        popup = <RestWallet />
        break
      case NAME_SCREEN.information:
        popup = <Information />
        break
    }
    this.openDrawer({
      children: popup,
      scrollView: false
    })
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
const mapDispatchToProps = (dispatch) => {
  return {
    setLanguage: bindActionCreators(StorageReduxAction.setLanguage, dispatch)
  }
}
const mapStateToProps = (state) => ({
  localeRedux: state.localeRedux,
  currencyRedux: state.currencyRedux
})

export default connect(mapStateToProps, mapDispatchToProps)(SettingScreen)
