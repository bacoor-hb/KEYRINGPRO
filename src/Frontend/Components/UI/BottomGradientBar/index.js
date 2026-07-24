import React from 'react'
import { StyleSheet } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import { Colors, getSafeAreaValues, pixelByHeight } from 'common/styles'

// Fixed bar pinned to the bottom of the screen. A LinearGradient scrim sits
// behind the children and darkens downward (transparent at the top → solid at
// the phone's bottom edge) so content scrolling underneath fades into the dark.
//
// Everything about the fade is customizable via props:
//   - colors     : gradient stops, top → bottom (default fades to Colors.BLACK)
//   - locations  : stop positions matching `colors`
//   - fadeHeight : how far above the children the fade starts (px)
// `children` render on top of the scrim inside a MyViewPage (standard 16px
// horizontal padding). Extra props/style spread onto the container.

const DEFAULT_FADE_HEIGHT = pixelByHeight(40)
// 00 = transparent, CC ≈ 80% — anchored to a single color so callers can recolor
// the whole fade by passing one hex (e.g. colors={[`${myColor}00`, myColor]}).
const DEFAULT_COLORS = [`${Colors.BLACK}00`, `${Colors.BLACK}CC`, Colors.BLACK]
const DEFAULT_LOCATIONS = [0, 0.5, 1]
const GRADIENT_START = { x: 0.5, y: 0 }
const GRADIENT_END = { x: 0.5, y: 1 }

/**
 * @param {React.Node} [children] - Content rendered on top of the gradient scrim
 * @param {string[]} [colors] - Gradient color stops, top to bottom
 * @param {number[]} [locations] - Stop positions matching the colors array
 * @param {number} [fadeHeight] - Height in px above children where the fade starts
 * @param {StyleProp<ViewStyle>} [style] - Style applied to the container
 */
const BottomGradientBar = ({
  children,
  colors = DEFAULT_COLORS,
  locations = DEFAULT_LOCATIONS,
  fadeHeight = DEFAULT_FADE_HEIGHT,
  style,
  ...props
}) => {
  return (
    <MyViewPage {...props} style={[styles.container, style]}>
      <LinearGradient
        colors={colors}
        locations={locations}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[styles.scrim, { top: -fadeHeight }]}
        pointerEvents='none'
      />
      {children}
    </MyViewPage>
  )
}

export default BottomGradientBar

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: pixelByHeight(8),
    paddingBottom: getSafeAreaValues().bottom
  },
  // Extends above the children (negative top) so the fade eases in gradually.
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0
  }
})
