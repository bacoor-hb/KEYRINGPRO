import React, { useContext, useRef } from 'react'
import { View } from 'react-native'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'
import MyText from '../MyText'
import images from 'assets/Image'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { MODE_THEME } from 'common/constants/app'
import createStyles from './styles'
import MyIcon from '../MyIcon'
import { cn, mergeStyle } from 'common/tailwind'

/**
 * @param {StyleProp<ViewStyle>} [style] - Style applied to the outer container
 * @param {'success'|'error'|'warning'} [variant] - Visual variant controlling icon and color
 * @param {string} [className] - Tailwind class name applied to the container
 * @param {string} [message] - Body text displayed below the title
 * @param {string} [icon] - Custom icon image URI override
 * @param {string} [title] - Bold heading text
 * @param {MyTextProps} [titleConfig] - Extra props spread onto the title MyText
 * @param {MyTextProps} [messageConfig] - Extra props spread onto the message MyText
 * @param {ConfigProps} [iconConfig] - Extra props spread onto the icon container View
 * @param {boolean} [autoplay] - Whether the Lottie animation plays on mount
 */
const StatusMessage = ({ style, contentStyle = {}, variant = 'success', className = '', message, icon, title, titleConfig, messageConfig, iconConfig, autoplay = true }) => {
  const { modeTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode)
  const lottieRef = useRef(null)

  // When not autoplaying (a result restored from history), jump straight to the
  // final frame once loaded so the completed icon shows without replaying —
  // autoplay=false alone would leave it parked on the empty first frame.
  const handleLottieLoad = async () => {
    if (autoplay) return
    try {
      const total = await lottieRef.current?.totalFrames?.()
      if (total > 0) lottieRef.current?.setFrame?.(total - 1)
    } catch (_) { /* best-effort: fall back to first frame */ }
  }

  // PNG fallback (custom icon override, or variants without a Lottie animation).
  const getIcon = () => {
    if (icon) {
      return icon
    }
    switch (variant) {
      case 'error':
        return images.UIV2.icons.failed
      case 'warning':
        return images.UIV2.icons.warning
      default:
        return images.UIV2.icons.success
    }
  }

  // Lottie animation matching the variant; null → fall back to the PNG MyIcon above.
  const getLottieSource = () => {
    if (icon) return null
    switch (variant) {
      case 'success':
        return images.txSuccessAnimLottie
      case 'error':
        return images.txFailAnimLottie
      case 'warning':
        return null
      default:
        return images.txSuccessAnimLottie
    }
  }

  const lottieSource = getLottieSource()

  return (
    <View style={[styles.container, mergeStyle(style)]} className={className}>
      <View {...iconConfig} style={[styles.iconContainer, mergeStyle(iconConfig?.style)]}>
        {lottieSource ? (
          <DotLottie
            ref={lottieRef}
            source={lottieSource}
            style={styles.iconLottie}
            onLoad={handleLottieLoad}
            // DotLottie aligns via `layout`, not resizeMode. Without it, native
            // falls back to align [0,0] (top-left); [0.5, 0.5] re-centers the
            // animation to match the previous lottie-react-native behavior.
            layout={{ fit: 'contain', align: [0.5, 0.5] }}
            autoplay={autoplay}
            loop={false}
          />
        ) : (
          <MyIcon
            uri={getIcon()}
            variant='large'
          />
        )}
      </View>
      <View style={[styles.content, mergeStyle(contentStyle)]}>
        {title && (
          <MyText fontWeight={700} {...titleConfig} className={cn(`${titleConfig?.className}`)}>
            {title}
          </MyText>
        )}
        {message && (
          <MyText {...messageConfig} className={cn('text-wrap text-medium', messageConfig?.className)}>
            {message}
          </MyText>
        )}
      </View>
    </View>
  )
}

export default StatusMessage
