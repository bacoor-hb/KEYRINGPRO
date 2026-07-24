import React, { useState } from 'react'
import I18n from 'assets/Lang'
import { View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import images from 'assets/Image'
import styles from './styles'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { sleep } from 'common/function'
import InputOTP from 'frontend/Components/UI/InputOTP'
import MyKeyboardNumber from 'frontend/Components/UI/MyKeyboardNumber'

export const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }
const PASSCODE_LENGTH = 4
// After a wrong passcode the error shows immediately; keep the keypad locked for this long before allowing a retry
const PASSCODE_RETRY_LOCK_DELAY = 1000

const EnterPasscodeModal = ({ onVerify, onVerified, onLocked, closeModal }) => {
  const [passcode, setPasscode] = useState('')
  const [isError, setIsError] = useState(false)
  const [attemptsLeft, setAttemptsLeft] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const handleVerify = async (code) => {
    setIsVerifying(true)
    // onVerify resolves to { ok, attemptsLeft, isLocked }
    const result = await onVerify?.(code)
    if (result?.ok) {
      setIsVerifying(false)
      closeModal?.()
      onVerified?.(code)
    } else if (result?.isLocked) {
      setIsVerifying(false)
      closeModal?.()
      onLocked?.()
    } else {
      // Show the error right away, then keep the keypad locked for a moment before allowing a retry
      setAttemptsLeft(result?.attemptsLeft ?? null)
      setIsError(true)
      setPasscode('')
      await sleep(PASSCODE_RETRY_LOCK_DELAY)
      setIsVerifying(false)
    }
  }

  const handleKeyPress = (key) => {
    if (isVerifying) return
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
    if (isError) {
      setIsError(false)
      if (key === 'BACK') return
      setPasscode(key)
      return
    }
    if (key === 'BACK') {
      setPasscode(prev => prev.slice(0, -1))
      return
    }
    setPasscode(prev => {
      if (prev.length >= PASSCODE_LENGTH) return prev
      const next = prev + key
      if (next.length === PASSCODE_LENGTH) {
        handleVerify(next)
      }
      return next
    })
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('v2.password.enterCurrentPasscode')}
        leftIcon={images.UIV2.icons.enterPrivateKey}
      />
      <View style={styles.pinSection}>
        {/* <View style={styles.pinRow}>
          {Array.from({ length: PASSCODE_LENGTH }).map((_, idx) => {
            const filled = idx < passcode.length
            return (
              <View key={idx} style={styles.pinBox}>
                {filled ? (
                  <View style={styles.pinDot} />
                ) : (
                  <View style={styles.pinDash} />
                )}
              </View>
            )
          })}
        </View> */}
        <InputOTP length={PASSCODE_LENGTH} passcode={passcode} />
        <MyText className='text-red' style={[styles.errorText, !isError && styles.errorTextHidden]}>
          {attemptsLeft != null
            ? `Wrong password. App will be locked for 1h (${attemptsLeft} left)`
            : I18n.t('v2.password.incorrectPasscode')}
        </MyText>
      </View>
      {/* <View style={styles.keypad}>
        {KEYPAD.map((row, rowIdx) => (
          <View key={rowIdx} style={styles.keypadRow}>
            {row.map((key, colIdx) => {
              if (key === null) {
                return <View key={colIdx} style={styles.keySpacer} />
              }
              return (
                <TouchableOpacity
                  key={colIdx}
                  style={key === 'BACK' ? styles.keyBack : styles.key}
                  onPress={() => handleKeyPress(key)}
                  activeOpacity={0.6}
                >
                  {key === 'BACK' ? (
                    <ImageRender resizeMode='contain' uri={images.UIV2.icons.backspace} style={styles.keyIcon} />
                  ) : (
                    <MyText style={styles.keyText}>{key}</MyText>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View> */}

      <MyKeyboardNumber
        onPress={handleKeyPress}
      />
    </MyViewPage>
  )
}

export default EnterPasscodeModal
