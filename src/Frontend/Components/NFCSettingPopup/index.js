import React, { useContext } from 'react'
import { View, Text, TouchableOpacity, Image } from 'react-native'
import styles from './styles'
import { Icon } from 'frontend/Components/Common/Icon'
import { IconType } from 'common/constants/app'
import Button from 'frontend/Components/Common/Button'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { getColorIconByTheme } from 'common/function'
import NfcManager from 'react-native-nfc-manager'
import MyButton from '../UI/MyButton'
import MyText from '../UI/MyText'
import MyIcon from '../UI/MyIcon'

const NFCSettingPopup = props => {
  const { closeModal, callBackBeforeGoSetting, callBackBeforeCloseModal } = props
  const { modeTheme, styleTheme } = useContext(ThemeContext)

  const goToNfcSetting = async () => {
    callBackBeforeGoSetting && callBackBeforeGoSetting()
    await NfcManager.goToNfcSetting()
  }

  const closeModalHandle = () => {
    callBackBeforeCloseModal && callBackBeforeCloseModal()
    closeModal()
  }

  return (
    <View style={styles.container}>
      <View style={styles.navigationBox}>
        <TouchableOpacity onPress={closeModalHandle}>
          <MyIcon variant='small' uri={images.UIV2.icons.closeNoBorder} />

        </TouchableOpacity>
      </View>
      <View>
        <View style={styles.IconWarningBox}>
          <Image source={images.warningSign} style={styles.IconWarning} />
        </View>
        <MyText variant='subTitle' className='text-center'>{I18n.t('NFC.NFCIsNotAvailable')}</MyText>
        <MyText className='text-medium text-center'>{I18n.t('NFC.pleaseAllowNFC')}</MyText>
      </View>
      <View style={styles.buttonBox}>
        <MyButton
          disableLiquidGlass
          onPress={goToNfcSetting}
          className='w-full'
        >
          <MyText>
            {I18n.t('NFC.goToNfcSetting')}
          </MyText>
        </MyButton>
      </View>
    </View>
  )
}

export default NFCSettingPopup
