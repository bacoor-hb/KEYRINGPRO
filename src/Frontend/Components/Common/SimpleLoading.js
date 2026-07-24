
import React from 'react'
import { width } from 'common/styles'
import LottieView from 'lottie-react-native'
import images from 'assets/Image'

const SimpleLoader = ({ style }) => {
  return (
    <LottieView
      loop
      autoPlay
      style={[{ width: width(10), height: width(10) }, style]}
      source={images.simpleLoader} />
  )
}
export default SimpleLoader
