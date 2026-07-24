import React, { useEffect, useState } from 'react'
import I18n from 'assets/Lang'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import { Colors, pixelByHeight } from 'common/styles'
import MyButton from 'frontend/Components/UI/MyButton'
import MyText from 'frontend/Components/UI/MyText'
import { View, AppState, Platform } from 'react-native'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
// import RNScreenshotPrevent from 'react-native-screenshot-prevent'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import {
  CaptureProtection
} from 'react-native-capture-protection'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

const ViewPrivateKey = ({ privateKey }) => {
  const [isView, setIsView] = useState(false)
  // isHidden: masks text when app enters background / task-switcher
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    try {
      // Android: FLAG_SECURE → screenshot & screen recording show completely black screen
      if (Platform.OS === 'android') {
        // RNScreenshotPrevent.enabled(true)
      }

      // iOS: place UITextField (isSecureTextEntry=true) as full-screen overlay
      // → iOS automatically blanks all content in screenshots and screen recordings
      if (Platform.OS === 'ios') {
        // RNScreenshotPrevent.enableSecureView()
      }

      // Hide text on task-switcher / background (both platforms)
    } catch (error) {

    }
    CaptureProtection.prevent({
      record: {
        backgroundColor: Colors.BLACK
      },
      appSwitcher: {
        backgroundColor: Colors.BLACK
      },
      screenshot: true
    })

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'inactive' || nextState === 'background') {
        setIsHidden(true)
      } else if (nextState === 'active') {
        setIsHidden(false)
      }
    })

    return () => {
      try {
        // if (Platform.OS === 'android') {
        //   RNScreenshotPrevent.enabled(false)
        // }
        // if (Platform.OS === 'ios') {
        //   RNScreenshotPrevent.disableSecureView()
        // }

      } catch (error) {

      }
      CaptureProtection.allow({
        appSwitcher: true,
        record: true,
        screenshot: true
      })
      appStateSub.remove()
    }
  }, [])

  const handleViewPrivateKey = () => {
    setIsView(true)
  }

  const renderPrivateKeyDetail = () => {
    const privateKeyStr = isHidden
      ? '************************************************************************************'
      : (privateKey?.toString() || '')

    const arrText = []
    const groupSize = 4
    for (let idx = 0; idx < privateKeyStr.length; idx += groupSize) {
      arrText.push(privateKeyStr.slice(idx, idx + groupSize))
    }
    return (
      <MyText>
        {arrText.map((item, index) => {
          const isOtherColor = index % 2 === 0
          return (
            <MyText key={index} className={isOtherColor ? 'text-low' : 'text-medium'}>{item}</MyText>
          )
        })}
      </MyText>
    )
  }

  const renderShowPrivateKey = () => {
    const arrDes = [
      I18n.t('v2.viewPrivateKey.warnStoringOnline'),
      I18n.t('v2.viewPrivateKey.warnEncryptSave'),
      I18n.t('v2.viewPrivateKey.warnCannotCopy'),
      I18n.t('v2.viewPrivateKey.warnOnlyYouProtect')
    ]
    return (
      <View style={{ gap: pixelByHeight(14) }}>
        <View>
          <MyRowItem>
            <View>
              {renderPrivateKeyDetail()}
            </View>
          </MyRowItem>
        </View>
        {
          arrDes.map((item, index) => (
            <MyText key={index} className='text-medium'>
              {item}
            </MyText>
          ))
        }
      </View>
    )
  }

  const renderWarningShow = () => {
    return (
      <StatusMessage
        variant='warning'
        style={{
          alignItems: 'center'
        }}
        message={I18n.t('ViewIDKeyScreen.warning1')}
        iconConfig={{
          className: 'm-auto'
        }}
      />
    )
  }

  return (
    <MyViewPage isUseDrawer style={{ flex: 1, gap: pixelByHeight(8) }}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('SecurityScreen.viewPrivateKey')}
        leftIcon={images.UIV2.icons.viewPrivateKey}
        rightElement={(
          !isView ? <MyButton size='small' label={I18n.t('v2.common.view')} variant='dangerous' onPress={handleViewPrivateKey} /> : null
        )} />
      <ScrollViewBlurHeader
        isUseDrawer
        style={{ paddingTop: pixelByHeight(8) }}
      >
        {isView ? renderShowPrivateKey() : renderWarningShow()}

      </ScrollViewBlurHeader>
    </MyViewPage>
  )
}

export default ViewPrivateKey
