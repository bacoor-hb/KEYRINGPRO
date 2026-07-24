import React, { useCallback } from 'react'
import { WebView as WebViewProvider } from 'react-native-webview'
import { Linking, View, ActivityIndicator } from 'react-native'
import { height } from 'common/styles'

const WebView = ({
  url,
  onComplete,
  onError,
  onMessage,
  style,
  navigationRequest
}) => {
  const handleMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data)
        onMessage?.(data)
      } catch (error) {
        // console.log('error', error)
        onError?.(error)
      }
    },
    [onComplete, onError]
  )

  const handleNavigationRequest = useCallback(
    (request) => {
      // Open external links (T&C, Privacy Policy) in system browser
      if (!request.url.includes('pay.walletconnect.com')) {
        Linking.openURL(request.url)
        return false
      }
      navigationRequest?.(request)
      return true
    },
    []
  )

  return (
    <WebViewProvider
      source={{ uri: url }}
      onMessage={handleMessage}
      onShouldStartLoadWithRequest={handleNavigationRequest}
      javaScriptEnabled
      style={[{ flex: 1, paddingBottom: height(0) }, style]}
      domStorageEnabled
      startInLoadingState
      hideKeyboardAccessoryView
      renderLoading={() => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size='large' />
        </View>
      )}
    />
  )
}

export default WebView
