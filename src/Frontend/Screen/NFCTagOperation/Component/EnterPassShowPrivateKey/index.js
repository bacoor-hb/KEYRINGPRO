import React, { useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import images from 'assets/Image'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyKeyboardNumber from 'frontend/Components/UI/MyKeyboardNumber'
import { View } from 'react-native'
import { decryptPrivateKeyFromKeyringHardwalletWeb } from 'common/function'
import I18n from 'assets/Lang'
import InputOTP from 'frontend/Components/UI/InputOTP'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { HAPTIC_OPTIONS } from 'frontend/Screen/SecurityUpgradeScreen/components/EnterPasscodeModal'
import MyText from 'frontend/Components/UI/MyText'

const EnterPassShowPrivateKey = ({ _this, infoNFC, isUseFile = false }) => {
  const { handleShowPrivateKey } = _this
  const [password, setPassword] = useState('')
  const [isErrorPassword, setIsErrorPassword] = useState(false)
  const styles = createStyles()

  const onEnterPass = async (value) => {
    try {
      const passWordNew = [...password, value].join('')

      if (passWordNew?.length > 4) return
      ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)

      setPassword(passWordNew)

      if (passWordNew?.length === 4) {
        let privateKey
        let isCorrectPass
        if (infoNFC?.isNfcFromKHW) {
          const privateKeyDecryptFromKHW = decryptPrivateKeyFromKeyringHardwalletWeb(infoNFC.privateKeyEncryptFromKHW, passWordNew)
          privateKey = privateKeyDecryptFromKHW
          isCorrectPass = !!privateKeyDecryptFromKHW
        } else {
          const decodeHash = await _this.nfcProxy.decryptDataNfc(infoNFC.passwordFileEncode, passWordNew)

          if (isUseFile) {
            const decodeFile = await _this.nfcProxy.decryptDataNfc(infoNFC.dataNFC, decodeHash)
            if (decodeFile) {
              isCorrectPass = true
              privateKey = decodeFile
            }
          } else {
            isCorrectPass = decodeHash === infoNFC.passwordFi
            privateKey = infoNFC.privateKeyFromHash
          }
        }

        if (isCorrectPass) {
          handleShowPrivateKey(privateKey)
        } else {
          setIsErrorPassword(true)
        }
      }
    } catch (error) {
      // console.log({ error })
    }
  }

  const onDelete = () => {
    setIsErrorPassword(false)
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)

    setPassword(pre => {
      const newPass = [...pre]
      newPass.pop()
      return newPass.join('')
    })
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('NFC.enterPass')}
        leftIcon={images.UIV2.icons.enterPrivateKey}
      />
      <View style={styles.containerPassword} className='flex flex-1 flex-col justify-center items-center'>
        <InputOTP passcode={password} />
        <MyText style={{ opacity: isErrorPassword ? 1 : 0 }} className='text-red text-center'>
          {(I18n.t('v2.error.wrongPassword'))}
        </MyText>
      </View>
      <MyKeyboardNumber onDelete={onDelete} onPress={onEnterPass} />

    </MyViewPage>
  )
}

export default EnterPassShowPrivateKey
