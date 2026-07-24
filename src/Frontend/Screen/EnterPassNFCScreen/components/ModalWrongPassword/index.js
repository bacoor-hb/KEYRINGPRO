import React, { useContext } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import MyButton from 'frontend/Components/UI/MyButton'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import images from 'assets/Image'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { height } from 'common/styles'
import { NavigationActions } from 'src/navigation/NavigationService'

const ModalWrongPassword = props => {
  const { closeModal, onResetPass } = props

  const closeModalCustom = () => {
    closeModal()
    NavigationActions.goBack()
  }

  const onTryAgain = () => {
    onResetPass()
    closeModal()
  }

  const { styleTheme } = useContext(ThemeContext)
  return (
    <View style={styles.container}>
      <View style={styles.rowInfo}>
        <ImageRender uri={images.error} style={styles.iconCheckedIcon} resizeMode='contain' />
        <Text style={[styleTheme.modal.textTitle, { marginBottom: height(1.5) }]}>{I18n.t('MenuScreen.BackUpWalletScreen.passwordNotMatch')}</Text>
        <Text style={[styleTheme.modal.textDescription]}>{I18n.t('MenuScreen.BackUpWalletScreen.canNotRestoreDescription')}</Text>

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
