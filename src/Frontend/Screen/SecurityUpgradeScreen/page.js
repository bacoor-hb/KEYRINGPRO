import React from 'react'
import { View, Image, ScrollView } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { width, pixelByHeight } from 'common/styles'
import { APP_VERSION } from 'common/constants/app'
import { handleOpenUrl } from 'common/function'
import ReduxService from 'common/redux'
import MyText from 'frontend/Components/UI/MyText'
import I18nWithLinks from 'frontend/Components/UI/I18nWithLinks'
import MyButton from 'frontend/Components/UI/MyButton'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import useComponentHeights from 'frontend/Hooks/useComponentHeights'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import AppLockedOverlay from 'frontend/Components/AppLockedOverlay'

export default function Template (p) {
  const {
    handleUsePasscode,
    handleSetNewPassword
  } = p.func
  const { isLocked } = p.state

  const { onLayoutHeaderAnchor } = useComponentHeights()

  const handleHeaderAnchorLayout = (e) => {
    onLayoutHeaderAnchor(e)
    // Anchor modal offset pixelByHeight(24) below the headerArea bottom
    ReduxService.refLayoutHeaderAnchor.current = {
      ...ReduxService.refLayoutHeaderAnchor.current,
      height: e.nativeEvent.layout.height + pixelByHeight(42)
    }
  }

  return (
    <>
      <MyViewPage isSetHeightLayout style={styles.container}>
        <View
          ref={(r) => { p.func.refHeaderAnchorView = r }}
          style={styles.headerArea}
          onLayout={handleHeaderAnchorLayout}
        >
          <ImageRender
            style={{ width: width(55), height: width(55) * (61 / 257) }}
            resizeMode='contain'
            uri={images.UIV2.keyringProText}
          />
        </View>
        <View style={styles.body}>
          <Image source={images.appLaunchDarkmode} style={styles.imgLaunch} />
          <View style={styles.content}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollClipFix}
              contentContainerStyle={styles.scrollContent}
            >
              <MyText className='text-medium' style={styles.introText}>
                Your current passcode can now be used as your password for the new app version.{'\n'}
                {I18n.t('v2.password.useExistingOrNew')}
              </MyText>
              <View style={styles.buttonGroup}>
                <MyButton
                  className='w-full'
                  variant='default'
                  label={I18n.t('v2.password.usePasscode')}
                  onPress={handleUsePasscode}
                />
                <MyButton
                  className='w-full'
                  variant='default'
                  label={I18n.t('v2.password.setNewPassword')}
                  onPress={handleSetNewPassword}
                />
              </View>
            </ScrollView>
          </View>
          <View style={styles.footer}>
            <I18nWithLinks
              variant='small'
              text={I18n.t('v2.common.agreeDescription')}
              links={{
                privacyPolicy: { label: I18n.t('v2.common.privacyPolicy'), onPress: () => handleOpenUrl('https://www.keyring.app/privacy-policy') },
                termsOfUse: { label: I18n.t('v2.common.termsOfUse'), onPress: () => handleOpenUrl('https://www.keyring.app/terms-of-use') }
              }}
            />
            <View>
              <MyText variant='small' className='text-low'>
                {I18n.t('Initial.version', { name: APP_VERSION })}
              </MyText>
            </View>
          </View>
        </View>
      </MyViewPage>
      {isLocked && <AppLockedOverlay />}
    </>
  )
}
