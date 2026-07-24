import React from 'react'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'

class HomeScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = { }
  }

  render () {
    const Template = this.view
    return (
      <Template
        func={this}
        props={this.props}
        state={this.state}
      />
    )
  }
}
export default HomeScreen
