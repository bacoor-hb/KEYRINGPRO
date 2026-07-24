import React from 'react'
import { View } from 'react-native'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyText from 'frontend/Components/UI/MyText'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import { pixelByHeight, pixelByWidth } from 'common/styles'
import I18n from 'assets/Lang'
import createStyles from './styles'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import images from 'assets/Image'
import { NAME_SCREEN } from 'common/constants/navigation'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import { APP_VERSION } from 'common/constants/app'

const SettingPage = (_this) => {
  const { func } = _this
  const { handleMenu } = func
  const styles = createStyles()

  const sections = [
    [
      {
        keyScreen: NAME_SCREEN.customRPC,
        icon: images.UIV2.icons.settings.customRPC,
        title: I18n.t('v2.customRpc.title')
        // isDisable: true
      },
      {
        keyScreen: NAME_SCREEN.changeLanguage,
        icon: images.UIV2.icons.settings.language,
        title: I18n.t('MenuScreen.ChangeLanguageScreen.titleHeader')
        // rightContent: upperCase(localeRedux)
      },
      {
        keyScreen: NAME_SCREEN.regionalCurrency,
        icon: images.UIV2.icons.settings.currency,
        title: I18n.t('RegionalCurrencyScreen.titleHeader')
        // rightContent: currencyRedux
      },
      {
        keyScreen: NAME_SCREEN.information,
        icon: images.UIV2.icons.settings.information,
        title: I18n.t('MenuScreen.InformationScreen.titleHeader'),
        noBorder: true
      }
    ],
    [
      {
        keyScreen: NAME_SCREEN.resetWallet,
        icon: images.UIV2.icons.settings.reset,
        title: I18n.t('ResetWarningScreen.resetWallet'),
        noBorder: true
      }
    ]
  ]

  const handleRoutePage = (keyScreen) => {
    handleMenu(keyScreen)
  }

  const ItemOption = ({ rightContent, ...props }) => {
    return (
      <MyActionRow
        containerStyle={{ opacity: props.isDisable ? 0.5 : 1 }}
        onPress={() => props.isDisable ? null : handleRoutePage(props.keyScreen)}
        rightElement={(
          <View
            style={{
              display: 'flex',
              gap: pixelByWidth(12),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <MyText>
              {rightContent}
            </MyText>
            <View style={[styles.iconArrow]}>
              <MyIcon
                variant='small'
                uri={images.UIV2.icons.arrowRightLow}
              />
            </View>
          </View>
        )}
        {...props}
      />
    )
  }

  const renderItem = (item, index) => {
    return (
      <ItemOption
        {...item}
        rightContent={item.rightContent}
        noBorder={item.noBorder}
        key={`render-item-${index}`}
        title={item.title}
        icon={item.icon}
        iconConfig={{ style: { alignItems: 'flex-end' } }}
      />
    )
  }

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <ScrollViewBlurHeader>
        <TitleScreen
          title={I18n.t('MenuScreen.AboutMenu.settings')}
        />

        <View
          style={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((section, sectionIndex) => (
            <MyLinearGradient key={`section-${sectionIndex}`}>
              {/* <View style={{ paddingHorizontal: pixelByWidth(12), gap: pixelByHeight(12) }}> */}
              <View style={{ paddingRight: pixelByWidth(12), gap: pixelByHeight(0) }}>
                {section.map((item, itemIndex) => renderItem(item, itemIndex))}

              </View>
            </MyLinearGradient>

          ))}
        </View>
      </ScrollViewBlurHeader>
      <MyText variant='small' className='text-low text-center'>
        Version {APP_VERSION}
      </MyText>
    </MyViewPage>
  )
}

export default SettingPage
