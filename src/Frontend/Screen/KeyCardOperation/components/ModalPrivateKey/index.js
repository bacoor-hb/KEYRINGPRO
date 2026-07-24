import React, { useContext, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import MyButton from 'frontend/Components/UI/MyButton'
import QRCode from 'react-native-qrcode-svg'
import { Colors, height, width } from 'common/styles'
import { NavigationActions } from 'src/navigation/NavigationService'

const ModalPrivateKey = props => {
  const { closeModal, privateKey = null, onCopyPrivateKey } = props
  const [isShowPrivateKey, setIsShowPrivateKey] = useState(false)

  const closeModalCustom = () => {
    closeModal()
    NavigationActions.reset('keyCardOperation')
  }

  const openShowPrivateKey = () => {
    setIsShowPrivateKey(true)
  }
  const { modeTheme, styleTheme } = useContext(ThemeContext)
  return (
    <View style={[styles.container, isShowPrivateKey ? { backgroundColor: 'white', height: '100%', width: '100%', justifyContent: 'space-between', alignItems: 'center' } : {}]}>
      <View style={styles.rowSuccessInfo}>
        {
          isShowPrivateKey ? (
            <View style={[styles[`qrcodeContainer${modeTheme}`]]}>
              <View />
              <View style={styles.qrcodeBox}>
                {privateKey && privateKey.length > 0 ? (
                  <QRCode
                    value={privateKey}
                    size={width(80)}
                    logoBackgroundColor='transparent'
                  />
                ) : null}
                <View style={styles.centerBox}>
                  <TouchableOpacity numberOfLines={1} style={styles.middleBox} onPress={onCopyPrivateKey}>
                    <Text numberOfLines={4} style={[styles[`privateCoin${modeTheme}`], { color: Colors.TEXT }]}>{privateKey || ''}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity numberOfLines={1} onPress={closeModalCustom} style={styles.buttonCloseBox}>
                <ImageRender resizeMode='contain' uri={images.closeCircleButton} style={styles.buttonClose} />
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View>
                <Text numberOfLines={1} style={[styleTheme.modal.textTitle, { marginBottom: height(1.5) }]}>{I18n.t('NFC.showPrivateKey')}</Text>
                <View style={styles.centerBox}>
                  <Text style={[styleTheme.modal.textDescription]}>{I18n.t('NFC.pleasePrintOutPrivateKey')}</Text>
                </View>
              </View>
              <MyButton
                variant='primary'
                disableLiquidGlass
                noMinWidth
                style={styles.buttonShowClose}
                label={I18n.t('NFC.showPrivateKey')}
                onPress={openShowPrivateKey}
              />
            </View>
          )

        }
      </View>
    </View>
  )
}

export default ModalPrivateKey
