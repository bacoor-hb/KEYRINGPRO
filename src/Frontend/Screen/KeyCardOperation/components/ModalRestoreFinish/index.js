import React, { useEffect, useContext } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import LottieView from 'lottie-react-native'
import images from 'assets/Image'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import MyButton from 'frontend/Components/UI/MyButton'
import { NavigationActions } from 'src/navigation/NavigationService'

const ModalRestoreFinish = props => {
  const { closeModal, isRestoring } = props
  let refLoading = null
  const setRefLoading = (ref) => {
    refLoading = ref
  }

  useEffect(() => {
    refLoading && refLoading.play(0, 92)
  }, [])

  const closeModalCustom = () => {
    closeModal()
    NavigationActions.reset('home')
  }
  const { modeTheme } = useContext(ThemeContext)
  return (
    <View style={styles.container}>
      <View style={styles.rowSuccessInfo}>
        <ImageRender uri={images.success} style={styles.iconCheckedIcon} resizeMode='contain' />
        {
          isRestoring ? (
            <View style={styles.bottomBox}>
              <LottieView
                ref={setRefLoading}
                style={styles.imgPantoLottie}
                source={images.simpleLoader} />
            </View>
          ) : (
            <View>
              <Text style={styles[`titleReset${modeTheme}`]}>{I18n.t('MenuScreen.BackUpWalletScreen.walletRestoredTitle')}</Text>
              <Text style={styles.txtHelp}>{I18n.t('MenuScreen.BackUpWalletScreen.walletRestoredDescription')}</Text>
              <MyButton
                variant='primary'
                disableLiquidGlass
                noMinWidth
                style={styles.buttonClose}
                label={I18n.t('Initial.close')}
                onPress={closeModalCustom}
              />
            </View>
          )
        }
      </View>
    </View>
  )
}

export default ModalRestoreFinish
