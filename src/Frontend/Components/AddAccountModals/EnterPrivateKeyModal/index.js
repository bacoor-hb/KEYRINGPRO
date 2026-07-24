import React, { useState, useRef, useEffect } from 'react'
import I18n from 'assets/Lang'
import { View, TouchableOpacity } from 'react-native'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { useSelector } from 'react-redux'
import { ScrollView } from 'react-native-gesture-handler'
import { privateKeyToAccount } from 'viem/accounts'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import BtnBack from 'frontend/Components/UI/BtnBack'
import images from 'assets/Image'
import { lowerCase } from 'common/function'
import CreatedAccountSummary from '../CreatedAccountSummary'
import useDefaultAccountName, { fetchAddressBookName } from '../useDefaultAccountName'
import styles from './styles'

import { ImageRender } from 'frontend/Components/Common/ImageRender'

const PRIVATE_KEY_LENGTH = 64

// Light tap on every keypad press. Matches the app's standard haptic options.
const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }

const MODE = { INPUT: 'input', ERROR: 'error', SUCCESS: 'success' }

const KEYPAD = [
  ['1', '2', '3', '4', '5'],
  ['6', '7', '8', '9', '0'],
  ['a', 'b', 'c', 'd', 'e'],
  ['f', 'BACK']
]

// Stable header-left element used in EVERY mode (input / error / duplicate /
// success). It MUST keep the same element type across mode changes: if the
// leftIcon swaps between an element and a raw icon id (which TitleDrawer renders
// as a different View subtree), the first child of the header is
// unmounted+remounted mid-commit inside the bottom-sheet and Fabric crashes with
// "Attempt to recycle a mounted view". So we always render the SAME <BtnBack>
// (liquid-glass button, matching the rest of the app) — always the back arrow —
// and only swap props:
// - entry states: pressable, returns to the chooser.
// - success: disabled (dimmed, non-pressable) — the manual key-in flow already
//   created the account, so back is shown but inert.
// Keeping the type stable is what makes the liquid-glass native view safe here
// (a plain icon swap still crashed — the teardown, not the glass, was the cause).
const HeaderLeft = ({ onBack, disabled }) => (
  <BtnBack
    onPress={disabled ? () => {} : onBack}
    style={disabled ? styles.backDisabled : undefined}
    label={(
      <View className='flex flex-row items-center'>
        <MyIcon style={styles.backIcon} uri={images.UIV2.icons.arrowLeftWhite} />
      </View>
    )}
  />
)

// `successBackEnabled`: when true, the back button on the SUCCESS screen stays
// pressable (used from AddAccount, where back just closes the modal and lands
// back on the Add-account screen). Default false → disabled on success (Welcome
// flow, where back would otherwise reopen the chooser after the account exists).
const EnterPrivateKeyModal = ({ onSubmit, onSuccess, onBack, successBackEnabled = false }) => {
  const [mode, setMode] = useState(MODE.INPUT)
  const [privateKey, setPrivateKey] = useState('')
  const [account, setAccount] = useState(null)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const accountList = useSelector((s) => s.accountListRedux || [])
  const defaultAccountName = useDefaultAccountName()
  const [accountName, setAccountName] = useState(defaultAccountName)
  const [isLoading, setIsLoading] = useState(false)

  const backTimer = useRef(null)
  const backInterval = useRef(null)

  const handleKeyPress = (key) => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
    setIsDuplicate(false)
    setPrivateKey(prev => (prev.length >= PRIVATE_KEY_LENGTH ? prev : prev + key))
  }

  // Remove one char with a light tap. Guarded inside the updater so a held
  // backspace stops buzzing (and the interval is cleared) once it's empty.
  const removeOneChar = () => {
    setIsDuplicate(false)
    setPrivateKey(prev => {
      if (!prev) {
        stopBackspace()
        return prev
      }
      ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
      return prev.slice(0, -1)
    })
  }

  // Press-and-hold backspace: delete immediately, then after a short hold start
  // repeat-deleting until release.
  const startBackspace = () => {
    removeOneChar()
    backTimer.current = setTimeout(() => {
      backInterval.current = setInterval(removeOneChar, 80)
    }, 350)
  }

  const stopBackspace = () => {
    if (backTimer.current) {
      clearTimeout(backTimer.current)
      backTimer.current = null
    }
    if (backInterval.current) {
      clearInterval(backInterval.current)
      backInterval.current = null
    }
  }

  // Clear any pending hold timers if the modal unmounts mid-press.
  useEffect(() => stopBackspace, [])

  const isFilled = privateKey.length === PRIVATE_KEY_LENGTH

  const onDone = async () => {
    if (!isFilled || isLoading) return
    let derivedAddress = null
    try {
      derivedAddress = privateKeyToAccount('0x' + privateKey).address
    } catch (e) {
      setMode(MODE.ERROR)
      return
    }
    // Reject before doing any work if this address is already tracked.
    if (accountList.some((a) => lowerCase(a?.address) === lowerCase(derivedAddress))) {
      setIsDuplicate(true)
      return
    }
    setIsLoading(true)
    // Resolve the on-chain address book name (async) — if the address is
    // already known to the network and the user hasn't customized the
    // suggestion, prefer the resolved alias.
    const bookName = await fetchAddressBookName(derivedAddress)
    const finalName = (accountName === defaultAccountName && bookName) ? bookName : accountName
    if (finalName !== accountName) setAccountName(finalName)
    const evmAccount = await onSubmit?.(privateKey, finalName)
    setIsLoading(false)
    if (evmAccount) {
      setAccount(evmAccount)
      setMode(MODE.SUCCESS)
      onSuccess?.()
    } else {
      setMode(MODE.ERROR)
    }
  }

  // Back button behaviour depends on the state. From the post-Done error states
  // (invalid key, or duplicate address) the user wants to fix the key, so back
  // returns to the keypad — NOT all the way out to the chooser — and clears the
  // old key so they re-enter from scratch. Only the pristine input state backs
  // out via the caller-provided onBack.
  const handleHeaderBack = () => {
    if (mode === MODE.ERROR) {
      setPrivateKey('')
      setMode(MODE.INPUT)
      return
    }
    if (isDuplicate) {
      setPrivateKey('')
      setIsDuplicate(false)
      return
    }
    onBack?.()
  }

  if (mode === MODE.SUCCESS) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('Content.createWallet')}
          leftIcon={images.UIV2.icons.enterPrivateKey}
        />
        {/* Manual key-in flow: show a plain summary — no copy / edit action
            buttons (omitting onCopyAddress + onEditName hides them). */}
        <CreatedAccountSummary
          address={account?.address}
          accountName={accountName}
          onChangeAccountName={setAccountName}
        />
      </MyViewPage>
    )
  }

  // Duplicate address — valid key, but the account already exists. Show a
  // concise message instead of the secp256k1 range explanation below (which is
  // only relevant to a malformed/out-of-range key).
  if (isDuplicate) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('Content.createWallet')}
          leftIcon={<HeaderLeft onBack={handleHeaderBack} />}
        />
        <TitleDrawer
          title={I18n.t('v2.accountModal.createPrivateKey')}
          leftIcon={images.UIV2.icons.enterPrivateKey}
        />
        <View style={styles.inputBox}>
          <MyText style={styles.inputDisplay}>
            {privateKey}
          </MyText>
        </View>
        <View style={styles.errorHeader}>
          <MyIcon uri={images.UIV2.icons.failed} variant='large' />
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.duplicateAccount')}
          </MyText>
        </View>

      </MyViewPage>
    )
  }

  if (mode === MODE.ERROR) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('Content.createWallet')}
          leftIcon={images.UIV2.icons.enterPrivateKey}
        />
        <TitleDrawer
          title={I18n.t('v2.addAccount.manualKeyGen')}
        />
        <View style={styles.inputBox}>
          <MyText style={styles.inputDisplay}>
            {privateKey}
          </MyText>
        </View>
        <MyText className='text-low' style={styles.counter}>
          {I18n.t('v2.accountModal.charactersRemaining', { count: PRIVATE_KEY_LENGTH - privateKey.length })}
        </MyText>
        <View style={styles.errorHeader}>
          <MyIcon uri={images.UIV2.icons.failed} variant='large' />
          <MyText variant='subTitle' fontWeight={700} className='text-red'>
            {I18n.t('v2.common.error')}
          </MyText>
        </View>
        <ScrollView
          style={styles.errorScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.errorScrollContent}
        >
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errReasonExceedsRange')}
          </MyText>
          <View style={[styles.codeBox, styles.codeBoxCentered]}>
            <MyText style={styles.codeText}>
              1 ≤ private key {'<'} secp256k1 order
            </MyText>
          </View>
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errHexFormatExplain')}
          </MyText>
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errConvertingRules')}
          </MyText>
          <View style={styles.codeBox}>
            <MyText style={styles.codeText}>• 0–9</MyText>
            <MyText style={styles.codeText}>• A = 10, B = 11, C = 12, D = 13, E = 14, F = 15</MyText>
          </View>
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errToConvertExample')}
          </MyText>
          <View style={styles.codeBox}>
            <MyText style={styles.codeText}>• 3f0a (4 digits)</MyText>
            <MyText style={styles.codeText}>= 3×16^3 + 15×16^2 + 0×16^1 + 10×16^0</MyText>
            <MyText style={styles.codeText}>= 16,138</MyText>
          </View>
          <View style={styles.codeBox}>
            <MyText style={styles.codeText}>• b92fe7 (6 digits)</MyText>
            <MyText style={styles.codeText}>= 11×16^5 + 9×16^4 + 2×16^3 + 15×16^2 + 14×16^1 + 7×16^0</MyText>
            <MyText style={styles.codeText}>= 12,136,423</MyText>
          </View>
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errMustRemainWithin')}
          </MyText>
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errHexFormatLabel')}
          </MyText>
          <View style={styles.codeBox}>
            <MyText style={styles.codeText}>
              FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
            </MyText>
          </View>
          <MyText className='text-medium' style={styles.errorParagraph}>
            {I18n.t('v2.accountModal.errProbabilityNote')}
          </MyText>
        </ScrollView>
      </MyViewPage>
    )
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('Content.createWallet')}
        leftIcon={images.UIV2.icons.enterPrivateKey}
        rightElement={isFilled ? (
          <MyButton
            variant='primary'
            isLoading={isLoading}
            onPress={onDone}
            size='small'
            label={I18n.t('Initial.done')}
          />
        ) : null}
      />
      <TitleDrawer
        title={I18n.t('v2.addAccount.manualKeyGen')}
      />
      <View style={styles.inputBox}>
        <MyText style={[styles.inputDisplay, !privateKey && styles.inputPlaceholder]}>
          {privateKey || I18n.t('v2.accountModal.enterYourPrivateKey')}
        </MyText>
      </View>
      <MyText className='text-low' style={styles.counter}>
        {I18n.t('v2.accountModal.charactersRemaining', { count: PRIVATE_KEY_LENGTH - privateKey.length })}
      </MyText>
      <View style={styles.keypad}>
        {KEYPAD.map((row, rowIdx) => (
          <View key={rowIdx} style={[styles.keypadRow, row.length < 5 && styles.keypadRowCentered]}>
            {row.map((key, colIdx) => {
              if (key === null) {
                return <View key={colIdx} style={styles.keySpacer} />
              }
              return (
                <TouchableOpacity
                  key={colIdx}
                  style={styles.key}
                  activeOpacity={0.6}
                  {...(key === 'BACK'
                    ? { onPressIn: startBackspace, onPressOut: stopBackspace }
                    : { onPress: () => handleKeyPress(key) })}
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
      </View>
    </MyViewPage>
  )
}

export default EnterPrivateKeyModal
