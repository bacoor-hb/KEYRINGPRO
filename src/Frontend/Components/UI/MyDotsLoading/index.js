import React from 'react'
import LottieView from 'lottie-react-native'
import images from 'assets/Image'
import { sizeImageSquare } from 'common/styles'

/**
 * @param {'default' | 'small' | 'large'} variant - size preset
 * @param {StyleProp<ViewStyle>} [style] - override LottieView style
 * @param {StyleProp<ViewStyle>} [containerStyle] - override container style
 * @param {number} [size] - explicit width/height, overrides variant
 * @param {any} [source] - Lottie animation source
 */
const MyDotsLoading = ({ style, containerStyle, variant = 'default', size, source = images.threeDotsLoading }) => {
  const getSizeDefault = () => {
    if (size) {
      return size
    }
    switch (variant) {
      case 'small':
        return sizeImageSquare(36)
      case 'large':
        return sizeImageSquare(48)
      default:
        return sizeImageSquare(18)
    }
  }
  return (
    <LottieView
      style={[{ width: getSizeDefault(), height: getSizeDefault() }, style]}
      containerStyle={{ ...containerStyle }}
      source={source}
      autoPlay
      loop />
  )
}

export default MyDotsLoading
