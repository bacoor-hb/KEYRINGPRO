import React from 'react'
import { View, Image, ScrollView } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { pixelByHeight, pixelByWidth, width, getSafeAreaValues } from 'common/styles'
import { APP_VERSION } from 'common/constants/app'
import { handleOpenUrl } from 'common/function'
import ReduxService from 'common/redux'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import useComponentHeights from 'frontend/Hooks/useComponentHeights'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import I18nWithLinks from 'frontend/Components/UI/I18nWithLinks'

export default function Template (p) {
  const { handleCreateWallet, handleRestoreFromFile, handleRestoreWallet } = p.func
  const { isModalOpen } = p.state

  const { onLayoutHeaderAnchor } = useComponentHeights()

  const handleHeaderAnchorLayout = (e) => {
    onLayoutHeaderAnchor(e)
    ReduxService.refLayoutHeaderAnchor.current = {
      ...ReduxService.refLayoutHeaderAnchor.current,
      height: e.nativeEvent.layout.height + pixelByHeight(42)
    }
  }

  return (
    <ThemeContext.Consumer>{(context) => {
      return (
        <MyViewPage isSetHeightLayout style={styles.container}>
          <View
            ref={(r) => { p.func.refHeaderAnchorView = r }}
            style={styles.headerArea}
            onLayout={handleHeaderAnchorLayout}
          >
            <ImageRender
              style={{ width: width(55), height: width(55) * (61 / 257) }}
              resizeMode='contain'
              uri={images.UIV2.keyringProText} />
          </View>
          <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <View style={styles.midView}>
              <Image source={images[`appLaunch${context.modeTheme}`]} style={styles.imgLaunch} />
              <View style={{ flex: 1, width: '100%' }}>
                <ScrollView
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                  // Expand the ScrollView frame on both sides (negative margin) and
                  // offset it back with contentContainer padding: buttons keep their
                  // position while the clip boundary moves outside the button edges,
                  // so the liquid glass press effect isn't cut off. flexGrow:1 keeps
                  // it scrollable on very short screens.
                  style={{ marginHorizontal: -pixelByWidth(8) }}
                  contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: pixelByWidth(8)
                  }}>
                  <View className='gap-4 w-full'>
                    <MyButton
                      size='medium'
                      className='w-full'
                      onPress={handleCreateWallet}
                      isDisable={isModalOpen}
                      label={I18n.t('v2.welcome.createNewWallet')}
                    />
                    <MyButton
                      size='medium'
                      className='w-full'
                      onPress={handleRestoreWallet}
                      isDisable={isModalOpen}
                      label={I18n.t('Initial.importPrivate')}
                    />
                    <MyButton
                      size='medium'
                      className='w-full'
                      onPress={handleRestoreFromFile}
                      isDisable={isModalOpen}
                      label={I18n.t('v2.welcome.restoreBackupFile')}
                    />

                  </View>
                </ScrollView>
              </View>

            </View>
            <View
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                paddingBottom: pixelByHeight(4)
              }}>
              <I18nWithLinks
                variant='small'
                text={I18n.t('v2.common.agreeDescription')}
                links={{
                  privacyPolicy: { label: I18n.t('v2.common.privacyPolicy'), onPress: () => handleOpenUrl(ReduxService.getSettingOther('keyring_url_policy')) },
                  termsOfUse: { label: I18n.t('v2.common.termsOfUse'), onPress: () => handleOpenUrl(ReduxService.getSettingOther('keyring_url_terms_of_service')) }
                }}
              />
            </View>
            <View style={{ paddingBottom: getSafeAreaValues().bottom }}>
              <MyText variant='small' className='text-low'>
                {I18n.t('Initial.version', { name: APP_VERSION })}
              </MyText>
            </View>
          </View>
        </MyViewPage>
      )
    }}
    </ThemeContext.Consumer>
  )
}
