import { View } from 'react-native'
import React from 'react'
import { Colors, getHeightHeader, width as widthScreen } from 'common/styles'
import { LinearGradient } from 'react-native-svg'
import { ProgressiveBlurView } from '@sbaiahmed1/react-native-blur'
import { mergeStyle } from 'common/tailwind'
// const SCRIM_COLORS = [`${Colors.BLACK}00`, `${Colors.BLACK}CC`, `${Colors.BLACK}CC`]
const SCRIM_COLORS = ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.3)', 'transparent']
const heightDefault = getHeightHeader(true)
const widthDefault = widthScreen(100)

// const SCRIM_FADE = pixelByHeight(40)
// const SCRIM_LOCATIONS = [0, SCRIM_FADE / (SCRIM_FADE + getHeightHeader()), 0.8, 1]

const MyBgBlur = ({ styleBlur, style, defaultColor = 'transparent', fallbackColor = Colors.BLACK, zIndex = 1, bgLinearColor = true, height = heightDefault, width = widthDefault }) => {
  const SCRIM_FADE = height / 2
  const SCRIM_LOCATIONS = [0, SCRIM_FADE / (SCRIM_FADE + height), 0.8, 1]

  return (
    <View
      style={[
        {
          position: 'absolute',
          width: width,
          height: height,
          top: 0,
          left: 0,
          // overflow: 'hidden',
          zIndex: zIndex
          // backgroundColor: 'rgba(200,200,200,0.3)'

        },
        mergeStyle(style)
      ]}>
      <View
        style={[
          {
            height: height,
            width: width,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1,
            overflow: 'hidden'
            // borderRadius: 32
            // backgroundColor: 'green'
          },
          mergeStyle(styleBlur)
        ]}
      >
        {
          ISIOS ? (
            <ProgressiveBlurView
              blurType='dark'
              blurAmount={2}
              overlayColor={defaultColor}
              direction='blurredTopClearBottom'
              reducedTransparencyFallbackColor={fallbackColor}
              style={[{
                height: height * 1.4

              }]}
            />
          ) : (
            <View style={{ width: width, height: '100%', backgroundColor: fallbackColor }} />
          )
        }

      </View>
      {
        bgLinearColor && (
          <LinearGradient
            colors={SCRIM_COLORS}
            locations={SCRIM_LOCATIONS}
            style={{
              width: width,
              height: height,
              // --- iOS shadow ---
              shadowColor: 'rgba(0,0,0,0.5)',
              shadowOffset: { width: 0, height: 2 },
              // shadowOpacity: 1,
              shadowRadius: 3.84,

              // --- Android shadow ---
              elevation: 5
            }}
          />
        )
      }

    </View>
  )
}

export default MyBgBlur
