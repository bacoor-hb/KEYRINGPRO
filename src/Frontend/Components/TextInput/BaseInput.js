import React, { PureComponent, createRef } from 'react'
import { Text, View, TouchableOpacity } from 'react-native'
import styles from './styles'

export default class BaseInput extends PureComponent {
  constructor (props) {
    super(props)
    this.state = {
      isFocus: false
    }
    this.inputRef = createRef()
  }

  get renderRight () {
    const { rightIcon, rightAction, activeOpacityRight = 0.5, rightText, rightTextStyle } = this.props

    return (
      <View>
        {
          rightIcon ? (
            <TouchableOpacity
              activeOpacity={activeOpacityRight}
              disabled={!rightAction}
              onPress={this.rightAction}>
              {rightIcon}
            </TouchableOpacity>
          ) : null
        }

        {
          rightText ? (
            <Text style={[styles.smallText, styles.opacityPlaceHolder, rightTextStyle]}>{rightText}</Text>
          ) : null
        }
      </View>
    )
  }

  get renderLeft () {
    const { leftIcon } = this.props
    return (
      <View>
        {leftIcon}
      </View>
    )
  }

  rightAction = () => {
    const { rightAction, searchData, handleResults } = this.props
    rightAction && rightAction()
    searchData && handleResults && handleResults(null)
  }

  onBlurFocus = (isFocus) => () => {
    const { onBlur, onFocusAction } = this.props
    if (onBlur && !isFocus) {
      onBlur && onBlur()
    }
    onFocusAction && onFocusAction(isFocus)

    if (isFocus) {
      !ISIOS && this.inputRef?.current?.setNativeProps({ selection: null })
    }
    this.setState({ isFocus })
  }

  focus = () => {
    this.inputRef?.focus && this.inputRef?.focus()
  }

  blur = () => {
    this.inputRef?.blur && this.inputRef?.blur()
  }
}
