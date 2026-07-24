import { View } from 'react-native'
import React from 'react'
import { PADDING_TOP_CONTAINER_DRAWER, pixelByWidth } from 'common/styles'
import useComponentHeights from 'frontend/Hooks/useComponentHeights'
/**
 * @param {StyleProp<ViewStyle>} style - Container style override
 * @param {boolean} isUseDrawer - Apply top padding for drawer header
 * @param {boolean} isSetHeightLayout - Track layout height via useComponentHeights
 */
const MyViewPage = ({ style, isUseDrawer = false, isSetHeightLayout = false, ...props }) => {
  const { onLayoutContainerDefault } = useComponentHeights()
  return (
    <View
      onLayout={isSetHeightLayout ? onLayoutContainerDefault : undefined}
      {...props}
      style={[
        { paddingHorizontal: pixelByWidth(16) },
        isUseDrawer && { paddingTop: PADDING_TOP_CONTAINER_DRAWER },
        Array.isArray(style) ? [...style] : { ...style }
      ]} />
  )
}

export default MyViewPage
