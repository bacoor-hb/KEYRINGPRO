import { View, TouchableOpacity } from 'react-native'
import React from 'react'
import { getHeightHeader, getSafeAreaValues, pixelByWidth, width } from 'common/styles'
import images from 'assets/Image'
import MyIcon from 'frontend/Components/UI/MyIcon'
import ReduxService from 'common/redux'
import { handleOpenUrl, isHideMenuForAppleReview } from 'common/function'
import MyBgBlur from 'frontend/Components/UI/MyBlur'
import NotificationBell from 'frontend/Components/Notification/NotificationBell'

const Header = ({ func }) => {
  const isHideReview = isHideMenuForAppleReview()

  const onOpenOfficalSite = () => {
    const url = ReduxService.getSettingOther('keyring_offical_site')
    handleOpenUrl(!isHideReview && url)
  }
  return (
    <View
      style={{
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1
      }}>
      <View
        style={{
          position: 'relative',
          width: '100%'

        }}>
        <MyBgBlur height={getHeightHeader(true)} />
        <View
          style={{
            position: 'relative',
            zIndex: 2,
            width: width(100),
            paddingTop: getSafeAreaValues().top,
            height: getHeightHeader(true),
            justifyContent: 'space-between',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: pixelByWidth(16)
          }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center'
            }}
            disabled
            onPress={onOpenOfficalSite}>
            <MyIcon style={{ width: 203, height: 32 }} variant='title' resizeMode='contain' uri={images.UIV2.logoAppHasText} />
          </TouchableOpacity>
          <NotificationBell func={func} />
        </View>
      </View>

    </View>
  )
}

export default Header
