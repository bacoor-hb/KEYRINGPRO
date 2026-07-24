import { View, FlatList } from 'react-native'
import React from 'react'
import { getHeightHeader, getHeightHeaderDrawer } from 'common/styles'
/**
 * @param {boolean} [isUseDrawer] - Use drawer header height instead of the standard header
 * @param {boolean} [blurHeader] - Whether to render a spacer for the blur header
 * @param {number} [heightHeaderBlur] - Custom height for the blur header spacer
 */
const FlatListBlurHeader = ({ isUseDrawer = false, blurHeader = true, heightHeaderBlur, ...props }) => {
  const headerHeight = heightHeaderBlur || (isUseDrawer ? getHeightHeaderDrawer() : getHeightHeader(true))

  // An `inverted` list is flipped, so the top of the SCREEN is the end of the
  // content. Clearing the floating header there needs padding on the content
  // container, not a spacer row: a spacer only ever pads the one row it sits
  // next to, so every other message would still scroll up under the header and
  // be hidden by it. Padding travels with the content and keeps the whole list
  // clear of the header at any scroll position.
  //
  // paddingBottom (not Top) because the flip reverses the axis — this is the
  // edge that renders at the top of the screen.
  if (props.inverted) {
    return (
      <FlatList
        {...props}
        contentContainerStyle={[
          props.contentContainerStyle,
          blurHeader && { paddingBottom: headerHeight }
        ]}
      />
    )
  }

  // Upright: unchanged. The spacer row is the long-standing behaviour for these
  // screens, and the lists using it are not scrolled under the header the way
  // the chat is.
  return (
    <FlatList
      {...props}
      ListHeaderComponent={(
        <View>
          {
            blurHeader && (
              <View style={{ height: heightHeaderBlur || (isUseDrawer ? getHeightHeaderDrawer() : getHeightHeader(true)) }} />
            )
          }
          {props.ListHeaderComponent && props.ListHeaderComponent}
        </View>
      )}
    />
  )
}

export default FlatListBlurHeader
