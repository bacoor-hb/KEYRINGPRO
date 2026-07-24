import React, { useRef, useEffect } from 'react'
import { View, Animated, Easing, StyleSheet } from 'react-native'
import LottieView from 'lottie-react-native'
import images from 'assets/Image'
import { getSizeImgSquare } from 'common/styles'
import MyIcon from 'frontend/Components/UI/MyIcon'

const RING_SIZE = getSizeImgSquare('large')
const ICON_SIZE = getSizeImgSquare('title')

// Animated step marker for transaction timelines (Sending / Waiting nodes): a
// one-shot Lottie ring with a centered outline icon that pops in (scale 0 → 1).
// When `animate` is false (a state restored from history), it renders the final
// state statically — no ring playback, no pop-in — so re-entering the chat
// doesn't replay the intro.
const TxStepIcon = ({ uri, animate = true }) => {
  // This is a one-shot intro marker: only the value of `animate` at mount time
  // matters. Capturing it in a ref (instead of reading the live prop) keeps a
  // later false → true flip from replaying the pop-in — e.g. when the parent
  // timeline turns animation on for the settled result node, this Sending/Waiting
  // icon must stay put.
  const animateOnMount = useRef(animate).current

  // Seed at the end state when static so there's nothing to animate in.
  const progress = useRef(new Animated.Value(animateOnMount ? 0 : 1)).current

  useEffect(() => {
    if (!animateOnMount) return
    Animated.timing(progress, {
      toValue: 1,
      duration: 800,
      delay: 500,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true
    }).start()
    // Mount-only: intentionally not re-run when `animate` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })

  return (
    <View style={styles.ring}>
      {/* When static, pin the ring to its last frame (progress=1) so the fully
          drawn ring shows instead of the empty first frame. */}
      <LottieView
        style={styles.ringBg}
        source={images.txStepBgCircle}
        autoPlay={animateOnMount}
        loop={false}
        {...(animateOnMount ? {} : { progress: 1 })}
      />
      <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>
        <MyIcon style={styles.icon} uri={uri} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  ring: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringBg: { position: 'absolute', width: RING_SIZE, height: RING_SIZE },
  icon: { width: ICON_SIZE, height: ICON_SIZE }
})

export default TxStepIcon
