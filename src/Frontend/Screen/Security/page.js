import React, { useEffect, useState } from 'react'
import I18n from 'assets/Lang'
import { ScrollView, View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import createStyles from './styles'
import GlassView from 'frontend/Components/UI/GlassView'
import { getSizeStyle } from 'frontend/Components/UI/GlassView/sizeStyle'
import { pixelByHeight, pixelByWidth, width } from 'common/styles'
import MySwitch from 'frontend/Components/UI/MySwitch'
import MySelectDropdown from 'frontend/Components/UI/MySelectDropdown'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import MyRowItem from 'frontend/Components/UI/MyRowItem'

const SecurityPage = (_this) => {
  const { func, state, props } = _this
  const {
    handleMenuChangePassword,
    handleMenuSetPassword = () => { },
    handleAutoLock = () => { },
    handleToggleDeviceAuth = async () => true
  } = func
  const styles = createStyles()
  const autoLockMinutes = props?.autoLockMinutesRedux ?? 10
  // No vault password yet (e.g. upgrade from a build without a passcode):
  // only offer "Set password" — auto-lock / device auth need a password first.
  const isPasswordSet = state?.isPasswordSet

  const [isDeviceAuthOn, setIsDeviceAuthOn] = useState(false)

  useEffect(() => {
    if (state?.isTurnFaceId !== undefined) setIsDeviceAuthOn(!!state.isTurnFaceId)
  }, [state?.isTurnFaceId])

  const onToggleDeviceAuth = async (next) => {
    setIsDeviceAuthOn(next)
    const ok = await handleToggleDeviceAuth(next)
    if (!ok) setIsDeviceAuthOn(!next)
  }

  const timeAutoLock = [
    {
      title: I18n.t('v2.security.lockImmediately'),
      value: 0
    },
    {
      title: I18n.t('v2.security.lock10min'),
      value: 10
    },
    {
      title: I18n.t('v2.security.lock30min'),
      value: 30
    },
    {
      title: I18n.t('v2.security.lock1hour'),
      value: 60
    },
    {
      title: I18n.t('v2.security.lock12hour'),
      value: 12 * 60
    },
    {
      title: I18n.t('v2.security.lock24hour'),
      value: 24 * 60
    },
    {
      title: I18n.t('v2.security.lockNever'),
      value: -1
    }
  ]

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <ScrollView>
        <TitleScreen
          title={I18n.t('SecurityScreen.security')}
        />

        <View>
          {!isPasswordSet ? (
            <MyRowItem
              lefIcon={(
                <View style={styles.containerLeftItem}>
                  <MyIcon uri={images.UIV2.icons.password} />
                </View>
              )}
              onPress={handleMenuSetPassword}
            >
              <View className='flex flex-row items-center justify-between'>
                <MyText className='text-medium font-normal'>{I18n.t('v2.password.setPassword')}</MyText>
                <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' />
              </View>
            </MyRowItem>
          ) : (
            <>
              <MyRowItem
                lefIcon={(
                  <View style={styles.containerLeftItem}>
                    <MyIcon uri={images.UIV2.icons.password} />
                  </View>
                )}
                onPress={handleMenuChangePassword}
              >
                <View className='flex flex-row items-center justify-between'>
                  <MyText className='text-medium font-normal'>{I18n.t('NFC.changePass')}</MyText>
                  <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' />
                </View>
              </MyRowItem>

              <MySelectDropdown
                key='custom-render'
                data={timeAutoLock}
                onSelect={(item) => handleAutoLock(item?.value)}
                renderItem={(item, index) => {
                  const isLastItem = index === timeAutoLock.length - 1
                  return (
                    <MyActionRow
                      isSelectDropdown
                      title={item.title}
                      noBorder={isLastItem}
                    />
                  )
                }}
              >
                {
                  (_selectedItem, isVisible) => (
                    <View>
                      <MyRowItem
                        lefIcon={(
                          <View style={styles.containerLeftItem}>
                            <MyIcon uri={images.UIV2.security.autoLock} />
                          </View>
                        )}
                      >
                        <View className='flex flex-row justify-between items-center'>
                          <MyText className='text-medium font-normal'>{I18n.t('v2.security.autoLock')}</MyText>
                          <View className='absolute right-0  h-full items-end justify-center '>
                            <GlassView
                              variant='default'
                              style={[getSizeStyle(), { width: 'auto', maxWidth: width(50), height: pixelByHeight(28), alignItems: 'center', justifyContent: 'center' }]}
                            >
                              <View style={{ gap: pixelByWidth(4) }} className='flex-row items-center'>
                                <MyText className='text-sm mr-1'>
                                  {timeAutoLock.find(item => item.value === autoLockMinutes)?.title || 'After 10 minutes'}
                                </MyText>
                                <MyIcon uri={isVisible ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand} variant='small' />
                              </View>
                            </GlassView>
                          </View>

                        </View>
                      </MyRowItem>
                    </View>

                  )
                }

              </MySelectDropdown>

              <MyRowItem
                lefIcon={(
                  <View style={styles.containerLeftItem}>
                    <MyIcon uri={images.UIV2.security.deviceAuthen} />
                  </View>
                )}
                onPress={handleMenuChangePassword}
              >
                <View className='flex flex-row items-center justify-between'>
                  <MyText className='text-medium font-normal'>{I18n.t('v2.security.deviceAuth')}</MyText>
                  <View className='absolute right-0  h-full items-end justify-center '>
                    <MySwitch
                      value={isDeviceAuthOn}
                      onValueChange={onToggleDeviceAuth}
                    />
                  </View>
                </View>
              </MyRowItem>
            </>
          )}

        </View>
      </ScrollView>
    </MyViewPage>
  )
}

export default SecurityPage
