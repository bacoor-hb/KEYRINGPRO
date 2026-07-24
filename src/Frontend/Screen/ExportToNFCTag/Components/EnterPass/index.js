import React, { useMemo, useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import images from 'assets/Image'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyKeyboardNumber from 'frontend/Components/UI/MyKeyboardNumber'
import { View } from 'react-native'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import { pixelByHeight } from 'common/styles'
import InputOTP from 'frontend/Components/UI/InputOTP'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { HAPTIC_OPTIONS } from 'frontend/Screen/SecurityUpgradeScreen/components/EnterPasscodeModal'

const EnterPass = ({ _this }) => {
  // eslint-disable-next-line no-unused-vars
  const { handleSaveFilBackupPasscode } = _this
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [isShowEnterPassAgain, setIsShowEnterPassAgain] = useState(false)
  const styles = createStyles()
  const isValidPass = useMemo(() => {
    if (passwordAgain) {
      return password === passwordAgain
    }
    return true
  }, [password, passwordAgain])

  const isPassLength = useMemo(() => {
    return (password?.length || -1) === (passwordAgain?.length || 0)
  }, [password, passwordAgain])

  const onEnterPass = (value, isAgain) => {
    try {
      ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)

      if (isAgain) {
        const passWordNew = [...passwordAgain, value].join('')

        if (passWordNew?.length > 4) return

        setPasswordAgain(passWordNew)

        if (passWordNew?.length === 4) {
          if (passWordNew === password) {
            handleSaveFilBackupPasscode(passWordNew)
          } else {
            _this.showAlert(I18n.t('MenuScreen.BackUpWalletScreen.passwordNotMatch'), '', {
              type: 'error',
              closable: true,
              overClickClose: false,
              callback: () => {
                setPassword('')
                setPasswordAgain('')
                setIsShowEnterPassAgain(false)
              }
            })
          }
        }
      } else {
        const passWordNew = [...password, value].join('')

        if (passWordNew?.length <= 4) {
          setPassword(passWordNew)
        }
        if (passWordNew?.length === 4) {
          setTimeout(() => { setIsShowEnterPassAgain(true) }, 500)
        }
      }
    } catch (error) {
      // console.log({ error })
    }
  }

  const onDelete = () => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)

    if (isShowEnterPassAgain) {
      setPasswordAgain(pre => {
        const newPass = [...pre]
        newPass.pop()
        return newPass.join('')
      })
      return
    }
    setPassword(pre => {
      const newPass = [...pre]
      newPass.pop()
      return newPass.join('')
    })
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={isShowEnterPassAgain ? I18n.t('v2.exportNfc.enterPasswordAgain') : I18n.t('NFC.enterPass')}
        leftIcon={images.UIV2.icons.enterPrivateKey}
      />
      <View style={{ gap: pixelByHeight(4) }} className='flex-1 justify-center'>
        <InputOTP passcode={isShowEnterPassAgain ? passwordAgain : password} />

      </View>

      <MyKeyboardNumber onDelete={onDelete} onPress={(value) => onEnterPass(value, isShowEnterPassAgain)} />

    </MyViewPage>
  )
}

export default EnterPass
