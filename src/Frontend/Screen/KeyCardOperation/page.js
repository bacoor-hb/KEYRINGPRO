import React from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import styles from './styles'
import { width } from 'common/styles'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image/index'
import Carousel, { Pagination } from 'react-native-snap-carousel'
import { handleOpenUrl, isHideMenuForAppleReview } from 'common/function'
import LottieView from 'lottie-react-native'
import ReduxService from 'common/redux'

export default function Template (p) {
  const {
    onHandleShowPrivateKey,
    onEraseNFCCard,
    openNFCKeyCardPopUp,
    onHandleLockCardNfc
  } = p.func

  const {
    isAutoPlayBanner
  } = p.state

  const learnMoreLink = ReduxService.getSettingOther('nfc-keycard-learn-more-link')
  const isInReview = isHideMenuForAppleReview()

  const bannerKeycard = [
    {
      image: images.keyCardBanner1,
      title: I18n.t('NFC.introBanner1')
    },
    {
      image: images.keyCardBanner2,
      title: I18n.t('NFC.introBanner2')
    },
    {
      image: images.keyCardBanner3,
      title: I18n.t('NFC.introBanner3')
    },
    {
      image: images.keyCardBanner4,
      title: I18n.t('NFC.introBanner4')
    }
  ]

  const renderItemBanner = ({ item }) => {
    return (
      <ThemeContext.Consumer>{(context) => {
        return (
          <View style={styles.BannerBox}>
            <LottieView
              style={styles.LottieView}
              resizeMode='contain'
              source={item.image}
              autoPlay={isAutoPlayBanner}
              loop
            />
            <Text style={[styles.bannerTitle, { color: context.styleTheme.color }]}>{item.title}</Text>
          </View>
        )
      }}
      </ThemeContext.Consumer>
    )
  }

  const pagination = () => {
    const { activeSlide } = p.state
    return (
      <ThemeContext.Consumer>{(context) => {
        return (
          <Pagination
            dotsLength={4}
            activeDotIndex={activeSlide}
            containerStyle={styles.PaginationDot}
            dotStyle={styles[`dotStyle${context.modeTheme}`]}
            inactiveDotStyle={styles[`inactiveDotStyle${context.modeTheme}`]}
            inactiveDotOpacity={0.4}
            inactiveDotScale={0.6}
          />
        )
      }}
      </ThemeContext.Consumer>
    )
  }

  return (
    <ThemeContext.Consumer>{(context) => {
      return (
        <ScrollView>
          <View style={styles.introContainer}>
            <TouchableOpacity disabled={!learnMoreLink} activeOpacity={1} style={styles[`learnMoreBox${context.modeTheme}`]} onPress={!isInReview ? () => handleOpenUrl(learnMoreLink) : null}>
              <Text style={[styles.contentTitle, { color: context.styleTheme.color }]}>{I18n.t('NFC.whatIsNFC')}</Text>
              {
                !isInReview && (
                  <Text style={styles[`learnMoretxt${context.modeTheme}`]}>{I18n.t('NFC.learnMore')}</Text>
                )
              }
            </TouchableOpacity>

            <View style={styles.bannerKeycard}>
              <Carousel
                onSnapToItem={(index) => p.func.setState({ activeSlide: index })}
                data={bannerKeycard}
                renderItem={renderItemBanner}
                sliderWidth={width(100)}
                itemWidth={width(100)}
                pagingEnabled
                loop
              />
            </View>
            {pagination()}
            <TouchableOpacity activeOpacity={1} style={[styles[`coinBox${context.modeTheme}`], { marginTop: 0 }]} onPress={onHandleShowPrivateKey}>
              <View style={styles.icon}>
                <ImageRender resizeMode='contain' uri={images.showPrivateKeyNfcIcon} style={styles.iconImage} />
              </View>
              <View style={styles.content}>
                <Text style={[styles.contentTitle, { color: context.styleTheme.color }]}>{I18n.t('NFC.showPrivateKey')}</Text>
                <Text style={[styles[`contentSubTitle${context.modeTheme}`]]}>{I18n.t('NFC.displayPrivateKeyNFC')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={1} style={[styles[`coinBox${context.modeTheme}`]]} onPress={openNFCKeyCardPopUp}>
              <View style={styles.icon}>
                <ImageRender resizeMode='contain' uri={images.copyNfcIcon} style={styles.iconImage} />
              </View>
              <View style={styles.content}>
                <Text style={[styles.contentTitle, { color: context.styleTheme.color }]}>{I18n.t('NFC.copyCard')}</Text>
                <Text style={[styles[`contentSubTitle${context.modeTheme}`]]}>{I18n.t('NFC.storeDataToOtherNFC')}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={1} style={styles[`coinBox${context.modeTheme}`]} onPress={onEraseNFCCard}>
              <View style={styles.icon}>
                <ImageRender resizeMode='contain' uri={images.eraseNfcIcon} style={styles.iconImage} />
              </View>
              <View style={styles.content}>
                <Text style={[styles.contentTitle, { color: context.styleTheme.color }]}>{I18n.t('NFC.eraseNFCKeycard')}</Text>
                <Text style={[styles[`contentSubTitle${context.modeTheme}`]]}>{I18n.t('NFC.eraseAllInfoInNFC')}</Text>
              </View>
            </TouchableOpacity>
            {
              !isInReview && (
                <TouchableOpacity activeOpacity={1} style={styles[`coinBox${context.modeTheme}`]} onPress={onHandleLockCardNfc}>
                  <View style={styles.icon}>
                    <ImageRender resizeMode='contain' uri={images.lockKeycard} style={styles.iconImage} />
                  </View>
                  <View style={styles.content}>
                    <Text style={[styles.contentTitle, { color: context.styleTheme.color }]}>{I18n.t('NFC.keyCardDeCard')}</Text>
                    <Text style={[styles[`contentSubTitle${context.modeTheme}`]]}>{I18n.t('NFC.lockAndProtectNfcTag')}</Text>
                  </View>
                </TouchableOpacity>
              )
            }
          </View>
        </ScrollView>
      )
    }}
    </ThemeContext.Consumer>
  )
}
