
import React from 'react'
import { height } from 'common/styles'
import { KeyboardAwareScrollView } from '@codler/react-native-keyboard-aware-scroll-view'
export const KeyboardInput = (props) => {
  const {
    style,
    setRef,
    extraScrollHeight = height(2.5),
    keyboardShouldPersistTaps = 'never',
    dismissMode = 'none',
    children,
    scrollEnabled = true,
    enableOnAndroid = true
  } = props

  return (
    <KeyboardAwareScrollView
      enableOnAndroid={enableOnAndroid}
      contentContainerStyle={[{ flex: 1 }, style]}
      ref={setRef}
      keyboardDismissMode={dismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={scrollEnabled}
      showsVerticalScrollIndicator={false}
      extraScrollHeight={extraScrollHeight}
    >
      {children}
    </KeyboardAwareScrollView>

  )
}
