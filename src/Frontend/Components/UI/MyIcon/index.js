import { Colors, getSizeImgSquare } from 'common/styles'
import { mergeStyle } from 'common/tailwind'
import { Icon } from 'frontend/Components/Common/Icon'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import React, { useContext } from 'react'
import { View } from 'react-native'

/**
 * @param {'small'|'medium'|'large'|'title'|'extraLarge'} [variant='medium'] - Icon size
 * @param {string} [name] - Icon font name
 * @param {boolean} [isIcon] - Render as icon font instead of image
 * @param {string} [uri] - Image URI
 * @param {string} [uriDefault] - Fallback image URI
 * @param {string} [resizeModeDefault='contain'] - Fallback resize mode
 * @param {string} [resizeMode='contain'] - Image resize mode
 * @param {any} [color] - Icon font color
 * @param {string} [typeIcon] - Icon font family type
 * @param {StyleProp<ImageProps>} [style] - Image/icon style
 * @param {string} [className] - Tailwind class
 * @param {boolean} [isBorderIcon] - Show circular border around icon
 * @param {StyleProp<ViewStyle>} [styleBorder] - Border container style
 * @param {number} [timeOutLoading=6000] - Image loading timeout in ms
 * @param {boolean} [isLoadMoreByApiGG] - Enable Google API lazy loading
 */
function MyIcon ({
  resizeMode = 'contain',
  resizeModeDefault = 'contain',
  color,
  isIcon = false,
  name,
  typeIcon,
  uri,
  uriDefault,
  variant = 'medium',
  isBorderIcon = false,
  timeOutLoading = 6000,
  isLoadMoreByApiGG = false,
  ...props
}) {
  const { styleTheme } = useContext(ThemeContext)

  const getSizeImage = () => {
    let borderInner = 2
    if (props?.styleBorder?.borderWidth) {
      borderInner = props?.styleBorder?.borderWidth * 2
    }
    if (isBorderIcon) {
      return getSizeImgSquare(variant) - borderInner
    }
    return getSizeImgSquare(variant)
  }

  const getSizeBorderImage = () => {
    return getSizeImgSquare(variant)
  }

  const renderIcon = () => {
    return isIcon || name ? (
      <Icon
        {...props}
        name={name}
        Type={typeIcon}
        color={color || styleTheme.color}
        size={getSizeImage()}
      />
    ) : (
      <ImageRender
        {...props}
        isLoadMoreByApiGG={isLoadMoreByApiGG}
        timeOutLoading={timeOutLoading}
        resizeMode={resizeMode}
        resizeModeDefault={resizeModeDefault}
        uri={uri}
        uriDefault={uriDefault}
        style={[
          {
            width: getSizeImage(),
            height: getSizeImage()
          },
          mergeStyle(props?.style)
        ]}
      />
    )
  }

  const renderIconHasBorder = () => {
    return (
      <View
        style={[
          {
            width: getSizeBorderImage(),
            height: getSizeBorderImage(),
            borderColor: Colors.WHITE
          },
          mergeStyle(props?.styleBorder)
        ]}
        className='border rounded-full  overflow-hidden relative'
      >
        {renderIcon()}
      </View>
    )
  }

  if (isBorderIcon) {
    return renderIconHasBorder()
  }

  return renderIcon()
}

export default MyIcon
