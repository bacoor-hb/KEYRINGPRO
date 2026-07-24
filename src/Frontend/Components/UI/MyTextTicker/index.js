import React from 'react'
import { StyleSheet } from 'react-native'
import { DECIMAL_DOWN_PIXEL, fontSize, getFontFamily } from 'common/styles'
import { cn, mergeStyle } from 'common/tailwind'
import TextTicker from 'react-native-text-ticker'

/**
 * @param {StyleProp<TextStyle>} style - Text style override
 * @param {'default' | 'small' | 'subTitle' | 'title' | 'titleLarge'} variant - Text size variant
 * @param {boolean} isUseDecimal - Shrink font size by one design pixel for decimal rendering
 * @param {string} fontWeight - Font weight override
 */
const MyTextTicker = ({
  style = {},
  variant = 'default',
  isUseDecimal = false,
  fontWeight,
  ...props
}) => {
  const getDefaultStyle = () => {
    const downPixel = isUseDecimal ? DECIMAL_DOWN_PIXEL : 0
    const style = {}

    switch (variant) {
      case 'small':
        style.fontSize = fontSize(14 - downPixel)
        style.lineHeight = fontSize(14 - downPixel) * 1.5
        style.fontFamily = getFontFamily(fontWeight || 400)
        break
      case 'subTitle':
        style.fontSize = fontSize(18 - downPixel)
        style.lineHeight = fontSize(18 - downPixel) * 1.5
        style.fontFamily = getFontFamily(fontWeight || 700)
        break
      case 'title':
        style.fontSize = fontSize(30 - downPixel)
        style.lineHeight = fontSize(30 - downPixel) * 1.5
        style.fontFamily = getFontFamily(fontWeight || 700)
        break
      case 'titleLarge':
        style.fontSize = fontSize(33 - downPixel)
        style.lineHeight = fontSize(33 - downPixel) * 1.5
        style.fontFamily = getFontFamily(fontWeight || 700)
        break
      default:
        style.fontSize = fontSize(16.5 - downPixel)
        style.lineHeight = fontSize(16.5 - downPixel) * 1.5
        style.fontFamily = getFontFamily(fontWeight || 400)
        break
    }
    return style
  }

  return (
    <TextTicker
      animationType='scroll'
      loop
      marqueeDelay={1000}
      duration={((props.children?.toString()?.length || 1)) * 200}
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
    </TextTicker>
  )
}

const shallowEqual = (a, b) => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => a[key] === b[key])
}

// Compare children by VALUE. Children are often written as `{title} static text`
// so React creates a new array each render even when content hasn't changed — if we
// only compare references, memo always fails and the marquee resets. Compare strings
// and numbers directly, compare arrays element-wise; everything else (JSX elements)
// falls back to reference comparison.
const childrenEqual = (a, b) => {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => childrenEqual(item, b[i]))
  }
  return false
}

// Only re-render when something that actually affects output changes (children, style
// flattened by value, and remaining props). This way when the parent changes state but
// children stay the same, the component doesn't restart the animation from the beginning.
const arePropsEqual = (prev, next) => {
  const { style: prevStyle, children: prevChildren, ...prevRest } = prev
  const { style: nextStyle, children: nextChildren, ...nextRest } = next

  if (!childrenEqual(prevChildren, nextChildren)) return false
  if (!shallowEqual(StyleSheet.flatten(prevStyle), StyleSheet.flatten(nextStyle))) return false
  return shallowEqual(prevRest, nextRest)
}

export default React.memo(MyTextTicker, arePropsEqual)
