import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import MyIcon from '../MyIcon'
import { Colors, getHeightHeaderDrawer, getSizeImgSquare, pixelByWidth } from 'common/styles'
import { cn, mergeStyle } from 'common/tailwind'
import MyBgBlur from '../MyBlur'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 2,
    gap: pixelByWidth(12),
    paddingBottom: 10,
    paddingTop: 16,
    height: getHeightHeaderDrawer(false)
  }
})

/**
 * @param {React.ReactNode} title - Drawer title content
 * @param {React.ReactNode} [leftIcon] - Left icon or avatar
 * @param {PropsView} [leftConfig] - Config for left icon wrapper
 * @param {React.ReactNode} [rightElement] - Right-side action element
 * @param {PropsView} [containerConfig] - Config for the header container
 * @param {boolean} [absolute] - Position the header absolutely
 * @param {boolean} [hasBlur] - Show background blur behind header
 * @param {string} [titleColor] - Override title text color
 * @param {boolean} [isLoadMoreByApiGG] - Enable Google API lazy loading
 */
const TitleDrawer = ({ isLoadMoreByApiGG = false, absolute = false, hasBlur = false, title, containerConfig, leftIcon, leftConfig, rightElement, titleColor }) => {
  const [heightLayout, setHeightLayout] = useState(0)
  // Width of the title slot. TextTicker only re-measures on content-size change,
  // not when its container shrinks — so when the rightElement (e.g. Register
  // button) appears and narrows this slot, the marquee wouldn't start on its own.
  // We key MyTextTicker by this width: it changes only when the slot resizes
  // (button shows/hides), remounting the ticker so it re-measures and scrolls.
  // Typing in the input doesn't change the slot width, so the memo still holds
  // and the marquee is never reset.
  const [titleWidth, setTitleWidth] = useState(0)
  const renderContent = () => {
    return (
      <View style={{ position: 'relative', overflow: hasBlur ? 'hidden' : 'visible' }}>
        {
          hasBlur && (
            <MyBgBlur
              style={{
                borderTopLeftRadius: 34,
                borderTopRightRadius: 34,
                overflow: 'hidden'
              }}
              fallbackColor={Colors.BG_MAIN_DRAWER}
              height={heightLayout}
            />
          )
        }
        <View
          onLayout={(e) => {
            const { height } = e.nativeEvent.layout
            setHeightLayout(height)
          }}
          {...containerConfig}
          className={cn('flex-row items-center', containerConfig?.className)}
          style={[
            styles.container,
            absolute && {
              paddingHorizontal: pixelByWidth(16)
            },
            mergeStyle(containerConfig?.style)
          ]}
        >

          {leftIcon && (
            (typeof leftIcon === 'string' || typeof leftIcon === 'number') ? (
              <View
                {...leftConfig}
                style={[
                  { width: getSizeImgSquare('large'), height: getSizeImgSquare('large') },
                  mergeStyle(leftConfig?.style)
                ]}
                className={cn('bg-black flex justify-center items-center rounded-full overflow-hidden', leftConfig?.className)}
              >
                <MyIcon isLoadMoreByApiGG={isLoadMoreByApiGG} variant={leftConfig?.variant || 'title'} uri={leftIcon} />
              </View>
            ) : leftIcon

          )}
          {
            typeof title === 'string' ? (
              // minWidth:0 lets this flex child actually shrink so the long,
              // scrolling title never pushes the rightElement off-screen.
              <View
                style={{ minWidth: 0, flex: 1 }}
                onLayout={(e) => {
                  const { width } = e.nativeEvent.layout
                  // Round to avoid remounting on sub-pixel jitter.
                  const rounded = Math.round(width)
                  setTitleWidth((prev) => (prev === rounded ? prev : rounded))
                }}>
                <MyTextTicker
                  key={titleWidth}
                  style={[titleColor ? { color: titleColor } : {}]}
                  fontWeight={700}
                  variant='subTitle'
                  className='relative z-[2]'>
                  {title}
                </MyTextTicker>
              </View>
            ) : (
              title
            )
          }
          {/* flex-shrink:0 keeps the action (e.g. Register button) at full width
              and clickable — never clipped by a long title. */}
          {rightElement && (
            <View style={{ flexShrink: 0 }}>
              {rightElement}
            </View>
          )}
        </View>
      </View>
    )
  }

  const renderAbsolute = () => {
    return (
      <View
        style={{
          position: 'absolute',
          zIndex: 1,
          top: 0,
          left: 0,
          right: 0
        }}>
        {renderContent()}
      </View>
    )
  }

  return absolute ? renderAbsolute() : renderContent()
}

export default TitleDrawer
