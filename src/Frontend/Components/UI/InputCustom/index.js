import React, { useRef, useLayoutEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import { Colors, pixelByHeight } from 'common/styles'
import { mergeStyle } from 'common/tailwind'
import styles from './styles'

const InputCustom = ({
  variant = 'default',
  placeholder,
  useNativePlaceholder = false,
  placeholderConfig = {},
  leftIcon,
  rightIcon,
  leftIconConfig = {},
  rightIconConfig = {},
  height = 46,
  hinText,
  errMessage,
  isError = false,
  errorSpaceHeight = pixelByHeight(0),
  isDisable = false,
  containerConfig = {},
  inputConfig = {},
  errorConfig = {},
  typeInput = 'default',
  secureTextEntry,
  onChangeText,
  inputWrapperConfig,
  ...props
}) => {
  // Placeholder visibility is toggled IMPERATIVELY (setNativeProps), never through
  // React state/render. A controlled TextInput paints the typed character on the
  // native side in the SAME frame, but a render-driven overlay can only hide after
  // React commits and paints — one frame later — so the fresh character visibly
  // sits on top of the placeholder for a frame. Flipping opacity on the overlay's
  // native view inside onChangeText lands in that same frame, with no lag.
  //
  // The DECLARED opacity stays a constant (see styles.placeholderOverlay) on
  // purpose: if it were derived from `value`, a re-render carrying a stale
  // (lagging) controlled value would reconcile and clobber the imperative opacity,
  // reintroducing the flicker. Same technique as AutoFitAmountInput in this
  // feature — see .claude/skills/fabric-native-views.
  const placeholderRef = useRef(null)
  const lastTextRef = useRef(props.value ?? props.defaultValue ?? '')

  // Multiline text area. Stays vertically centered while it holds a single line
  // (like the other variants); the field is auto-height so it only grows once the
  // text wraps to more lines, instead of being pinned to the top.
  const isArea = typeInput === 'area'

  // Password mode: we own the visibility toggle and default a right-side eye icon.
  // For non-password fields we just honor the caller's secureTextEntry prop.
  const isPassword = typeInput === 'password'
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const togglePasswordVisibility = () => setIsPasswordVisible((v) => !v)
  const isActuallySecure = isPassword ? !isPasswordVisible : secureTextEntry

  const applyPlaceholderVisibility = (text) => {
    placeholderRef.current?.setNativeProps({ style: { opacity: text ? 0 : 1 } })
  }

  // Re-sync for non-typing changes (controlled value from parent, reset,
  // sanitization). useLayoutEffect runs before paint, so there is no flash; keyed
  // on `props.value` so it never fights the imperative typing update.
  useLayoutEffect(() => {
    applyPlaceholderVisibility(props.value !== undefined ? props.value : lastTextRef.current)
  }, [props.value])

  const handleChangeText = (text) => {
    let newValue = text
    const isNumber = props?.keyboardType === 'number' || props?.keyboardType === 'numberic'
    if (isNumber) {
      newValue = newValue.replace(/,/g, '.')

      const firstDotIndex = newValue.indexOf('.')

      if (firstDotIndex !== -1) {
        newValue = newValue.substring(0, firstDotIndex + 1) + newValue.substring(firstDotIndex + 1).replace(/\./g, '')
      }

      if (newValue?.startsWith('.') === true) {
        newValue = ''
      }
    }

    lastTextRef.current = newValue
    applyPlaceholderVisibility(newValue)
    onChangeText?.(newValue)
  }

  // Message area is only reserved when the field actually uses hint/err. If a
  // caller passes neither prop, nothing is rendered below the input.
  const showError = isError && !!errMessage
  const messageText = showError ? errMessage : (hinText ?? '')

  const { style: placeholderStyle, ...placeholderRest } = placeholderConfig

  // A string/number icon renders through <MyIcon/>; any other node is used as-is.
  // The left icon default sits in a fixed square box (large) with the icon centered.
  const renderLeftIcon = () => {
    if (leftIcon == null) return null
    if (typeof leftIcon === 'string' || typeof leftIcon === 'number') {
      return (
        <View style={styles.leftIconBox}>
          <MyIcon {...leftIconConfig} uri={leftIcon} />
        </View>
      )
    }
    return leftIcon
  }

  const renderRightIcon = () => {
    // Password fields default to an eye toggle when no custom right icon is given.
    if (rightIcon == null) {
      if (!isPassword) return null
      return (
        <TouchableOpacity
          style={styles.rightElement}
          onPress={togglePasswordVisibility}
          activeOpacity={1}>
          <MyIcon
            variant='small'
            {...rightIconConfig}
            uri={isPasswordVisible ? images.UIV2.icons.eyeShow : images.UIV2.icons.eyeHide}
          />
        </TouchableOpacity>
      )
    }
    const node = (typeof rightIcon === 'string' || typeof rightIcon === 'number')
      ? <MyIcon variant='medium' {...rightIconConfig} uri={rightIcon} />
      : rightIcon
    return <View style={styles.rightElement}>{node}</View>
  }

  return (
    <View
      style={[styles.container, mergeStyle(containerConfig?.style)]}
      className={containerConfig?.className}>

      <View
        style={[
          styles.inputWrapper,
          { minHeight: pixelByHeight(height) },
          isDisable && { opacity: 0.5 }
        ]}>

        {renderLeftIcon()}

        {/* Border-bottom lives on this inner row so it only spans the input column
            + right icon — the left icon sits outside it and is not underlined. */}
        <View
          style={[
            styles.inputBorderedRow,
            variant === 'default' && styles.inputWrapperDefault,
            mergeStyle(inputWrapperConfig?.style)
          ]}>

          <View style={styles.field}>
            <TextInput
              autoCapitalize='none'
              {...props}
              multiline={isArea}
              editable={!isDisable}
              onChangeText={handleChangeText}
              secureTextEntry={isActuallySecure}
              // Native placeholder: used only when `useNativePlaceholder` is set (it
              // aligns perfectly with the typed value). Otherwise kept empty and we
              // render our own styled overlay below.
              placeholder={useNativePlaceholder ? (placeholder ?? '') : ''}
              placeholderTextColor={props?.placeholderTextColor || Colors.TEXT_LOW}
              style={[styles.textInput, isArea && styles.textInputArea, mergeStyle(inputConfig?.style)]}
              className={inputConfig?.className}
            />

            {/* Overlay placeholder (default). Skipped when useNativePlaceholder is on.
                Always mounted (when a placeholder is set) so its native view stays
                around for setNativeProps; visibility is driven imperatively, not by
                conditional mounting. Plain View + collapsable=false so Fabric keeps
                it as a real, addressable native node. */}
            {!!placeholder && !useNativePlaceholder && (
              <View
                ref={placeholderRef}
                collapsable={false}
                pointerEvents='none'
                style={styles.placeholderOverlay}>
                {/* Plain Text (not MyText): MyText forces a ×1.5 lineHeight, which
                    would make the placeholder's line-box taller than the TextInput's
                    natural one and push it off the value's baseline. styles.placeholderText
                    mirrors the input typography with no lineHeight override. */}
                <Text
                  numberOfLines={1}
                  {...placeholderRest}
                  style={[
                    styles.placeholderText,
                    props?.placeholderTextColor && { color: props.placeholderTextColor },
                    mergeStyle(placeholderStyle)
                  ]}>
                  {placeholder}
                </Text>
              </View>
            )}
          </View>

          {renderRightIcon()}
        </View>
      </View>

      {(isError || hinText) && (
        // Align the message with the input column (not the component's left edge):
        // an invisible clone of the left icon reserves its width, so the hint/error
        // starts under the input just like the placeholder does.
        <View style={styles.messageRow}>
          {leftIcon != null && (
            <View style={{ opacity: 0, height: 0 }} pointerEvents='none'>
              {renderLeftIcon()}
            </View>
          )}
          <View style={[styles.messageArea, { minHeight: errorSpaceHeight }]}>
            <MyText
              variant='small'
              style={[
                !messageText && { opacity: 0 },
                showError ? styles.errorText : styles.hintText,
                mergeStyle(errorConfig?.style)
              ]}
              className={errorConfig?.className}>
              {messageText || 'no text'}
            </MyText>
          </View>
        </View>
      )}
    </View>
  )
}

export default InputCustom
