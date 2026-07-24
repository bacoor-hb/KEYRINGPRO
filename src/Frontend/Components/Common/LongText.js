/* eslint-disable react-native/no-unused-styles */
import React, { useContext } from 'react'
import { View, StyleSheet, Text } from 'react-native'
import { width } from 'common/styles'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import TextTicker from 'react-native-text-ticker'

const LongText = ({
  text,
  containerStyle,
  textStyle,
  textTickerOptions
}) => {
  const { styleTheme } = useContext(ThemeContext)
  return (
    <View style={[containerStyle]}>
      {
        !ISIOS ? (
          <Text style={[styles.textStyle, { color: styleTheme.color }, textStyle]} numberOfLines={1}>
            {text}
          </Text>
        ) : (
          <TextTicker
            style={[styles.textStyle, { color: styleTheme.color }, textStyle]}
            animationType='auto'
            loop
            marqueeDelay={1000}
            duration={text.length * 200}
            {...textTickerOptions}
          >
            {text}
          </TextTicker>
        )
      }
    </View>
  )
}

export default LongText

const styles = StyleSheet.create({
  textStyle: {

    fontSize: width(4.5)
  }
})
