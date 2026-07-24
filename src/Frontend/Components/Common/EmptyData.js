/* eslint-disable react-native/no-unused-styles */
import React, { useContext } from 'react'
import { View, StyleSheet, Text } from 'react-native'
import { width, height, Colors, DarkColors } from 'common/styles'
import images from 'assets/Image'
import LottieView from 'lottie-react-native'
import I18n from 'assets/Lang'
import { ImageRender } from './ImageRender'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'

const Emptydata = ({ label = I18n.t('Initial.noData'), stylesLottie, moreView, labelLoading = I18n.t('Initial.onLoading'), style, image, isLoading, styleLabel }) => {
  const { modeTheme } = useContext(ThemeContext)
  return (
    <View style={[styles.fullView, style]}>
      {
        isLoading ? (
          <LottieView style={[styles.imgLottie, stylesLottie]} source={images.keyringLoadingV2} autoPlay loop />
        ) : (
          image || <ImageRender uriDefault={images.keyringLogo2} uri={images.keyringLogo2} style={styles.imgEmpty} resizeMode='contain' />
        )
      }
      {
        isLoading
          ? null
          : <Text style={[styles[`loadingText${modeTheme}`], styleLabel]}>{isLoading ? labelLoading : label}</Text>
      }
      {
        moreView
      }
    </View>
  )
}

export default Emptydata

const styles = StyleSheet.create({
  imgEmpty: {
    opacity: 0.7,
    marginBottom: height(2.5),
    height: height(8),
    width: width(18),
    resizeMode: 'contain'
  },
  imgLottie: {
    height: height(5),
    width: width(35)
  },
  loadingTextLightmode: {
    width: '100%',
    paddingHorizontal: width(4),
    textAlign: 'center',
    // fontSize: width(6.5),
    color: Colors.GRAY1
  },
  loadingTextDarkmode: {
    width: '100%',
    paddingHorizontal: width(4),
    textAlign: 'center',
    // fontSize: width(4.5),
    color: DarkColors.TEXT2
  },
  fullView: {
    height: height(65),
    width: width(100),
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center'
  }
})
