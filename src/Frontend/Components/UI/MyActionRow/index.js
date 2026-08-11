import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import createStyles from './styles'
import { getSizeImgSquare, pixelByWidth } from 'common/styles'
import { cn, mergeStyle } from 'common/tailwind'

/**
 * @param {string} icon - Icon URI
 * @param {MyIconProps} [iconConfig] - Config passed to the icon
 * @param {React.ReactNode} title - Row title
 * @param {string} [description] - Secondary description text
 * @param {MyTextProps} [descriptionConfig] - Config for description text
 * @param {() => void} [onPress] - Press handler
 * @param {React.ReactNode} [rightElement] - Right-side element
 * @param {React.ReactNode} [leftElement] - Left-side element
 * @param {React.ReactNode} [middleElement] - Middle element replacing default title
 * @param {boolean} [noBorder] - Remove bottom border
 * @param {StyleProp<ViewStyle>} [containerStyle] - Outer container style
 * @param {string} [titleClassName] - Tailwind class for title
 * @param {StyleProp<ViewStyle>} [titleStyle] - Title inline style
 * @param {StyleProp<ViewStyle>} [labelStyle] - Label container style
 * @param {boolean} [isSelectDropdown] - Use View instead of TouchableOpacity
 */
const MyActionRow = ({
  icon,
  title,
  description,
  onPress = undefined,
  rightElement,
  noBorder = false,
  containerStyle,
  contentContainerStyle,
  titleClassName,
  titleStyle,
  leftElement,
  middleElement,
  labelStyle,
  iconConfig,
  descriptionConfig,
  isSelectDropdown = false
}) => {
  const styles = createStyles()
  const Container = isSelectDropdown ? View : TouchableOpacity

  return (
    <Container
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.itemContainer, containerStyle]}
    >
      <View style={[styles.itemContentContainer, contentContainerStyle]} className='flex-row items-center'>
        {leftElement || (icon && (
          <View {...iconConfig} style={[{ justifyContent: 'center', alignItems: 'center', width: getSizeImgSquare('large') }, mergeStyle(iconConfig?.style)]}>
            <MyIcon uri={icon} variant={iconConfig?.variant || 'medium'} />
          </View>
        ))}

        <View style={[styles.label, labelStyle, noBorder && { borderBottomWidth: 0 }]}>
          {
            middleElement || (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                className='flex-1  flex-row items-center'
                disabled={!onPress}
                style={{ gap: pixelByWidth(12) }}
              >
                {
                  typeof title === 'string' || typeof title === 'number' ? (
                    <View className='flex-1'>
                      {/* <TextTicker
                      animationType='scroll'
                      loop
                      marqueeDelay={1000}
                      duration={title.length * 200}
                      className={`text-medium flex-1 ${titleClassName || ''}`}>
                      {title}
                    </TextTicker> */}
                      <MyText className={`text-medium  ${titleClassName || ''}`} style={titleStyle}>{title}</MyText>

                    </View>
                  ) : title
                }
                {rightElement}
              </TouchableOpacity>
            )
          }

          {
            middleElement && rightElement && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                className='flex-1 flex-row items-center'
                disabled={!onPress}
              >
                {rightElement}
              </TouchableOpacity>
            )
          }
        </View>
      </View>

      {description && (
        <View style={styles.itemContentContainer} className='flex-row items-center'>
          {/* Invisible spacer mirroring the leading icon column so the
              description lines up with the title column above it. */}
          <View className='opacity-0'>
            {leftElement || (icon && (
              <View {...iconConfig} style={[{ justifyContent: 'center', alignItems: 'center', width: getSizeImgSquare('large') }, mergeStyle(iconConfig?.style)]}>
                <MyIcon uri={icon} variant={iconConfig?.variant || 'medium'} />
              </View>
            ))}
          </View>
          <MyText {...descriptionConfig} className={cn('text-low flex-wrap flex-1', descriptionConfig?.className)}>
            {description}
          </MyText>
        </View>
      )}
    </Container>
  )
}

export default MyActionRow
