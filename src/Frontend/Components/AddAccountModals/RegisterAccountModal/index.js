import React, { useState } from 'react'
import I18n from 'assets/Lang'
import { View, Keyboard } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import images from 'assets/Image'

import { isValidEVMAddressFormat } from 'common/function'
import CreatedAccountSummary from '../CreatedAccountSummary'
import { useDefaultViewOnlyName } from '../useDefaultAccountName'
import styles from './styles'

import InputCustom from 'frontend/Components/UI/InputCustom'

const MODE = { INPUT: 'input', SUCCESS: 'success' }

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
            inputConfig={{ style: styles.inputTextArea }}
            inputWrapperConfig={{ style: styles.inputWrapperArea }}
          />

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
