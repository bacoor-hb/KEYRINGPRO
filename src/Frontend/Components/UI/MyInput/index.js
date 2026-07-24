import React, { useState, useContext } from 'react'
import { View, TextInput, TouchableOpacity } from 'react-native'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { MODE_THEME } from 'common/constants/app'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import createStyles from './styles'
import { Colors, getSizeImgSquare, pixelByHeight } from 'common/styles'
import * as Animatable from 'react-native-animatable'
import { cn, mergeStyle } from 'common/tailwind'

/**
 * @param {'default'|'outline'|'primary'|'base'} [variant] - Visual style variant
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
 * @param {ConfigProps} [inputWrapperConfig] - Input wrapper config
 * @param {ConfigProps} [errorConfig] - Error text config
 * @param {number} [errorSpaceHeight] - Min reserved height for in-flow error
 * @param {(value: string) => void} [onChangeText] - Text change handler
 * @param {boolean} [isDisable] - Disable the input
 * @param {string} [hinText] - Hint text shown when no error
 * @param {boolean} [leftIconInside] - Render left icon inside the input wrapper
 * @param {boolean} [rightIconOutside] - Render right icon outside the input wrapper
 * @param {boolean} [noErrorSpace] - Hide inline error and reserved space
 * @param {boolean} [errorInFlow] - Render error in normal flow below input
 */
const MyInput = ({
  variant = 'default',
  size = 'default',
  leftIcon,
  rightIcon,
  noBorder = false,
  isError = false,
  errMessage,
  containerConfig = {},
  inputConfig = {},
  inputWrapperConfig = {},
  errorConfig = {},
  leftIconConfig = {},
  secureTextEntry,
  typeInput = 'default',
  onChangeText,
  isDisable,
  rightIconConfig = {
    variant: 'small'
  },
  hinText,
  // Opt-in layout tweaks (default = legacy behavior, so existing usages are
  // unaffected):
  //  - leftIconInside: render the left icon INSIDE the bordered input wrapper so
  //    the underline runs under it (e.g. an address-book avatar).
  //  - rightIconOutside: render the right icon OUTSIDE the wrapper so the
  //    underline stops before it (e.g. a scan button next to an address field).
  leftIconInside = false,
  rightIconOutside = false,
  // When true, render no inline error and no reserved space below the field
  // (caller shows errors elsewhere). Default false keeps the reserved space.
  noErrorSpace = false,
  // When true, render the error/hint in normal flow below the input (wraps and
  // grows DOWNWARD) instead of the legacy absolute overlay. Default false keeps
  // the legacy behavior so existing usages (and their errorConfig offsets) are
  // unaffected.
  errorInFlow = false,
  // Minimum reserved height for the in-flow error area (only used with errorInFlow).
  // Showing/hiding a message that fits within this height never shifts the content
  // below (the space is always reserved). A longer message grows the area downward
  // to stay fully visible instead of being truncated. Defaults to 49px (~2 lines);
  // pass a value to override, or null to reserve exactly the message's own height.
  errorSpaceHeight = pixelByHeight(49),
  ...props
}) => {
  const { modeTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode, variant, size)
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

  const getStyleInputWrapperDefault = () => {
    switch (variant) {
      case 'default':
        return styles.inputWrapperDefault
      case 'outline':
        return styles.inputWrapperOutline
      case 'primary':
        return styles.inputWrapperPrimary
    }
  }

  const getStyleContentContainerDefault = () => {
    switch (variant) {
      case 'primary':
        return styles.contentContainerPrimary

      default:
        return {}
    }
  }

  const renderLeftIcon = () => {
    if (!leftIcon) return null
    return (typeof leftIcon === 'string' || typeof leftIcon === 'number')
      ? (
        <View style={[mergeStyle(leftIconConfig?.iconWrapperStyle)]}>
          <MyIcon {...leftIconConfig} uri={leftIcon} variant={leftIconConfig?.variant || 'medium'} />
        </View>
      ) : leftIcon
  }

  const renderRightIcon = () => {
    if (rightIcon) {
      return (typeof rightIcon === 'string' || typeof rightIcon === 'number')
        ? (
          <TouchableOpacity onPress={togglePasswordVisibility} activeOpacity={1}>
            <MyIcon {...rightIconConfig} uri={rightIcon || (isPasswordVisible ? images.UIV2.icons.eyeShow : images.UIV2.icons.eyeHide)} variant={rightIconConfig?.variant || 'medium'} />
          </TouchableOpacity>
        )
        : rightIcon
    }
    if (isPassword) {
      return (
        <TouchableOpacity onPress={togglePasswordVisibility} activeOpacity={1}>
          <MyIcon {...rightIconConfig} uri={isPasswordVisible ? images.UIV2.icons.eyeShow : images.UIV2.icons.eyeHide} variant={rightIconConfig?.variant || 'small'} />
        </TouchableOpacity>
      )
    }
    return null
  }

  const leftIconNode = renderLeftIcon()
  const rightIconNode = renderRightIcon()

  if (variant === 'base') {
    <View style={styles.contentContainer}>
      {leftIconNode && !leftIconInside ? leftIconNode : null}
      <TextInput
        autoCapitalize='none'
        {...props}
        value={props?.value}
        editable={!isDisable}
        multiline={isArea}
        onChangeText={onChangeValue}
        secureTextEntry={isActuallySecure}
        style={[styles.textInput, mergeStyle(inputConfig.style)]}
        className={cn(props?.className, inputConfig.className)}
        placeholderTextColor={props?.placeholderTextColor || (isDarkMode ? Colors.TEXT_LOW : 'rgba(0,0,0,0.4)')}

      />
      {rightIconNode && !rightIconOutside ? rightIconNode : null}
    </View>
  }

  return (
    <View
      style={[styles.container, mergeStyle(containerConfig?.style)]}
      className={containerConfig.className}
    >
      <View
        style={[
          styles.contentContainer,
          getStyleContentContainerDefault()
        ]}>

        {leftIconNode && !leftIconInside ? leftIconNode : null}

        <View
          style={[
            styles.inputWrapper,
            getStyleInputWrapperDefault(),
            noBorder && { borderBottomWidth: 0 },
            isDisable && { opacity: 0.5 },
            mergeStyle(inputWrapperConfig?.style)
          ]}>

          {leftIconNode && leftIconInside ? (
            <View style={styles.leftIconInside}>{leftIconNode}</View>
          ) : null}

          <TextInput
            autoCapitalize='none'
            {...props}
            value={props?.value}
            editable={!isDisable}
            multiline={isArea}
            onChangeText={onChangeValue}
            secureTextEntry={isActuallySecure}
            style={[styles.textInput, mergeStyle(inputConfig.style)]}
            className={cn(props?.className, inputConfig.className)}
            placeholderTextColor={props?.placeholderTextColor || (isDarkMode ? Colors.TEXT_LOW : 'rgba(0,0,0,0.4)')}

          />
          <View style={styles.rightElement}>
            {!rightIconOutside ? rightIconNode : null}
          </View>
          {/* Legacy absolute error overlay (default). errorConfig offsets keep
              working for existing usages. */}
          {
            !noErrorSpace && !errorInFlow && ((isError && errMessage) || hinText) && (
              <View
                style={[
                  {
                    bottom: variant === 'primary' ? -pixelByHeight(36) : -pixelByHeight(28)
                  },
                  mergeStyle(errorConfig?.style)
                ]}
                className='absolute  left-0'>
                <Animatable.Text
                  animation='fadeIn'
                >
                  <MyText
                    style={[styles.errorText, hinText && styles.hintText, mergeStyle(errorConfig?.style)]}
                    className={errorConfig.className}>
                    {errMessage || hinText}
                  </MyText>
                </Animatable.Text>
              </View>
            )
          }

        </View>

        {rightIconOutside ? rightIconNode : null}

      </View>

      {/* Legacy reserved space below the input (keeps layout from shifting). */}
      {!noErrorSpace && !errorInFlow && (
        <View
          style={[
            styles.contentContainer
          ]}>

          <View style={{ width: getSizeImgSquare('large') }} />
          <MyText
            variant='small'
            style={[styles.errorText, mergeStyle(errorConfig?.style), { opacity: 0 }]}
          >
            {/* {errMessage} */}
          </MyText>
        </View>
      )}

      {/* Opt-in: error/hint in normal flow below the input. errorSpaceHeight is a
          MINIMUM reserved height (not a hard cap): the message text is always
          rendered (hidden when inactive), so a 1- or 2-line message stays within the
          reserved space and never shifts the content below. If a longer message (e.g.
          a translation, or a narrow screen) wraps past that height, the area grows
          downward to show the full text instead of truncating it — the only shift is
          while an over-long error is actually showing. */}
      {!noErrorSpace && errorInFlow && (
        // Column bounded by the container's default alignItems:'stretch' (the same
        // thing that makes the input box full-width), so the message wraps within
        // that width instead of overflowing horizontally.
        <Animatable.View
          animation='fadeIn'
          style={[
            { alignSelf: 'stretch' },
            errorSpaceHeight != null && { minHeight: errorSpaceHeight, justifyContent: 'flex-start' }
          ]}>
          <MyText
            variant='small'
            style={[
              styles.errorText,
              hinText && styles.hintText,
              mergeStyle(errorConfig?.style),
              !((isError && errMessage) || hinText) && { opacity: 0 }
            ]}
            className={errorConfig.className}
          >
            {errMessage || hinText || ' '}
          </MyText>
        </Animatable.View>
      )}

    </View>
  )
}

export default MyInput
