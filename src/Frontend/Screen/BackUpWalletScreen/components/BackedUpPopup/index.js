import React, { useContext } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import styles from './styles'
import { IconType } from 'common/constants/app'
import { Icon } from 'frontend/Components/Common/Icon'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'

const BackedUpPopup = props => {
  const { closeModal } = props
  const { modeTheme, styleTheme } = useContext(ThemeContext)

  return (
    <View style={[styles.container, styleTheme, styles[`container${modeTheme}`]]}>
      <View style={styles.navigationBox}>
        <TouchableOpacity onPress={closeModal}>
          <Icon style={styles.closeIcon} name='close' Type={IconType.AntDesign} />
        </TouchableOpacity>
      </View>
      <Text style={styles.backupTitle}>{I18n.t('BackUpWalletScreen.backUpWallet')}</Text>
      <View style={styles.backupStatus}>
        <Text style={styles.backupStatusBackedUpText}>{I18n.t('BackUpWalletScreen.yourWalletBackedUp')} </Text>
        <Text style={styles.internalText}>{I18n.t('BackUpWalletScreen.internalStorage')}</Text>
      </View>
      <Text style={styles.descriptionText}>{I18n.t('BackUpWalletScreen.ifTheOnlyPlace')}</Text>
      <Text style={styles.anycaseText}>{I18n.t('BackUpWalletScreen.inAnyCase')}</Text>
    </View>
  )
}

export default BackedUpPopup
