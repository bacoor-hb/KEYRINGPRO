import React from 'react'

import { View, TouchableWithoutFeedback } from 'react-native'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { getSizeImgSquare, sizeImageSquare } from 'common/styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }

const Checkbox = (props) => {
  const { isCheck, style, onChange, iconSize } = props

  const getSizeIcon = () => {
    if (iconSize) {
      return { width: sizeImageSquare(iconSize), height: sizeImageSquare(iconSize) }
    }
    return { width: getSizeImgSquare('medium'), height: getSizeImgSquare('medium') }
  }

  const onChangeChecked = () => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
    onChange?.(!isCheck)
  }
  return (
    <TouchableWithoutFeedback style={style} onPress={onChangeChecked}>
      <View>
        {
          isCheck ? (
            <ImageRender resizeMode='contain' uri={images.UIV2.icons.checkboxBrand} style={{ ...getSizeIcon() }} />
          ) : (
            <View style={{ opacity: isCheck ? 0 : 1, ...getSizeIcon() }} className='rounded-[6px] border-[2px] border-low' />
          )
        }
        {/*
        <View style={{ opacity: isCheck ? 0 : 1, ...getSizeIcon() }} className='rounded-[6px] border-[2px] border-low' />
        {
          isCheck
            ? <ImageRender resizeMode='contain' uri={images.UIV2.icons.checkboxBrand} style={{ ...getSizeIcon() }} />
            : null
        } */}
      </View>
    </TouchableWithoutFeedback>
  )
}

export default Checkbox
