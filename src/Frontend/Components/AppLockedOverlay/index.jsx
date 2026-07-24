import React, { useState, useEffect } from 'react'
import { View, Image } from 'react-native'
import images from 'assets/Image'
import { width } from 'common/styles'
import { getLockState } from 'common/lockout'
import MyText from 'frontend/Components/UI/MyText'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import styles from './styles'

// Builds the live "Try again in …" line from the remaining lock time.
const formatRetry = (remainingMs) => {
  const minutes = Math.ceil(remainingMs / 60000)
  if (minutes >= 60) return 'Try again in an hour'
  if (minutes <= 1) return 'Try again in a minute'
  return `Try again in ${minutes} minutes`
}

// Self-contained, full-screen lock UI shown after too many failed
// password/passcode attempts. Uses the pre-blurred unlock-screen artwork
// (bgAppLockedBlur) as the background so the host screen is fully hidden, with a
// crisp header + centered message painted on top.
const AppLockedOverlay = ({ title = 'App Unavailable' }) => {
  const [remainingMs, setRemainingMs] = useState(() => getLockState().remainingMs)

  // Tick the countdown down to the unlock time.
  useEffect(() => {
    const id = setInterval(() => setRemainingMs(getLockState().remainingMs), 1000)
    return () => clearInterval(id)
  }, [])

  const subtitle = formatRetry(remainingMs)

  return (
    <View style={styles.screen}>
      {/* Pre-blurred unlock-screen background */}
      <Image
        source={images.UIV2.bgAppLockedBlur}
        style={styles.bg}
        resizeMode='cover'
      />

      {/* Centered lock message */}
      <View style={styles.center} pointerEvents='none'>
        <MyText variant='title' style={styles.title}>{title}</MyText>
        <MyText variant='subTitle' fontWeight={400} style={styles.subtitle}>{subtitle}</MyText>
      </View>

      {/* Crisp header on top of the blurred background */}
      <View style={styles.headerArea} pointerEvents='none'>
        <ImageRender
          uri={images.UIV2.icons.coldNFCWallet}
          style={styles.coldNFC}
        />
        <View style={styles.logoWrap}>
          <ImageRender
            style={{ width: width(55), height: width(55) * (61 / 257) }}
            resizeMode='contain'
            uri={images.UIV2.keyringProText}
          />
        </View>
      </View>
    </View>
  )
}

export default AppLockedOverlay
