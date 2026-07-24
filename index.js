import './shim.js'
import './globals.js'
import 'react-native-get-random-values'
import 'react-native-reanimated'
import React, { useCallback, useEffect, useState } from 'react'
import { AppRegistry, LogBox, Platform } from 'react-native'
import App from './src/App'
import { name as appName } from './app.json'
import messaging from '@react-native-firebase/messaging'
import notifee, { EventType } from '@notifee/react-native'
import { handleWCv2PushNotifications } from 'common/walletconnect.js'
import { useOnAppStateChange } from 'frontend/Hooks/useOnAppStateChange.js'

if (__DEV__) {
  require('./ReactotronConfig')
}

LogBox.ignoreLogs([
  'currentlyF',
  'Animated.event',
  'VirtualizedLists should never be nested',
  'It appears that you are using old version of react-navigation library. Please update @react-navigation/bottom-tabs',
  'Require cycle:'
])

notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail

  // Check if the user pressed the "Mark as read" action
  if (type === EventType.ACTION_PRESS && pressAction.id === 'mark-as-read') {
    // Decrement the count by 1
    await notifee.decrementBadgeCount()

    // Remove the notification
    await notifee.cancelNotification(notification.id)
  }
})

messaging().setBackgroundMessageHandler(async remoteMessage => {
  notifee.incrementBadgeCount()
  handleWCv2PushNotifications(remoteMessage)
})

// Why? need to check isHeadless here
// read bug => https://github.com/invertase/react-native-firebase/issues/5388
// read bug => https://github.com/invertase/react-native-firebase/issues/8217
// solution => https://github.com/invertase/react-native-firebase/issues/8248#issuecomment-2681039536
// solution => https://github.com/invertase/react-native-firebase/issues/8217#issuecomment-3298864743
function HeadlessCheck ({ isHeadless }) {
  const [shouldRenderUI, setShouldRenderUI] = useState(!isHeadless)

  // Workaround for iOS not providing the headless parameter
  // https://github.com/invertase/react-native-firebase/issues/8248#issuecomment-2686603423
  const headlessCheck = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const isHeadlessValue = await messaging().getIsHeadless()
      setShouldRenderUI(!isHeadlessValue)
    }
  }, [])

  useEffect(() => {
    headlessCheck()
  }, [])

  useOnAppStateChange(headlessCheck)

  return shouldRenderUI ? <App /> : null
}

AppRegistry.registerComponent(appName, () => HeadlessCheck)
