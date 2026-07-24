import React, { useState, useContext } from 'react'
import { View, TextInput, TouchableOpacity } from 'react-native'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { MODE_THEME } from 'common/constants/app'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import createStyles from './styles'
import { Colors, getSizeImgSquare } from 'common/styles'
import * as Animatable from 'react-native-animatable'
import { cn, mergeStyle } from 'common/tailwind'

/**
 * @param {'default'|'small'} [size] - Input size variant
 * @param {React.ReactNode} [leftIcon] - Left icon element
 * @param {MyIconProps} [leftIconConfig] - Config for left icon
 * @param {React.ReactNode} [rightIcon] - Right icon element
 * @param {MyIconProps} [rightIconConfig] - Config for right icon
 * @param {'default'|'search'|'number'|'password'|'numberic'|'area'} [typeInput] - Input type
 * @param {boolean} [noBorder] - Remove bottom border
 * @param {boolean} [isError] - Show error state
 * @param {string} [errMessage] - Error message text
 * @param {ConfigProps} [containerConfig] - Outer container config
 * @param {ConfigProps} [inputConfig] - TextInput config
 * @param {ConfigProps} [errorConfig] - Error text config
 * @param {(value: string) => void} [onChangeText] - Text change handler
 * @param {boolean} [isDisable] - Disable the input
 */
const MyInputSearch = ({
  size = 'default',
  leftIcon,
  rightIcon = images.iconSearchBlue,
  noBorder = false,
  isError = false,
  errMessage,
  containerConfig = {},
  inputConfig = {},
  errorConfig = {},
  leftIconConfig = {},
  secureTextEntry,
  typeInput = 'default',
  onChangeText,
  isDisable,
  rightIconConfig = {
    variant: 'small'
  },
  ...props
}) => {
  const { modeTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode, size)
  const isPassword = typeInput === 'password'
  const isArea = typeInput === 'area'
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible)
  }

  // If isPassword is true, we manage the visibility.
  // Otherwise, we respect secureTextEntry prop if passed.
  const isActuallySecure = isPassword ? !isPasswordVisible : secureTextEntry

  const onChangeValue = (value) => {
    let newValue = value
    const isNumber = typeInput === 'number' || typeInput === 'numberic'
    if (isNumber) {
      newValue = value.replace(/,/g, '.') // Replace all commas with dots

      // Find the position of the first dot
      const firstDotIndex = newValue.indexOf('.')

      if (firstDotIndex !== -1) {
        // If there is a dot, keep only the first dot and remove all subsequent dots
        newValue = newValue.substring(0, firstDotIndex + 1) + newValue.substring(firstDotIndex + 1).replace(/\./g, '')
      }

      if (newValue?.startsWith('.') === true) {
        newValue = ''
      }
    }
    onChangeText?.(newValue)
  }

  return (
    <View style={{ paddingVertical: 8 }}>
      <View
        style={[styles.container, mergeStyle(containerConfig?.style)]}
        className={cn('flex w-full justify-center items-center border border-box-small', containerConfig.className)}
      >
        <View
          style={[
            styles.contentContainer
          ]}>
          {leftIcon && (
            (typeof leftIcon === 'string' || typeof leftIcon === 'number') ? (
              <MyIcon {...leftIconConfig} uri={leftIcon} variant={leftIconConfig?.variant || 'medium'} />
            ) : (
              leftIcon
            )
          )}
          <View
            style={[
              styles.inputWrapper,
              noBorder && { borderBottomWidth: 0 },
              isDisable && { opacity: 0.5 }
            ]}>

            <TextInput
              autoCapitalize='none'
              {...props}
              value={props?.value}
              editable={!isDisable}
              multiline={isArea}
              onChangeText={onChangeValue}
              secureTextEntry={isActuallySecure}
              style={[styles.textInput, inputConfig.style]}
              className={inputConfig.className}
              placeholderTextColor={Colors.TEXT_LOW}

            />
            <View style={styles.rightElement}>
              {/* {isPassword && (
              <TouchableOpacity onPress={togglePasswordVisibility} activeOpacity={0.7}>
                <MyIcon
                  uri={isPasswordVisible ? images.UIV2.icons.eyeShow : images.UIV2.icons.eyeHide}
                  variant="small"
                />
              </TouchableOpacity>
            )} */}
              {rightIcon && (
                (typeof rightIcon === 'string' || typeof rightIcon === 'number') ? (
                  <TouchableOpacity onPress={togglePasswordVisibility} activeOpacity={1}>
                    <MyIcon {...rightIconConfig} uri={rightIcon || (isPasswordVisible ? images.UIV2.icons.eyeShow : images.UIV2.icons.eyeHide)} variant={rightIconConfig?.variant || 'medium'} />

                  </TouchableOpacity>
                ) : (
                  rightIcon
                )
              )}

              {!rightIcon && isPassword && (
                <TouchableOpacity onPress={togglePasswordVisibility} activeOpacity={1}>
                  <MyIcon {...rightIconConfig} uri={isPasswordVisible ? images.UIV2.icons.eyeShow : images.UIV2.icons.eyeHide} variant={rightIconConfig?.variant || 'small'} />

                </TouchableOpacity>
              )}

            </View>
            {
              isError && errMessage && (
                <View className='absolute -bottom-6 left-0 '>
                  <View
                    style={[
                      styles.contentContainer
                    ]}>

                    <Animatable.Text
                      animation='fadeIn'
                    >
                      <MyText
                        style={[styles.errorText, mergeStyle(errorConfig?.style)]}
                        className={errorConfig.className}>
                        {errMessage}
                      </MyText>
                    </Animatable.Text>
                  </View>
                </View>
              )
            }

          </View>

        </View>
        {isError && errMessage && (
          <View
            style={[
              styles.contentContainer
            ]}>

            <View style={{ width: getSizeImgSquare('large') }} />
            <MyText
              style={[styles.errorText, mergeStyle(errorConfig?.style), { opacity: 0 }]}
              className='hidden'>
              {errMessage}
            </MyText>
          </View>
        )}

      </View>
    </View>
  )
}

export default MyInputSearch
