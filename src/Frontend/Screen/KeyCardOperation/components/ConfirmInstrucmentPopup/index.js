import React, { useContext, useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image/index'

const ConfirmInstrucmentPopup = (props) => {
  const [isLoadingInit, setIsLoadingInit] = useState(true)
  const { closeModal, writeMessageOnCard } = props
  const { modeTheme, styleTheme } = useContext(ThemeContext)

  useEffect(() => {
    setTimeout(() => {
      setIsLoadingInit(false)
    }, 3000)
  }, [])

  return (
    <View style={styles.ConfirmDeleteContainer}>
      <Text style={[styleTheme.modal.textDescription, { textAlign: 'left' }]}>{I18n.t('NFC.instructionOperate')}</Text>
      <View style={styles.ThreeStepBox}>
        <View style={styles.StepBox}>
          <View style={styles.numberStepBox}>
            <Text style={styles.numberStepTxt}>1</Text>
          </View>
          <View style={styles.imageStepBox}>
            <ImageRender uri={images[`nfcStep1${modeTheme}`]} style={styles.stepImage} resizeMode='contain' />
          </View>
          <Text style={styles[`stepTitle${modeTheme}`]}>{I18n.t('NFC.NFCKeyCardStep1')}</Text>
        </View>

        <View style={styles.StepBox}>
          <View style={styles.numberStepBox}>
            <Text style={styles.numberStepTxt}>2</Text>
          </View>
          <View style={styles.imageStepBox}>
            <ImageRender uri={images[`nfcFileStep2${modeTheme}`]} style={styles.stepImage} resizeMode='contain' />
          </View>
          <Text style={styles[`stepTitle${modeTheme}`]}>{I18n.t('NFC.NFCKeyFileStep2')}</Text>
        </View>

        <View style={styles.StepBox}>
          <View style={styles.numberStepBox}>
            <Text style={styles.numberStepTxt}>3</Text>
          </View>

          <View style={styles.imageStepBox}>
            <ImageRender uri={images[`nfcPasswordStep3${modeTheme}`]} style={styles.stepImage} resizeMode='contain' />
          </View>
          <Text style={styles[`stepTitle${modeTheme}`]}>{I18n.t('NFC.YourOwnPasswordStep3')}</Text>
        </View>
      </View>

      <Text style={[styleTheme.modal.textDescription, { textAlign: 'left' }]}>{I18n.t('NFC.pleaseChooseAPass')}</Text>

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
          isDisable={isLoadingInit}
          isLoading={isLoadingInit}
          label={I18n.t('Initial.btnNext')}
          style={styles.updateButton}
          onPress={writeMessageOnCard}
        />
      </View>
    </View>
  )
}

export default ConfirmInstrucmentPopup
