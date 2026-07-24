import React, { useEffect } from 'react'
import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { Colors, sizeImageSquare, pixelByHeight } from 'common/styles'

const THUMB = sizeImageSquare(18)
const TRACK_H = pixelByHeight(6)

/**
 * Horizontal gas-multiplier slider built on RNGH (not PanResponder) so it
 * cooperates with the gorhom bottom-sheet gesture instead of fighting it:
 *   - the pan activates on HORIZONTAL movement (activeOffsetX) -> adjusts gas
 *   - it FAILS on vertical movement (failOffsetY) -> lets the sheet pan-down-to-
 *     close take over, so swipe-to-close still works anywhere (incl. the thumb).
 *
 * Props:
 *   value        current multiplier (min..max)
 *   min, max, step
 *   trackWidth   measured width of the track (px); thumb travels 0..trackWidth
 *   onChange     (value) => void, fired continuously WHILE dragging, but only when
 *                the quantized (stepped) value actually changes — so JS updates
 *                live without a callback on every animation frame.
 *   onChangeEnd  (value) => void, fired on release with the final value.
 */
const GasSlider = ({ value = 1, min = 1, max = 10, step = 0.2, trackWidth = 0, onChange, onChangeEnd }) => {
  const x = useSharedValue(0)
  const startX = useSharedValue(0)
  // Last quantized value reported to JS during this drag, so onChange fires only
  // on a real step change (gates the runOnJS hops on the UI thread).
  const lastReported = useSharedValue(null)
  // True while the user is dragging — stops the value→thumb sync below from
  // fighting the gesture (live onChange feeds `value` back in mid-drag).
  const isDragging = useSharedValue(false)

  // Keep the thumb in sync with the external value / measured width — but not
  // while dragging, when the gesture itself owns the thumb position.
  useEffect(() => {
    if (isDragging.value) return
    if (trackWidth > 0) {
      const pct = (value - min) / (max - min)
      x.value = Math.max(0, Math.min(trackWidth, pct * trackWidth))
    }
  }, [value, trackWidth, min, max, x, isDragging])

  // Map a thumb x-position to the stepped multiplier (runs on the UI thread).
  const quantize = (xv) => {
    'worklet'
    const ratio = trackWidth > 0 ? xv / trackWidth : 0
    let v = min + ratio * (max - min)
    v = Math.round(v / step) * step
    if (v < min) v = min
    if (v > max) v = max
    return v
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      'worklet'
      startX.value = x.value
      lastReported.value = quantize(x.value)
      isDragging.value = true
    })
    .onUpdate((e) => {
      'worklet'
      let nx = startX.value + e.translationX
      if (nx < 0) nx = 0
      if (nx > trackWidth) nx = trackWidth
      x.value = nx
      if (onChange) {
        const v = quantize(nx)
        if (v !== lastReported.value) {
          lastReported.value = v
          runOnJS(onChange)(v)
        }
      }
    })
    .onEnd(() => {
      'worklet'
      isDragging.value = false
      runOnJS(onChangeEnd)(quantize(x.value))
    })
    .onFinalize(() => {
      'worklet'
      // Covers a cancelled/failed gesture (no onEnd) so the sync isn't left off.
      isDragging.value = false
    })

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - THUMB / 2 }] }))
  const selectedStyle = useAnimatedStyle(() => ({ width: x.value }))

  return (
    <View style={{ height: THUMB, justifyContent: 'center' }}>
      {/* track */}
      <View style={{ height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: Colors.BG_BOX_SMALL }} />
      {/* selected portion */}
      <Animated.View
        style={[{ position: 'absolute', left: 0, height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: Colors.BRAND }, selectedStyle]}
      />
      {/* draggable thumb */}
      <GestureDetector gesture={pan}>
        <Animated.View
          hitSlop={{ left: 12, right: 12, top: 12, bottom: 12 }}
          style={[{ position: 'absolute', left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: Colors.WHITE }, thumbStyle]}
        />
      </GestureDetector>
    </View>
  )
}

export default GasSlider
