import React from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
  Keyboard
} from 'react-native'
import { Colors, DarkColors, height, scale, width } from 'common/styles'
import { mergeStyle } from 'common/tailwind'
import GlassView from '../GlassView'
import { getSizeStyle } from '../GlassView/sizeStyle'
import Spinner from 'frontend/Components/Common/Spinner'
import MyText from '../MyText'
/**
 * Clickable button. A <GlassView variant> is the surface — it owns the COLOR
 * (glass tint or fallback background); MyButton owns the SIZE and the content.
 * Touch wraps the surface (like the original) so the press effect covers it.
 *
 * Need a non-clickable surface with the same colors? Use <GlassView variant>
 * directly and supply your own size via `style` — GlassView has no fixed size.
 *
 * @param {string} size small (44px), medium (44px), floating (52px)
 * @param {string} variant primary (blue), default, dangerous (red), outline
 * @param {boolean} [isLoading] - Show loading spinner
 * @param {*} [customLoading] - Custom loading component
 * @param {boolean} [isSub] - Secondary/outlined style
 * @param {*} [icon] - Left icon element
 * @param {function} [onPress] - Press handler
 * @param {string} [label] - Button text
 * @param {object} [style] - Container style
 * @param {*} [iconStyle] - Icon wrapper style
 * @param {*} [styleInside] - Inner row style
 * @param {object} [textStyle] - Label text style
 * @param {boolean} [isDisable] - Disable interaction
 * @param {string} [urlImage] - Right image URL
 * @param {object} [styleImage] - Right image style
 * @param {string} [className] - Tailwind class
 * @param {boolean} [noMinWidth] - Remove min width
 * @param {boolean} [disableLiquidGlass] - Force plain View fallback
 * @param {boolean} [isUseHeader] - Use header size variant
 * @param {boolean} [isCircleBtn] - Circular button shape
 */
// Pull the resolved `opacity` out of a style prop (object, array, or nested
// arrays) — last value wins, matching RN's own flattening.
const readOpacity = (style) => {
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i--) {
      const o = readOpacity(style[i])
      if (o != null) return o
    }
    return null
  }
  return style && style.opacity != null ? style.opacity : null
}

const MyButton = ({
  style = {},
  size = 'small',
  variant = 'default',
  noMinWidth = false,
  disableLiquidGlass = false,
  isUseHeader = false,
  isCircleBtn = false,
  isSub = false,
  isLoading = false,
  customLoading = null,
  icon,
  onPress,
  label,
  children,
  iconStyle,
  styleInside,
  textStyle,
  isDisable,
  urlImage,
  styleImage,
  className
}) => {
  // A button hidden with `opacity: 0` keeps the native LiquidGlassView mounted
  // while invisible; iOS then materializes the glass on a hidden view (broken
  // off-screen pass) and it never paints once shown — only the label shows. When
  // the button is fully transparent there is nothing to see anyway, so drop to
  // the plain (non-glass) surface; the glass comes back automatically once
  // opacity rises above 0. Callers don't have to think about it.
  const isTransparent = readOpacity(style) === 0
  const noGlass = disableLiquidGlass || isTransparent

  return (
    <TouchableOpacity
      className={className}
      style={styles.touch}
      onPressIn={() => Keyboard.dismiss()}
      disabled={isDisable || isLoading}
      onPress={onPress}
      activeOpacity={customLoading ? 1 : 0.8}
    >
      <GlassView
        variant={variant}
        disableLiquidGlass={noGlass}
        style={[
          styles.surface,
          getSizeStyle({ size, noMinWidth, isUseHeader, isCircleBtn }),
          isSub && styles.subBtn,
          isDisable && styles.disabled,
          mergeStyle(style)
        ]}
      >
        {isLoading
          ? customLoading || <Spinner size={height(2.7)} type='Wave' color={Colors.TEXT} />
          : children || (
            <View style={[styles.rowBtn, styleInside]}>
              {icon ? <View style={[styles.paddingIcon, iconStyle]}>{icon}</View> : null}
              <MyText style={[styles.label, textStyle]}>{label}</MyText>
              {urlImage && <Image source={{ uri: urlImage }} style={styleImage} resizeMode='contain' />}
            </View>
          )}
      </GlassView>
    </TouchableOpacity>
  )
}

export default MyButton

const styles = StyleSheet.create({
  touch: {
    alignSelf: 'center'
  },
  // Center the button's content within the glass surface (the surface gets its
  // height from getSizeStyle). Replaces GlassView's old full-height wrapper.
  surface: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Secondary/outlined button — gray ring, transparent fill (dark-mode only).
  subBtn: {
    borderWidth: scale(1),
    borderColor: DarkColors.GRAY4,
    backgroundColor: 'transparent'
  },
  disabled: {
    opacity: 0.5
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  paddingIcon: {
    marginRight: width(2.5)
  },
  label: {
    color: 'white',
    textAlign: 'center'
  }
})
