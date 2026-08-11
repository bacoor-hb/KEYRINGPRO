import React from 'react'
import { Text } from 'react-native'
import { fontSize, getFontFamily, DECIMAL_DOWN_PIXEL } from 'common/styles'
import { cn, mergeStyle } from 'common/tailwind'
// Base size + default weight per variant. A custom `fontSize` prop overrides the
// base size only — lineHeight (×1.5) and fontFamily wiring stay the same.
export const VARIANT_CONFIG = {
  small: { size: 14, weight: 400 },
  subTitle: { size: 18, weight: 700 },
  title: { size: 30, weight: 700 },
  titleLarge: { size: 33, weight: 700 },
  default: { size: 16.5, weight: 400 }
}

/**
 * @param {'default' | 'small' | 'subTitle' | 'title' | 'titleLarge'} variant - base size: small 14px, default 16.5px, subTitle 18px, title 30px, titleLarge 33px
 * @param {string} [className] - Tailwind class
 * @param {boolean} [isUseDecimal] - apply decimal down-pixel adjustment
 * @param {number} [fontWeight] - override font weight
 * @param {number} [fontSize] - override base size (design px), keeps lineHeight & fontFamily setup
 */
const MyText = ({
  style = {},
  variant = 'default',
  fontWeight,
  fontSize: fontSizeProp,
  isUseDecimal = false,
  ...props
}) => {
  const getDefaultStyle = () => {
    const downPixel = isUseDecimal ? DECIMAL_DOWN_PIXEL : 0
    const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.default
    const baseSize = fontSizeProp || config.size
    const style = {}

    style.fontSize = fontSize(baseSize - downPixel)
    style.lineHeight = fontSize(baseSize - downPixel) * 1.5
    style.fontFamily = getFontFamily(fontWeight || config.weight)

    return style
  }

  return (
    <Text
      {...props}
      className={cn(
        'text-white',
        props?.className
      )}
      style={[
        getDefaultStyle(),
        mergeStyle(style)
      ]}>
      {props.children}
    </Text>
  )
}

export default MyText
