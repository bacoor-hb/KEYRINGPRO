import React, { useContext } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import MyButton from 'frontend/Components/UI/MyButton'
import Clipboard from '@react-native-clipboard/clipboard'
import { NavigationActions } from 'src/navigation/NavigationService'

const ModalPrivateKey = props => {
  const { closeModal, privateKey } = props

  const onCopyPrivateKey = () => {
    Clipboard.setString(privateKey)
    this.showAlert(I18n.t('Initial.copyDone', { value: 'PrivateKey' }), '', { type: 'toast' })
  }

  const closeModalCustom = () => {
    closeModal()
    NavigationActions.reset('keyCardOperation')
  }
  const { modeTheme, styleTheme } = useContext(ThemeContext)
  return (
    <View style={styles.container}>
      <View style={styles.rowSuccessInfo}>
        <View>
          <View style={styles[`coinBox${modeTheme}`]}>
            <Text numberOfLines={1} style={styles[`privateKeyTxt${modeTheme}`]}>{I18n.t('Content.privateKey')}</Text>
            <View style={styles.centerBox}>
              <View style={styles.middleBox}>
                <Text numberOfLines={4} style={[styles.privateCoin, { color: styleTheme.color }]}>{privateKey}</Text>
              </View>
              <View style={styles.rightBox}>
                <View style={styles.bottomViewRightBox}>
                  <TouchableOpacity activeOpacity={1} onPress={onCopyPrivateKey}>
                    <ImageRender resizeMode='contain' uri={images.copyAccountIcon} style={styles.rightIcon} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          <MyButton
            variant='primary'
            disableLiquidGlass
            noMinWidth
            style={styles.buttonClose}
            label={I18n.t('Initial.close')}
            onPress={closeModalCustom}
          />
        </View>
      </View>
    </View>
  )
}

export default ModalPrivateKey
