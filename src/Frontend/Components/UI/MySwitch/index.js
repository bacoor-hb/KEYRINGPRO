import React, { useCallback, useEffect, useRef } from 'react'
import { Switch, Pressable, Animated, StyleSheet } from 'react-native'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }

const TRACK_WIDTH = 50
const TRACK_HEIGHT = 28
const THUMB_SIZE = 22
const THUMB_MARGIN = (TRACK_HEIGHT - THUMB_SIZE) / 2

const TRACK_ON = '#2D8DEDCC'
const TRACK_OFF = '#28292E'
const THUMB_COLOR = '#FFFFFF'

// iOS keeps the native Switch look; Android uses a custom pill switch
/**
 * @param {boolean} value - Switch on/off state
 * @param {(next: boolean) => void} onValueChange - Callback when value changes
 * @param {boolean} disabled - Disable interaction
 * @param {StyleProp<ViewStyle>} style - Container style
 */
const DefaultSwitch = ({ value, onValueChange, disabled, style, ...props }) => {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false
    }).start()
  }, [value, anim])

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_MARGIN, TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN]
  })

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [TRACK_OFF, TRACK_ON]
  })

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange && onValueChange(!value)}
      style={style}
      {...props}
    >
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  )
}

/**
 * @param {(next: boolean) => void} onValueChange - Callback when toggle value changes
 */
const MySwitch = ({
  onValueChange,
  ...props
}) => {
  // iOS Switch already provides its own haptic; only Android needs it here
  const handleValueChange = useCallback((next) => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
    onValueChange && onValueChange(next)
  }, [onValueChange])

  if (ISIOS) {
    return (
      <Switch
        style={{
          height: TRACK_HEIGHT
        }}
        trackColor={{ false: TRACK_OFF, true: TRACK_ON }}
        thumbColor={THUMB_COLOR}
        onValueChange={onValueChange}
        {...props}
      />
    )
  }

  return <DefaultSwitch onValueChange={handleValueChange} {...props} />
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center'
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: THUMB_COLOR
  }
})

export default MySwitch
