import React, { useContext } from 'react'
import { View, Text, TouchableOpacity, FlatList } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'
import { width } from 'common/styles'

const InfoBackupPopup = props => {
  const { closeModal } = props
  const { modeTheme, styleTheme } = useContext(ThemeContext)

  const renderInfoItem = ({ item }) => {
    return (
      <View style={styles.textBox}>
        <View style={styles.circleDot} />
        <Text style={[styles.text, { color: styleTheme.color }]}>{item}</Text>
      </View>
    )
  }

  const dataText = [
    I18n.t('MenuScreen.BackUpWalletScreen.infoGetBackupOfYourPrivate'),
    I18n.t('MenuScreen.BackUpWalletScreen.infoYouAreTheOnlyOne'),
    I18n.t('MenuScreen.BackUpWalletScreen.infoOnlyYouCanKnowThePass'),
    I18n.t('MenuScreen.BackUpWalletScreen.infoYouOnlyNeedToGetThisBackup')
  ]

  return (
    <View style={[styles.container, styles[`container${modeTheme}`]]}>
      <View style={styles.navigationBox}>
        <TouchableOpacity onPress={closeModal}>
          <ImageRender
            style={{ height: width(4), width: width(4) }}
            resizeMode='contain'
            uri={images.closeButtonIcon}
          />
        </TouchableOpacity>
      </View>
      {/* <Text style={styles.text}>{I18n.t('SendScreen.withoutAssigning')}</Text>
      <Text style={styles.text}>{I18n.t('SendScreen.youCanNotDisableThisUrl')}</Text> */}
      <View style={styles.textContainer}>
        <FlatList
          showsVerticalScrollIndicator={false}
          bounces={false}
          data={dataText}
          renderItem={renderInfoItem}
        />
      </View>
    </View>
  )
}

export default InfoBackupPopup
