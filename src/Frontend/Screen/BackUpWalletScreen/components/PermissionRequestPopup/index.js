import React from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'

import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { width } from 'common/styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'
import Button from 'frontend/Components/Common/Button'

const GetReceiveLinkPopup = props => {
  const {
    closeModal
  } = props

  return (
    <ThemeContext.Consumer>{(context) => {
      return (
        <View style={[styles.container, styles[`container${context.modeTheme}`]]}>

          <View style={styles.rowAccount}>
            <ImageRender resizeMode='contain' uri={images.error} style={styles.iconError} />
          </View>

          <View style={[styles.boxContent]}>
            <Text
              style={[
                styles.txtTitle,
                {
                  color: context.styleTheme.color,
                  fontSize: 20,
                  paddingHorizontal: width(5)
                }]}
            >
              {I18n.t('Permission.denied')}
            </Text>
            <Text style={[styles.txtDesc, styles[`txtDesc${context.modeTheme}`], { paddingHorizontal: width(5) }]}>
              {I18n.t('MenuScreen.BackUpWalletScreen.permissionRequestAndroid11')}
            </Text>
          </View>

          <View style={styles.bottomBox}>
            <>
              <Button
                onPress={closeModal}
                style={{ width: width(80), opacity: 1 }}
                label={I18n.t('Initial.ok')}
              />
            </>
          </View>
        </View>
      )
    }}
    </ThemeContext.Consumer>
  )
}

export default GetReceiveLinkPopup
