import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import Page from './page'
import RestoreFromFileModal, { pickBackupFile } from 'frontend/Components/RestoreFromFileModal'
import I18n from 'assets/Lang'

class HomeScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {}
  }

  openRestoreFromFileModal = async () => {
    // Pick file BEFORE opening the drawer — keeps the native picker flow
    // isolated from the drawer presentation.
    let file
    try {
      file = await pickBackupFile()
    } catch (_err) {
      this.showAlert(I18n.t('v2.home.cantReadFile'), '', { type: true })
      return
    }
    if (!file) return
    this.openDrawer({
      children: (
        <RestoreFromFileModal
          initialFileName={file.name}
          initialFileContent={file.content}
        />
      )
    })
  }

  render () {
    const Template = this.view
    return (
      <Template
        noHeader
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
      />
    )
  }
}

export default HomeScreen
