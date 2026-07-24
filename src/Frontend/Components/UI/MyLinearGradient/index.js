import React from 'react'
import LinearGradient from 'react-native-linear-gradient'
import { Colors } from 'common/styles'
import { View, StyleSheet } from 'react-native'
import { cn, mergeStyle } from 'common/tailwind'

const GRADIENT_COLORS = ['#212229', '#0F0F12']
const GRADIENT_LOCATIONS = [0.2358, 1]
const GRADIENT_START = { x: 0.5, y: 0 }
const GRADIENT_END = { x: 0.5, y: 1 }
const BG_FILL = { ...StyleSheet.absoluteFillObject, backgroundColor: '#1D1E24' }
const RADIUS = { default: 16, modal: 32 }

/**
 * @param {React.ReactNode} children - Content inside the gradient
 * @param {'default' | 'modal'} variant - Border radius preset
 * @param {boolean} disableClip - Use layered View mode for dynamically-mounted children (Fabric safety)
 */
const MyLinearGradient = ({ children, variant = 'default', disableClip = false, ...props }) => {
  const extraStyle = Array.isArray(props.style) ? [...props.style] : { ...props.style }

  if (disableClip) {
    const radius = { borderRadius: RADIUS[variant] || RADIUS.default }
    return (
      <View
        {...props}
        // className={cn(variant === 'default' ? 'rounded-2xl' : 'rounded-[32px]')}
        // Base color lives on the container View itself so it always fills the rounded+bordered
        // shape perfectly (no transparent corner slivers). The gradient is just an overlay on top.
        style={[{
          borderRadius: variant === 'default' ? 16 : 32
        },
        styles.containerDefault, styles.noClip, styles.baseFill, extraStyle]}>
        <LinearGradient
          colors={GRADIENT_COLORS}
          locations={GRADIENT_LOCATIONS}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={[StyleSheet.absoluteFill, radius, mergeStyle(props?.configLinear?.style)]}
          pointerEvents='none'
        />
        {children}
      </View>
    )
  }

  return (
    <View
      {...props}
      className={cn(
        variant === 'default' ? 'rounded-2xl' : 'rounded-[32px]'
      )}
      style={[
        styles.containerDefault,
        extraStyle
      ]}>
      <View style={BG_FILL} />
      <LinearGradient
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        start={GRADIENT_START}
        end={GRADIENT_END}
      >
        {children}
      </LinearGradient>
    </View>
  )
}

export default MyLinearGradient

const styles = StyleSheet.create({
  containerDefault: {
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    borderColor: Colors.BG_BOX_SMALL
  },
  noClip: {
    overflow: 'visible'
  },
  baseFill: {
    backgroundColor: '#1D1E24'
  }
})
