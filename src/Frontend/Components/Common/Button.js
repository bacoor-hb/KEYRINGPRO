/* eslint-disable react-native/no-unused-styles */
import React, { useContext } from 'react'
import { TouchableOpacity, StyleSheet, View, Image, Keyboard } from 'react-native'
import { width, Colors, scale, DarkColors, height } from 'common/styles'
import Spinner from './Spinner'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { isLiquidGlassSupported } from '@callstack/liquid-glass'
import GlassView from '../UI/GlassView'
import MyText from '../UI/MyText'

const Button = (props) => {
  const {
    isLoading = false,
    customLoading = null,
    isSub,
    icon,
    onPress,
    label,
    children,
    style,
    iconStyle,
    styleInside,
    textStyle,
    isDisable,
    urlImage,
    styleImage,
    className,
    tintColor,
    disableLiquidGlass = false,
    interactive = true
  } = props
  const { modeTheme } = useContext(ThemeContext)

  const ViewLiquid = ({ children }) => {
    if (isLiquidGlassSupported && !disableLiquidGlass) {
      return (
        <GlassView
          colorScheme='dark'
          tintColor={tintColor || 'transparent'}
          interactive={interactive}
          effect='clear'
          style={[styles.container, isSub && styles[`subBtn${modeTheme}`], isDisable && styles.grayBg, style]}>
          {children}
        </GlassView>
      )
    }
    return (
      <View style={[styles.container, isSub && styles[`subBtn${modeTheme}`], isDisable && styles.grayBg, style]}>
        {children}
      </View>
    )
  }
  return (
    <TouchableOpacity className={className} style={{ alignSelf: 'center' }} onPressIn={Keyboard.dismiss} disabled={isDisable || isLoading} onPress={onPress} activeOpacity={customLoading ? 1 : 0.8}>

      <ViewLiquid>
        {
          isLoading
            ? customLoading || <Spinner size={height(2.7)} type='Wave' color={Colors.TEXT} />
            : (
              children || (
                <View style={[styles.rowBtn, styleInside]}>
                  {
                    icon ? (
                      <View style={[styles.paddingIcon, iconStyle]}>
                        {icon}
                      </View>
                    ) : null
                  }
                  {/* <MyTextTicker
                    style={[styles.label, isSub && styles[`textBlack${modeTheme}`], textStyle]}
                    animationType='scroll'
                    loop
                    marqueeDelay={1000}
                    duration={(label?.length || 1) * 200}
                  >
                    {label}
                  </MyTextTicker> */}
                  <MyText style={[styles.label, isSub && styles[`textBlack${modeTheme}`], textStyle]}>
                    {label}
                  </MyText>
                  {urlImage && <Image source={{ uri: urlImage }} style={styleImage} resizeMode='contain' />}
                </View>
              )
            )
        }
      </ViewLiquid>

    </TouchableOpacity>
  )
}

export default Button

const styles = StyleSheet.create({
  grayBg: {
    opacity: 0.5
    // backgroundColor: Colors.GRAY1
    // backgroundColor: DarkColors.BLUE
  },
  container: {
    // backgroundColor: DarkColors.BLUE,
    // width: width(92),

    // height: heightScale(6.5),
    // borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
    // paddingHorizontal: width(2)
    // borderColor: 'red'
  },
  textBlackLightmode: {
    // color: Colors.TEXT
  },
  textBlackDarkmode: {
    // color: DarkColors.WHITE
  },
  subBtnLightmode: {
    borderWidth: scale(1),
    borderColor: Colors.GRAY2,
    backgroundColor: Colors.WHITE
  },
  subBtnDarkmode: {
    borderWidth: scale(1),
    borderColor: DarkColors.GRAY4,
    backgroundColor: 'transparent'
  },
  paddingIcon: {
    marginRight: width(2.5)
  },
  rowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  },
  label: {
    // fontSize: width(4),
    color: 'white',
    textAlign: 'center'
  }
})
