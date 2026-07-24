import React, { useContext, useEffect } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import LottieView from 'lottie-react-native'
import images from 'assets/Image/index'
import NfcManager from 'react-native-nfc-manager'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true
}

const LoadingScanNFCPopup = (props) => {
  const { closeModal, title, subTitle, isTapCard = false, numSteps = null, currentStep = 1 } = props
  const { styleTheme } = useContext(ThemeContext)

  useEffect(() => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', options)
  }, [])

  const RenderStepView = () => {
    const stepArr = []
    for (let index = 0; index < numSteps; index++) {
      stepArr.push(index)
    }
    return (
      stepArr.map((item, itemIndex) => {
        return (
          <View key={itemIndex} style={[styles.stepView, currentStep === (itemIndex + 1) ? { backgroundColor: 'green' } : {}]} />
        )
      })
    )
  }

  const onhandleCloseModal = () => {
    closeModal()
    ReactNativeHapticFeedback.trigger('notificationSuccess', options)
    NfcManager.cancelTechnologyRequest().catch(() => 0)
  }

  return (
    <View style={styles.loadingContainer}>
      {
        numSteps > 0 && (
          <View style={styles.stepViewContainer}>
            <RenderStepView />
          </View>
        )
      }
      <Text style={[styles.confirmTitle, { color: styleTheme.color }]}>{title || I18n.t('NFC.readyToScan')}</Text>
      <Text style={[styles.confirmSubTitle, { color: styleTheme.color }]}>{subTitle?.length > 0 ? subTitle : I18n.t('NFC.keepCardStill')}</Text>

      <LottieView
        style={styles.LottieView}
        resizeMode='contain'
        source={isTapCard ? images.tapCardNFC : images.keycardScanLoading}
        autoPlay
        loop
      />
      <View style={styles.boxButton}>
        <MyButton
          variant='default'
          disableLiquidGlass
          noMinWidth
          style={styles.cancelButton}
          label={I18n.t('Initial.close')}
          onPress={onhandleCloseModal}
        />
      </View>
    </View>
  )
}

export default LoadingScanNFCPopup
