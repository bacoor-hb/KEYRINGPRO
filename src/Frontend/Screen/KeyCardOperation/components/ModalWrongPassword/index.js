import React, { useContext } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import MyButton from 'frontend/Components/UI/MyButton'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import images from 'assets/Image'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import useAppNavigation from 'frontend/Hooks/useAppNavigation'

const ModalWrongPassword = props => {
  const { closeModal, onResetPass } = props
  const { goBack } = useAppNavigation()

  const closeModalCustom = () => {
    closeModal()
    goBack()
  }

  const onTryAgain = () => {
    onResetPass()
    closeModal()
  }

  const { modeTheme } = useContext(ThemeContext)
  return (
    <View style={styles.container}>
      <View style={styles.rowInfo}>
        <ImageRender uri={images.error} style={styles.iconCheckedIcon} resizeMode='contain' />
        <Text style={[styles[`titleReset${modeTheme}`]]}>{I18n.t('MenuScreen.BackUpWalletScreen.canNotRestoreTitle')}</Text>
        <Text style={styles.txtHelp}>{I18n.t('MenuScreen.BackUpWalletScreen.canNotRestoreDescription')}</Text>
      </View>

      <View style={styles.buttonBox}>
        <MyButton
          variant='default'
          isSub
          disableLiquidGlass
          noMinWidth
          style={styles.buttonLeft}
          label={I18n.t('Initial.cancel')}
          onPress={closeModalCustom}
        />

        <MyButton
          variant='primary'
          disableLiquidGlass
          noMinWidth
          onPress={onTryAgain}
          style={styles.buttonRight}
          label={I18n.t('MenuScreen.RestoreWalletScreen.tryAgain')}
        />
      </View>
    </View>
  )
}

export default ModalWrongPassword
