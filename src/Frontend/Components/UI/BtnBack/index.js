import { View, StyleSheet } from 'react-native'
import React from 'react'
import MyButton from '../MyButton'
import MyIcon from '../MyIcon'
import { getSizeImgSquare } from 'common/styles'
import images from 'assets/Image'
import { mergeStyle } from 'common/tailwind'

const styles = StyleSheet.create({
  btnBack: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    // overflow: 'hidden',
    paddingHorizontal: 0
  },
  icon: {
    // width: sizeImageSquare(18),
    // height: sizeImageSquare(18)
  }
})

const BtnBack = ({ isToNext = false, interactive = true, style, label, onPress = () => {}, className, ...props }) => {
  return (
    <MyButton
      {...props}
      interactive={interactive}
      noMinWidth
      style={[styles.btnBack, mergeStyle(style)]}
      onPress={onPress}
      className={className}

    >
      <View style={{ transform: [{ rotate: isToNext ? '180deg' : '0deg' }] }} className='flex flex-row items-center '>
        <MyIcon style={styles.icon} uri={images.UIV2.icons.arrowLeftWhite} />
      </View>
    </MyButton>
  )
}

export default BtnBack
