import React from 'react'
import { FlatList, View } from 'react-native'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import { pixelByHeight } from 'common/styles'
import { mergeStyle } from 'common/tailwind'

/**
 * @param {MyActionRowProps[]} data - row items to render
 * @param {StyleProp<ViewStyle>} [style] - container style
 * @param {string} [className] - Tailwind class
 * @param {boolean} [isFlatList] - use FlatList instead of View
 * @param {object} [flatListProps] - extra FlatList props (data/renderItem/keyExtractor excluded)
 */
const ListActionRow = ({
  data,
  style,
  className,
  isFlatList = false,
  flatListProps
}) => {
  if (isFlatList) {
    return (
      <FlatList
        {...flatListProps}
        // contentContainerStyle={[{ gap: pixelByHeight(12) }, mergeStyle(style)]}
        contentContainerStyle={[{ gap: pixelByHeight(0) }, mergeStyle(style)]}
        className={className}
        data={data}
        renderItem={({ item, index }) => (
          data?.customRender || (
            <MyActionRow
              key={`listActionRow_${index}`}
              {...item}
            />
          )
        )}
        keyExtractor={(item, index) => `listActionRow_${index}`}
      />
    )
  }

  return (
    <View
      // style={[{ gap: pixelByHeight(12) }, mergeStyle(style)]}
      style={[{ gap: pixelByHeight(0) }, mergeStyle(style)]}
      className={className}
    >
      {data.map((item, index) => (
        item?.customRender || (
          <MyActionRow
            key={`listActionRow_${index}`}
            {...item}
          />
        )
      ))}
    </View>
  )
}
export default ListActionRow
