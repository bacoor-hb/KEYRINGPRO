import React, { useCallback } from 'react'
import { WebView as WebViewProvider } from 'react-native-webview'
import { Linking, View, ActivityIndicator } from 'react-native'

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
      style={{ flex: 1, paddingBottom: 0 }}
      domStorageEnabled
      startInLoadingState
      hideKeyboardAccessoryView
      nestedScrollEnabled
      overScrollMode='never'
      injectedJavaScript={`
    document.body.style.overflow = 'scroll';
 
  `}
      renderLoading={() => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size='large' />
        </View>
      )}
    />
  )
}

export default WebView
