import { View, TouchableOpacity } from 'react-native'
import React from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import createStyles from './styles'
import { pixelByHeight, pixelByWidth, width } from 'common/styles'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { handleOpenUrl, isHideMenuForAppleReview, jsonStr2Obj } from 'common/function'
import ReduxService from 'common/redux'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import { cn } from 'common/tailwind'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

const Information = () => {
  const sns = ReduxService.getSettingOther('keyring_sns')

  const styles = createStyles()

  const handleExplorer = (type = 'termsOfService') => {
    if (type === 'termsOfService') {
      const url = ReduxService.getSettingOther('keyring_url_terms_of_service')
      handleOpenUrl(url)
      return
    }
    if (type === 'privacyPolicy') {
      const url = ReduxService.getSettingOther('keyring_url_policy')
      handleOpenUrl(url)
      return
    }

    if (type === 'helpCenter') {
      const url = ReduxService.getSettingOther('keyring_help_center')
      handleOpenUrl(url)
      return
    }

    if (type === 'twitter') {
      const snsArr = jsonStr2Obj(sns)
      const url = snsArr[0].url
      handleOpenUrl(url)
    }

    if (type === 'github_open_source') {
      handleOpenUrl('https://github.com/bacoor-hb/KEYRINGPRO')
    }
  }

  const getInfoDetailKeyring = () => {
    const data = {
      des1: I18n.t('v2.info.des1'),
      des2: I18n.t('v2.info.des2'),
      des3: I18n.t('v2.info.des3'),
      des4: I18n.t('v2.info.des4'),
      des5: I18n.t('v2.info.des5'),
      des6: I18n.t('v2.info.des6')
    }
    return Object.values(data)
  }

  const renderData = () => {
    const data = [
      {
        title: I18n.t('v2.info.privacyPolicy'),
        onPress: () => handleExplorer('privacyPolicy')
      },
      {
        title: I18n.t('v2.info.termsOfService'),
        onPress: () => handleExplorer('termsOfService')
      },
      {
        title: I18n.t('v2.info.helpCenter'),
        onPress: () => handleExplorer('helpCenter')
      },
      isHideMenuForAppleReview()
        ? null
        : (
          {
            title: 'Twitter',
            leftIcon: images.UIV2.icons.settings.twitter,
            onPress: () => handleExplorer('twitter')
          }
        ),
      {
        title: I18n.t('v2.info.githubOpenSource'),
        leftIcon: images.UIV2.icons.settings.github,
        onPress: () => handleExplorer('github_open_source')
      },
      {
        title: (
          <View
            style={{
              gap: pixelByHeight(14),
              width: width(100) - pixelByWidth(30)
            }}
            className='flex flex-col'>
            <MyText fontWeight={700}>KEYRING PRO</MyText>
            {
              getInfoDetailKeyring().map((item, index) => {
                return (
                  <MyText
                    key={`text-${index}`}
                    className='text-low '>
                    {item}
                  </MyText>
                )
              })
            }
          </View>
        )
      },
      {
        title: 'January 1st 2021',
        titleClassName: 'text-low',
        noBorder: true
      }
    ]

    return data.filter(item => item !== null).map((item, index) => {
      const content = typeof item.title === 'string' ? (
        <MyText className={cn('text-medium', item?.titleClassName)}>
          {item.title}
        </MyText>
      ) : (
        item.title
      )

      return (
        <MyRowItem
          noBorder={item?.noBorder}
          key={index}
          onPress={item?.onPress ? item.onPress : undefined}
        >
          {
            item?.leftIcon ? (
              <View
                style={{ gap: pixelByWidth(8) }}
                className='flex flex-row items-center'>
                <MyIcon variant='small' uri={item.leftIcon} />
                {content}
              </View>
            ) : (
              content
            )
          }
        </MyRowItem>
      )
    })
  }
  return (
    <MyViewPage isUseDrawer style={styles.container}>
      <TitleDrawer absolute hasBlur title={I18n.t('MenuScreen.InformationScreen.titleHeader')} leftIcon={images.UIV2.icons.settings.information} />
      <View style={{ height: pixelByHeight(8) }} />
      <ScrollViewBlurHeader isUseDrawer contentContainerStyle={styles.contentContainer} showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false}>
        <View>
          {renderData()}
        </View>
        <MyText className='text-low'>
          BACOOR Inc.
        </MyText>
        <TouchableOpacity activeOpacity={1} onPress={() => handleOpenUrl('https://www.bacoor.io')}>
          <MyText className='text-brand'>
            https://www.bacoor.io
          </MyText>
        </TouchableOpacity>
        <View style={{ height: pixelByHeight(24) }} />

      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default Information
