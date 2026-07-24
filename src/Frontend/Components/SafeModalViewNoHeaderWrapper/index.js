import React from 'react'
import { heightScreenNotHeader, safePaddingTopUnderHeader } from 'common/styles'
import { View } from 'react-native'

const SafeModalViewNoHeaderWrapper = ({
  customStyle,
  children
}) => {
  return (
    ISIOS ? (
      <View style={customStyle ? { ...customStyle } : { height: heightScreenNotHeader }}>
        {children}
      </View>
    ) : (
      <View style={{ paddingTop: safePaddingTopUnderHeader, flex: 1, ...customStyle }}>
        {children}
      </View>
    )
  )
}

export default SafeModalViewNoHeaderWrapper
