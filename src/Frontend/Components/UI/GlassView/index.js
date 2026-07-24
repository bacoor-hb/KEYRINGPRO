import React from 'react'
import { View } from 'react-native'
import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass'
import { Colors } from 'common/styles'
import { mergeStyle } from 'common/tailwind'
import useHostSettled from './useHostSettled'

// GlassView owns the VARIANT COLORS (moved here from MyButton so every surface —
// button or plain view — shares one source of truth). Two color tables, one per
// rendering path, kept in sync so a variant looks the same whether or not the
// device supports liquid glass:
//   - VARIANT_TINT: the glass tint (iOS 26+ liquid-glass path).
//   - VARIANT_FALLBACK: real background/border for the plain <View> path.
// Every variant (default / outline / primary / dangerous) is covered in BOTH.
const VARIANT_TINT = {
  outline: 'transparent',
  primary: Colors.BLUE + 'CC',
  dangerous: Colors.RED + 'CC',
  default: 'rgba(26, 27, 33, 0.15)'
}

const VARIANT_FALLBACK = {
  outline: { backgroundColor: 'transparent' },
  primary: { backgroundColor: Colors.BLUE },
  dangerous: { backgroundColor: Colors.RED },
  default: {
    backgroundColor: 'rgba(26, 27, 33, 1)',
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL
  }
}

export const getVariantTint = (variant = 'default') =>
  VARIANT_TINT[variant] ?? VARIANT_TINT.default

export const getVariantFallback = (variant = 'default') =>
  VARIANT_FALLBACK[variant] ?? VARIANT_FALLBACK.default

// A liquid-glass surface tinted per `variant` (default when omitted). GlassView
// owns only the COLOR (glass tint on iOS 26+, a real bg/border fallback below);
// it has NO fixed size — sizing comes from the caller's `style`. Children render
// directly so the surface sizes itself from its content.
/**
 * @param {'clear' | string} [effect] - liquid glass effect type
 * @param {'default' | 'outline' | 'primary' | 'dangerous'} [variant] - color variant
 * @param {StyleProp<ViewStyle>} [style] - container style
 * @param {string} [tintColor] - override glass tint color
 * @param {boolean} [disableLiquidGlass] - force plain View fallback
 * @param {ReactNode} children
 */
const GlassView = ({
  effect = 'clear',
  variant = 'default',
  style,
  tintColor,
  disableLiquidGlass = false,
  children,
  ...props
}) => {
  // Fabric + iOS 26 liquid glass: when the native LiquidGlassView is committed
  // WHILE its host (a drawer/modal) is still opening/animating, iOS materializes
  // the glass on an unsettled view and never paints it — the surface stays blank
  // until some later re-render (that's why "change state then the glass shows").
  //
  // We DON'T guess this with a timer (too long → the flat fallback visibly pops
  // to glass = flicker; too short → promotes before the host finished opening =
  // lost / broken effect). Instead `useHostSettled` reads the REAL settle signal
  // published by the animated host around this surface (a drawer or an alert),
  // and flips true exactly when that open animation lands — the animation is
  // fully preserved, glass just appears as it settles. Outside any animated host
  // it's true immediately (glass shows at once, no flicker). See ./useHostSettled.
  const hostSettled = useHostSettled()

  const useGlass = isLiquidGlassSupported && !disableLiquidGlass && hostSettled

  // Color only — size is provided by the caller through `style`. When glass is
  // active the surface is tinted (no background) and left to the tint layer.
  // Children are rendered directly so the surface sizes itself from its content
  // — no full-height wrapper, which would collapse/stretch when the caller's
  // style has no fixed height.
  const composedStyle = [
    useGlass ? null : getVariantFallback(variant),
    mergeStyle(style)
  ]

  if (useGlass) {
    return (
      // `interactive` is what gives the glass its press/touch response — without
      // it the surface is static (no touch ripple). Default it on for variant
      // surfaces; callers can still override via props.
      <LiquidGlassView
        interactive
        colorScheme='dark'
        {...props}
        tintColor={tintColor ?? getVariantTint(variant)}
        effect={effect}
        style={composedStyle}
      >
        {children}
      </LiquidGlassView>
    )
  }

  // Strip glass-only props so they don't leak onto the fallback <View>. The
  // fallback renders until the host settles, then we swap to the glass surface.
  const { interactive, colorScheme, ...viewProps } = props
  return (
    <View {...viewProps} style={composedStyle}>
      {children}
    </View>
  )
}

export default GlassView
