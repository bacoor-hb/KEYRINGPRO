import React, { useEffect, useRef, useState } from 'react'
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

// A card written by KEYRING HARD WALLET WEB is protected by a 6-digit PIN; cards
// written by this app use 4. This drawer used to assume 4 for both, so a KHW card
// could never have its full PIN typed in — the 5th digit was swallowed and the
// 4-digit prefix was submitted and rejected. The scan worked, the flow just died
// here. Same split the old EnterPassNFCScreen made with `pincodeSize`.
const PIN_LENGTH_KHW = 6
const PIN_LENGTH_APP = 4
// After a wrong passcode the error shows immediately and the keypad stays interactive;
// the passcode is auto-cleared after this long so the user can re-enter a fresh code.
// Any key press during the window cancels the pending auto-reset.
const PASSCODE_AUTO_RESET_DELAY = 3000
// How long digits are ignored right after a wrong passcode, so the error is readable
// before the next tap wipes it and starts a new code.
//
// Without it the pause would depend on how long verification takes, which differs
// between card types, so the error could vanish on the very next keypress. A fixed
// lock makes every card behave the same. Deleting still works during the lock — that
// is a deliberate correction, not an accidental tap.
const PASSCODE_ERROR_INPUT_LOCK = 1000

const EnterPassShowPrivateKey = ({ _this, infoNFC, isUseFile = false }) => {
  const { handleShowPrivateKey } = _this
  const [password, setPassword] = useState('')
  const [isErrorPassword, setIsErrorPassword] = useState(false)
  const resetTimerRef = useRef(null)
  // Bumped whenever the user deletes/types while a verification is in flight, so a slow
  // NFC decrypt resolving later can detect its input is stale and discard its result
  const verifyTokenRef = useRef(0)
  // The passcode's source of truth, mirrored into state only for rendering. Reading it
  // from `password` instead meant two taps landing in the same render batch both saw the
  // OLD value: the second one rebuilt the code from a stale prefix, so a keystroke was
  // dropped and the entry never reached its full length — the keypad just kept accepting
  // digits past the last box instead of submitting. A ref updates synchronously, so every
  // tap builds on the previous one no matter how fast they arrive. Same reason it also
  // guarantees only ONE submit: whichever tap completes the code advances the ref, and any
  // tap already queued behind it now measures over-length and is dropped.
  const passwordRef = useRef('')
  const lockTimerRef = useRef(null)
  const isInputLockedRef = useRef(false)
  const styles = createStyles()
  const pinLength = infoNFC?.isNfcFromKHW ? PIN_LENGTH_KHW : PIN_LENGTH_APP

  // Always go through this: the ref and the rendered state must never drift apart.
  const setPasscode = (value) => {
    passwordRef.current = value
    setPassword(value)
  }

  const cancelAutoReset = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }

  const cancelErrorInputLock = () => {
    isInputLockedRef.current = false
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current)
      lockTimerRef.current = null
    }
  }

  useEffect(() => () => {
    cancelAutoReset()
    cancelErrorInputLock()
  }, [])

  const onEnterPass = async (value) => {
    try {
      // Swallow the taps that land while the error is still being read (see
      // PASSCODE_ERROR_INPUT_LOCK). A ref, not state: taps arrive faster than a re-render.
      if (isInputLockedRef.current) return

      if (isErrorPassword) {
        // Typing during the error window cancels the pending auto-reset and starts fresh
        cancelAutoReset()
        setIsErrorPassword(false)
        verifyTokenRef.current += 1
        setPasscode(value)
        return
      }

      const passWordNew = `${passwordRef.current}${value}`

      if (passWordNew?.length > pinLength) return
      ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)

      setPasscode(passWordNew)

      if (passWordNew?.length === pinLength) {
        // If the user deletes or types while the (slow) NFC decrypt is in flight, the
        // input is no longer what was submitted, so discard this stale result.
        const verifyToken = verifyTokenRef.current
        let privateKey
        let isCorrectPass
        if (infoNFC?.isNfcFromKHW) {
          const privateKeyDecryptFromKHW = decryptPrivateKeyFromKeyringHardwalletWeb(infoNFC.privateKeyEncryptFromKHW, passWordNew)
          privateKey = privateKeyDecryptFromKHW
          isCorrectPass = !!privateKeyDecryptFromKHW
        } else {
          const decodeHash = await _this.nfcProxy.decryptDataNfc(infoNFC.passwordFileEncode, passWordNew)

          if (verifyTokenRef.current !== verifyToken) return

          if (isUseFile) {
            const decodeFile = await _this.nfcProxy.decryptDataNfc(infoNFC.dataNFC, decodeHash)

            if (verifyTokenRef.current !== verifyToken) return
            if (decodeFile) {
              isCorrectPass = true
              privateKey = decodeFile
            }
          } else {
            isCorrectPass = decodeHash === infoNFC.passwordFile
            privateKey = infoNFC.privateKeyFromHash
          }
        }

        if (verifyTokenRef.current !== verifyToken) return

        if (isCorrectPass) {
          handleShowPrivateKey(privateKey)
        } else {
          // Show the error right away; after 3s the passcode auto-resets to empty so the
          // user can re-enter a fresh one. Only reached after a full-length entry (4 or
          // 6 digits, see pinLength). Any key press before the timer fires cancels the reset.
          setIsErrorPassword(true)
          cancelAutoReset()
          resetTimerRef.current = setTimeout(() => {
            setPasscode('')
            setIsErrorPassword(false)
            resetTimerRef.current = null
          }, PASSCODE_AUTO_RESET_DELAY)
          // Hold the keypad just long enough for the message to register, so a fast card
          // and a slow card behave the same way from here on.
          cancelErrorInputLock()
          isInputLockedRef.current = true
          lockTimerRef.current = setTimeout(() => {
            isInputLockedRef.current = false
            lockTimerRef.current = null
          }, PASSCODE_ERROR_INPUT_LOCK)
          ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
        }
      }
    } catch (error) {
      // console.log({ error })
    }
  }

  const onDelete = () => {
    cancelAutoReset()
    // Backspace is an intentional correction, so it releases the error lock rather than
    // being swallowed by it.
    cancelErrorInputLock()
    setIsErrorPassword(false)
    verifyTokenRef.current += 1
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)

    // Off the ref for the same reason as onEnterPass: rapid delete taps sharing one
    // render batch would each pop from the same stale string and only remove one digit.
    setPasscode(passwordRef.current.slice(0, -1))
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('NFC.enterPass')}
        leftIcon={images.UIV2.icons.enterPrivateKey}
      />
      <View style={styles.containerPassword} className='flex flex-1 flex-col justify-center items-center'>
        <InputOTP passcode={password} length={pinLength} />
        <MyText style={{ opacity: isErrorPassword ? 1 : 0 }} className='text-red text-center'>
          {(I18n.t('v2.error.wrongPassword'))}
        </MyText>
      </View>
      <MyKeyboardNumber onDelete={onDelete} onPress={onEnterPass} />

    </MyViewPage>
  )
}

export default EnterPassShowPrivateKey
