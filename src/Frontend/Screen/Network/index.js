import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import Page from './page'
import RightHeader from './Component/RightHeader'
import OtherNetwork from './Component/OtherNetwork'

class NetworkScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page

    this.state = { }
  }

  handleOtherNetwork = () => {
    this.openDrawer({
      children: <OtherNetwork openMore={this.handleOtherNetwork} _this={this} />
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
        rightView={<RightHeader handleOtherNetwork={this.handleOtherNetwork} />}
      />
    )
  }
}

export default NetworkScreen
