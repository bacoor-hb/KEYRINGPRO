import { View } from 'react-native'
import React from 'react'
import { pixelByHeight } from 'common/styles'
import useComponentHeights from 'frontend/Hooks/useComponentHeights'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const TitleScreen = ({ title, rightContent, noHeaderAnchor, onLayout, ref, style = {} }) => {
  const { onLayoutHeaderAnchorDefault } = useComponentHeights()

  const onLayoutComponent = (e) => {
    if (onLayout) {
      onLayout?.(e)
    } else {
      if (noHeaderAnchor) {
        const eventNoData = {
          nativeEvent: {
            layout: {
              height: 0,
              width: 0
            }
          }
        }
        onLayoutHeaderAnchorDefault(eventNoData)
      } else {
        onLayoutHeaderAnchorDefault(e)
      }
    }
  }
  return (
    <View
      ref={ref}
      onLayout={onLayoutComponent}
      style={[{
        minHeight: pixelByHeight(68),
        paddingTop: pixelByHeight(16),
        paddingBottom: pixelByHeight(12),
        gap: pixelByHeight(8)
      }, style]}
      className='flex-row justify-start items-start'>
      <View style={{ flex: 1 }}>
        <MyTextTicker variant='title' fontWeight={700}>
          {title}
        </MyTextTicker>
      </View>
      {rightContent}
    </View>
  )
}

export default TitleScreen
