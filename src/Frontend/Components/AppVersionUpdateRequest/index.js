import React, { useContext } from 'react'
import { View, Text, Linking } from 'react-native'
import styles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { height } from 'common/styles'

const AppVersionUpdateRequest = ({
  closeModal
} = {}) => {
  const { modeTheme, styleTheme } = useContext(ThemeContext)

  // Pressing Update closes the modal, then opens the store (small delay lets the
  // close animation finish first).
  const onPressUpdate = () => {
    closeModal && closeModal()
    setTimeout(() => {
      const urlStore = (
        ISIOS
          ? 'https://apps.apple.com/us/app/keyring-pro-btc-eth-sol/id1546824976'
          : 'https://play.google.com/store/apps/details?id=co.bacoor.keyring'
      )
      Linking.openURL(urlStore)
    }, 500)
  }

  return (
    <View style={[styles.container, styles[`container${modeTheme}`]]}>
      {/* title */}
      <Text style={[[styleTheme.modal.textTitle, { marginBottom: height(1.5) }]]}>
        {I18n.t('appVersionUpdate.title')}
      </Text>

      {/* descirption */}
      <Text style={[styleTheme.modal.textDescription]}>{I18n.t('appVersionUpdate.content')}</Text>

      {/* button box */}
      <View style={styles.boxButton}>
        <MyButton
          label={I18n.t('MenuScreen.AccountBookScreen.update')}
          variant='primary'
          className='w-full'
          onPress={onPressUpdate} />
      </View>
    </View>
  )
}

export default AppVersionUpdateRequest
