import React, { useEffect, useRef } from 'react'
import { View, Animated, Easing } from 'react-native'
import styles from './styles'

const Dot = ({ delay }) => {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [delay, opacity])

  return <Animated.View style={[styles.typingDot, { opacity }]} />
}

// Just the animated dots — no avatar, background or border.
// `bare` drops the message-row margins/padding so the dots can sit centered
// inside a tight container (e.g. the round jump-to-bottom button).
const TypingIndicator = ({ bare = false }) => (
  <View style={bare ? styles.typingBare : [styles.row, styles.rowBot, styles.typingContainer]}>
    <Dot delay={0} />
    <Dot delay={150} />
    <Dot delay={300} />
  </View>
)

export default TypingIndicator
