import { pixelByHeight, width } from 'common/styles'
import WebView from 'frontend/Components/WebView'
import React from 'react'
import { ScrollView, View } from 'react-native'
import I18n from 'assets/Lang'
import { BORDER_RADIUS_TOP_DRAWER } from 'frontend/Components/UI/MyDrawer/ui'

const FormEnterUserInfo = ({
  url,
  onComplete,
  onError,
  onClose
}) => {
  const onMessageWebView = (data) => {
    switch (data.type) {
      case 'IC_COMPLETE':
        onComplete?.(data)
        break
      case 'IC_ERROR':
        onError?.(data.error || I18n.t('v2.wcPay.unknownError'))
        break
      default:
        onComplete?.(data)
        break
    }
  }
  return (
    <View style={{ height: '100%', width: width(100) }}>
      <View style={{ width: width(100), height: pixelByHeight(64), position: 'absolute', top: 0, zIndex: 10 }} />
      <ScrollView contentContainerStyle={{ flex: 1 }} style={{ flex: 1 }}>
        <View style={{ flex: 1, width: width(100), overflow: 'hidden', ...BORDER_RADIUS_TOP_DRAWER }}>
          <WebView
            onComplete={onComplete}
            onError={onError}
            onMessage={onMessageWebView}
            url={url}
          />
        </View>
      </ScrollView>

    </View>
  )
}

export default FormEnterUserInfo
