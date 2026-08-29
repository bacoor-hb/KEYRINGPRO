import React, { useState } from 'react'
import I18n from 'assets/Lang'
import { View, Keyboard, TouchableOpacity } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import images from 'assets/Image'
import { NavigationActions } from 'src/navigation/NavigationService'

import { isValidEVMAddressFormat } from 'common/function'
import CreatedAccountSummary from '../CreatedAccountSummary'
import { useDefaultViewOnlyName } from '../useDefaultAccountName'
import styles from './styles'

import InputCustom from 'frontend/Components/UI/InputCustom'

const MODE = { INPUT: 'input', SUCCESS: 'success' }

// Extract a plain address from a raw QR payload (handles EIP-681 `ethereum:` URIs).
// Same parsing as the send-token receive-address field.
const getAddressFromQR = (raw) => {
  try {
    const parts = (raw || '').split(':')
    const address = parts[1] || parts[0]
    if (address?.startsWith('0x')) {
      const [, queryString] = address.split('?')
      if (queryString) {
        const params = new URLSearchParams(queryString)
        return params.get('address') || params.get('from') || address.slice(0, 42)
      }
      return address.slice(0, 42)
    }
    return address
  } catch (error) {
    return raw
  }
}

// Register an EVM address as a view-only account. Mirrors ImportAccountModal
// but takes a plain address (no private key) and never strips a leading 0x —
// an address keeps its 0x prefix.
const RegisterAccountModal = ({ onSubmit, onSuccess, onEditName, onCopyAddress }) => {
  const [mode, setMode] = useState(MODE.INPUT)
  const [addressInput, setAddressInput] = useState('')
  const [registerFailed, setRegisterFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [account, setAccount] = useState(null)
  const defaultAccountName = useDefaultViewOnlyName()
  const [accountName, setAccountName] = useState(defaultAccountName)

  const handleChangeText = (next) => {
    setRegisterFailed(false)
    setAddressInput(next.replace(/\s+/g, ''))
  }

  // Scan a QR code into the address field — mirrors the send-token screen: dismiss
  // the keyboard, open the camera screen, and feed the parsed address back.
  const handleScanAddress = () => {
    Keyboard.dismiss()
    NavigationActions.navigate('qrCodeScreen', {
      setQrCode: (raw) => handleChangeText(getAddressFromQR(raw) || '')
    })
  }

  const isFilled = isValidEVMAddressFormat(addressInput)
  // Two distinct errors, shown in two distinct spots (mirrors RegisterAddress):
  //  - a malformed address while typing → inline inside the input (isError/errMessage)
  //  - a failed submit (address valid but already tracked / duplicate) → below the input
  const isInvalidFormat = addressInput.length > 0 && !isFilled
  const formatError = isInvalidFormat ? I18n.t('v2.accountModal.invalidAddressFormat') : ''
  const duplicateError = registerFailed ? I18n.t('v2.accountModal.duplicateAccount') : ''

  const onRegister = async () => {
    if (!isFilled || isLoading) return
    setIsLoading(true)
    const evmAccount = await onSubmit?.(addressInput, accountName)
    setIsLoading(false)
    if (evmAccount) {
      setAccount(evmAccount)
      setMode(MODE.SUCCESS)
      onSuccess?.()
    } else {
      setRegisterFailed(true)
    }
  }

  if (mode === MODE.SUCCESS) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.accountModal.registerAccount')}
          leftIcon={images.UIV2.icons.accountImport}
        />
        <CreatedAccountSummary
          title={I18n.t('v2.accountModal.registeredAccount')}
          addressLabel={I18n.t('v2.accountModal.accountAddress')}
          address={account?.address}
          accountName={accountName}
          onChangeAccountName={setAccountName}
          onCopyAddress={onCopyAddress}
          onEditName={onEditName ? () => onEditName(account, accountName, setAccountName) : undefined}
        />
      </MyViewPage>
    )
  }

  return (
    <View
      style={{ flex: 1 }}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) Keyboard.dismiss()
      }}
    >
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.accountModal.registerAccount')}
          leftIcon={images.UIV2.icons.accountImport}
          rightElement={isFilled ? (
            <MyButton
              variant='primary'
              isLoading={isLoading}
              onPress={onRegister}
              size='small'
              label={I18n.t('Initial.register')}
            />
          ) : null}
        />
        <View style={styles.inputRow}>
          <InputCustom
            isError={!!formatError}
            errMessage={formatError}
            typeInput='area'
            value={addressInput}
            onChangeText={handleChangeText}
            maxLength={42}
            placeholder={I18n.t('v2.accountModal.enter0xAddress')}
            // The placeholder wraps to 2 lines; without a fixed min height the
            // multiline field shrinks from 2 lines to 1 the instant the user
            // types (1-line content), shifting the layout. Reserve 2 lines and
            // top-align so the box height stays constant whether the 2-line
            // placeholder or the 1-line value is showing.
            textAlignVertical='center'
            containerConfig={{ style: styles.inputFlex }}
            inputConfig={{ style: styles.inputTextArea }}
            inputWrapperConfig={{ style: styles.inputWrapperArea }}
          />

          {/* Scan button sits OUTSIDE InputCustom (not as its rightIcon) so the
            field's bottom border stops at the input and doesn't run under the
            icon. Wrapped in a fixed-height box so it stays centered on the input
            row even when the error message appears below the field. It only shows
            while the field is empty — once an address is entered (typed, pasted or
            scanned) it disappears and the input takes the full width as before. */}
          {!addressInput ? (
            <View style={styles.scanBtnWrap}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.scanBtn}
                onPress={handleScanAddress}
              >
                <MyIcon variant='small' uri={images.UIV2.icons.qrScan} resizeMode='contain' />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        {duplicateError ? (
          <StatusMessage
            variant='error'
            message={duplicateError}
            style={styles.errorRow}
          />
        ) : null}
      </MyViewPage>
    </View>
  )
}

export default RegisterAccountModal
