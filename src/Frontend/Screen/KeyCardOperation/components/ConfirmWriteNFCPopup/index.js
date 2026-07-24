import React, { useContext, useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { Colors, commonSize, height, width } from 'common/styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'

const ConfirmWriteNFCPopup = (props) => {
  const { closeModal, writeMessageOnCard, title, subTitle, buttonText, isDelete = false, isOtherType = false, isUsedText = false, isLock = false } = props
  const { styleTheme } = useContext(ThemeContext)
  const [isLoading, setIsLoading] = useState(!isDelete)
  const [colorButton, setColorButton] = useState(null)

  useEffect(() => {
    if (isOtherType) {
      setIsLoading(false)
    } else {
      setTimeout(() => {
        setIsLoading(false)
      }, 3000)
    }
    if (isLock) {
      setColorButton(Colors.YELLOW)
    } else if (isDelete) {
      setColorButton(Colors.RED)
    }
  }, [])

  return (
    <View style={styles.ConfirmDeleteContainer}>

      {isLock
        ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <ImageRender
              resizeMode='contain'
              uri={images.warningYellowIcon}
              style={{ width: commonSize._24px, height: commonSize._24px, marginRight: width(2) }}
            />
            <Text style={[styleTheme.modal.textTitle, { color: Colors.YELLOW }]}>{title || I18n.t('NFC.notEmptyCard')}</Text>
          </View>
        )

        : <Text style={[styleTheme.modal.textTitle, isUsedText]}>{title || I18n.t('NFC.notEmptyCard')}</Text>}
      {isUsedText && <Text style={[styleTheme.modal.textDescription, { marginTop: height(1.5) }]}>{subTitle || ''}</Text>}
      <View style={styles.boxButton}>
        <MyButton
          variant='default'
          isSub
          disableLiquidGlass
          noMinWidth
          label={I18n.t('Initial.close')}
          style={styles.cancelButton}
          onPress={closeModal}
        />
        <MyButton
          variant='primary'
          disableLiquidGlass
          noMinWidth
          isDisable={isLoading}
          isLoading={isLoading}
          label={buttonText || I18n.t('Initial.confirm')}
          style={[styles.updateButton, colorButton ? { backgroundColor: colorButton } : {}]}
          onPress={writeMessageOnCard}
        />
      </View>
    </View>
  )
}

export default ConfirmWriteNFCPopup
