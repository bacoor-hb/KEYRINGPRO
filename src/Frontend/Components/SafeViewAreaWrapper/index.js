import { Colors, DarkColors, height } from 'common/styles'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import React from 'react'
import { View } from 'react-native'

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

let heightScreenAndroid = 0

export const setHeightScreenAndroid = (value, insetsScreen) => {
  if (value === height(100)) {
    heightScreenAndroid = value - (insetsScreen?.top || 0)
  }
  heightScreenAndroid = value
}
export const getHeightScreenAndroid = () => heightScreenAndroid

const SafeViewAreaWrapper = (props) => {
  const insets = useSafeAreaInsets()

  return (
    ISIOS ? (
      // Why? don't need SafeAreaView on IOS
      // iOS layout is already woking fine without SafeAreaView
      // To prevent any issue, we will keep it as it is
      props.children
    ) : (
      <ThemeContext.Consumer>{(context) => {
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.BLACK }}>
            <View
              onLayout={(e) => {
                setHeightScreenAndroid(e.nativeEvent.layout.height, insets)
              }}
              style={{ flex: 1 }}>
              {props.children}
            </View>

            {/* [android 15+] gesture background color default is transparent in android 15+ */}
            {/* need to add a view to prevent it */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: insets.bottom,
                backgroundColor: DarkColors.BLACK,
                zIndex: -1000
              }} />
          </SafeAreaView>
        )
      }}
      </ThemeContext.Consumer>
    )
  )
}

export default SafeViewAreaWrapper
