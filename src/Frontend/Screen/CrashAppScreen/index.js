import React from 'react'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'
import I18n from 'assets/Lang'

class CrashAppScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
  }

  render () {
    const Template = this.view
    return (
      <Template
        noHeader
        noFooter
        title={I18n.t('Initial.crashTitle')}
        onRestart={this.onRestart}
      />
    )
  }
}
export default CrashAppScreen
