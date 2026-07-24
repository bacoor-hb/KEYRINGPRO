import { View } from 'react-native'
import React from 'react'
import SelectDropdown from 'react-native-select-dropdown'
import createStyles from './styles'
import MyActionRow from '../MyActionRow'
import { pixelByHeight } from 'common/styles'
/**
 * @param {React.ReactNode|Function} [children] - Render function or element for the dropdown trigger button
 * @param {boolean} [dropUp] - Force the menu to open above the trigger
 */
const MySelectDropdown = ({ children, dropUp, ...props }) => {
  const styles = createStyles()
  return (
    <SelectDropdown
      disableAutoScroll
      dropUp={dropUp}
      statusBarTranslucent
      dropdownOverlayColor='transparent'
      showsVerticalScrollIndicator={false}
      {...props}
      renderButton={(selectedItem, isVisible) => {
        return typeof children === 'function' ? children(selectedItem, isVisible) : children
      }}
      dropdownStyle={{ ...styles.dropdownStyle, ...props?.dropdownStyle }}
      renderItem={(item, index, isSelected) => {
        const isLastItem = index === props.data?.length - 1
        const isFirstItem = index === 0

        return (
          // <View style={[isLastItem ? {} : { marginBottom: pixelByHeight(12) }]}>
          <View style={[isLastItem ? {} : { marginBottom: pixelByHeight(0) }]}>
            {
              props?.renderItem ? props.renderItem(item, index, isSelected) : (
                <MyActionRow
                  labelStyle={isFirstItem ? { paddingTop: 0 } : isLastItem && { paddingBottom: 0 }}
                  title={item}
                  noBorder={isLastItem}
                />
              )
            }

          </View>
        )
      }}
    />
  )
}

export default MySelectDropdown
