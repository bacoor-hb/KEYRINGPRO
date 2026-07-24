import React from 'react'
import { View, Image, Text } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import Button from 'frontend/Components/Common/Button'
import images from 'assets/Image'
import RNRestart from 'react-native-restart'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'

export default function Template (props) {
  const onRestart = () => {
    RNRestart.Restart()
  }
  return (
    <ThemeContext.Consumer>{(context) => {
      return (
        <View style={styles.container}>
          <Image source={images.iconAppCrashed} style={styles.imgShit} />
          <Text style={[styles.appCrashTitle, { color: context.styleTheme.color }]}>{I18n.t('Initial.crashTitle')}</Text>
          <Text style={styles[`appCrash${context.modeTheme}`]}>{I18n.t('Initial.appCrash')}</Text>
          <Button
            style={styles.buttonLeft}
            label={I18n.t('Initial.restartApp')}
            textStyle={styles.textButtonColor}
            onPress={onRestart} />
        </View>
      )
    }}
    </ThemeContext.Consumer>
  )
}
