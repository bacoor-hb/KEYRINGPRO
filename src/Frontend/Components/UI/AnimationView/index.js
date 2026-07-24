import React, { useEffect } from 'react'
import { ANIMATION_DRAWER } from 'common/constants/drawer'
import Animated, { Extrapolation, interpolate, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { View } from 'react-native'
import { Colors } from 'common/styles'

const AnimationView = ({ animation, children, duration = 300 }) => {
  const zoomAnim = useSharedValue(0)

  useEffect(() => {
    zoomAnim.value = withTiming(1, {
      // stiffness: 180,
      // damping: 10,
      // mass: 0.8,
      duration,
      reduceMotion: ReduceMotion.Never
    })
  }, [duration])

  const animatedStyle = useAnimatedStyle(() => {
    let transformOrigin = 'bottom right'
    if (animation === ANIMATION_DRAWER.ZOOM_FORM_BOTTOM_RIGHT) {
      transformOrigin = 'bottom right'
    }

    if (animation === ANIMATION_DRAWER.ZOOM_FORM_BOTTOM_LEFT) {
      transformOrigin = 'bottom left'
    }

    const scale = interpolate(
      zoomAnim.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    )

    const opacity = interpolate(
      zoomAnim.value,
      [0, 0.5, 1],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    )

    return {
      transform: [{ scale }],
      opacity,
      transformOrigin
    }
  })

  return (
    <View style={{ flex: 1, backgroundColor: Colors.BLACK }}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {children}
      </Animated.View>
    </View>
  )
}

export default AnimationView
