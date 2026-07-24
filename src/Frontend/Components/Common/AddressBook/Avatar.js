/* eslint-disable react-native/no-unused-styles */
import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Image } from 'react-native'
import { height } from 'common/styles'
import images from 'assets/Image'
import { SvgXml } from 'react-native-svg'

const AddressBookAvatar = ({ base64Data, customAvatar, style, avatarStyle }) => {
  base64Data = (base64Data || '').trim()

  const isSvgData = base64Data?.startsWith('data:image/svg+xml;base64,')
  const base64DataSvg = isSvgData ? Buffer.from(base64Data.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8') : ''

  // Derive the source straight from props — a one-time `useState(initial)` only
  // captured the FIRST avatar, so re-rendering this same element with a new entry
  // (e.g. picking a second address-book item) kept showing the previous image.
  // Only the load-error fallback is stateful; reset it whenever the avatar changes
  // so a new valid image isn't masked by a prior one's failure.
  const [hasError, setHasError] = useState(false)
  useEffect(() => { setHasError(false) }, [base64Data, customAvatar])

  const imageSource = hasError
    ? images.avatarAddressBook
    : (customAvatar || (base64Data ? { uri: base64Data } : images.avatarAddressBook))

  return (

    <View style={[styles.container, style]}>
      {
        isSvgData ? (
          <SvgXml xml={base64DataSvg} width={avatarStyle?.width || height(3.5)} height={avatarStyle?.height || height(3.5)} />
        ) : (
          <Image
            source={imageSource}
            style={[styles.avatarIcon, avatarStyle]}
            onError={() => { setHasError(true) }}
          />
        )
      }
    </View>

  )
}

export default AddressBookAvatar

const styles = StyleSheet.create({
  container: {
    borderRadius: 5,
    backgroundColor: 'transparent',
    overflow: 'hidden'
  },
  avatarIcon: {
    width: height(3.5),
    height: height(3.5),
    resizeMode: 'contain'
  }
})
