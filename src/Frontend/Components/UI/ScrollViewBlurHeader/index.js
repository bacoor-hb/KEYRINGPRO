import { ScrollView as ScrollViewNative } from 'react-native'
import React from 'react'
import { getHeightHeaderDrawer, getHeightHeader } from 'common/styles'
import { ScrollView as ScrollViewDrawer } from 'react-native-gesture-handler'
import { mergeStyle } from 'common/tailwind'

/**
 * @param {boolean} isUseDrawer - Use gesture-handler ScrollView with drawer header padding
 * @param {boolean} blurHeader - Enable blur header effect
 * @param {number} heightHeaderBlur - Custom blur header height
 */
const ScrollViewBlurHeader = ({ isUseDrawer = false, blurHeader = true, heightHeaderBlur, ...props }) => {
  if (isUseDrawer) {
    return (
      <ScrollViewDrawer
        {...props}
        style={[
          {
            flex: 1
          },
          mergeStyle(props.style)
        ]}
        contentContainerStyle={[
          {
            // flex:1,
            paddingTop: getHeightHeaderDrawer()
          },
          mergeStyle(props.contentContainerStyle)
        ]}
      />
    )
  }
  return (
    <ScrollViewNative
      {...props}
      contentContainerStyle={[
        {
          paddingTop: getHeightHeader(true)
        },
        mergeStyle(props.contentContainerStyle)
      ]}
    />
  )
}

export default ScrollViewBlurHeader
