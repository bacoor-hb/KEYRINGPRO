import React from 'react'
import { View, TextInput, Text, TouchableOpacity } from 'react-native'
import styles from './styles'
import * as Animatable from 'react-native-animatable'
import BaseInput from 'frontend/Components/TextInput/BaseInput'
import { width } from 'common/styles'
import { Icon } from '../Common/Icon'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import I18n from 'assets/Lang'

const PlaceHolderSearch = (props) => {
  const { placeHolder = I18n.t('Initial.searchEvery'), placeHolderStyle, placeHolderTextStyle, value } = props

  return (
    value ? null : (
      <View style={[styles.placeHolderStyleSearch, value && styles.hideView, placeHolderStyle]}>
        <Text style={[styles.opacityPlaceHolder, placeHolderTextStyle]}>{placeHolder}</Text>
      </View>
    )
  )
}

const RightAction = (props) => {
  const { rightIcon, rightAction, activeOpacityRight = 0.5, rightText, rightTextStyle, resetInput } = props

  const handleRightAction = () => {
    resetInput && resetInput()
    rightAction && rightAction()
  }
  return (
    <View>
      {
        rightIcon ? (
          <TouchableOpacity
            activeOpacity={activeOpacityRight}
            disabled={!rightAction}
            onPress={handleRightAction}>
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

class InputSearch extends BaseInput {
  constructor (props) {
    super(props)

    this.state = {
      countString: 0,
      inputValue: props.value || ''
    }
  }

  componentDidUpdate (prevProps) {
    // Sync state with props value
    if (this.props.value !== prevProps.value && this.props.value !== this.state.inputValue) {
      this.setState({ inputValue: this.props.value || '' })
    }
  }

  onChangeText = (input) => {
    const { multiline, priceMax } = this.props
    if (priceMax && Number(input) < priceMax) {
      this.setState({ inputValue: input })
      this.props.onChangeText(input)
    } else {
      const inputValue = input.substring(0, multiline ? 5000 : 255)
      this.setState({ inputValue })
      this.props.onChangeText(inputValue)
    }
  }

  render () {
    const { inputStyle, style, isDisable, viewStyle, isAutoFocus, onFocus, onBlur, rightIcon } = this.props
    const { inputValue } = this.state
    return (
      <ThemeContext.Consumer>{(context) => {
        return (
          <View style={[styles.containerError, viewStyle]}>
            <Animatable.View
              style={[styles[`rowSearchInput${context.modeTheme}`], style, isDisable && styles.borderDisable]}>
              <PlaceHolderSearch {...this.props} value={inputValue} />
              <Icon style={styles[`paddingSearch${context.modeTheme}`]} name='search' size={width(6)} />
              <TextInput
                {...this.props}
                ref={this.inputRef}
                value={inputValue}
                style={[styles[`textInputSearch${context.modeTheme}`], inputStyle]}
                onBlur={() => onBlur ? onBlur() : this.onBlurFocus(false)}
                onFocus={() => onFocus ? onFocus() : this.onBlurFocus(true)}
                editable={!isDisable}
                selectTextOnFocus={this.props?.selectTextOnFocus || false}
                onChangeText={this.onChangeText}
                underlineColorAndroid='transparent'
                autoFocus={isAutoFocus ?? false}
              />
              {rightIcon ? <RightAction {...this.props} resetInput={() => this.setState({ inputValue: '' })} /> : null}
            </Animatable.View>
          </View>
        )
      }}
      </ThemeContext.Consumer>
    )
  }
}
export default InputSearch
