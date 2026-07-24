import React, { useState } from 'react'
import I18n from 'assets/Lang'
import { View, TouchableOpacity, Keyboard } from 'react-native'
import { useSelector } from 'react-redux'
import { privateKeyToAccount } from 'viem/accounts'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import { Colors } from 'common/styles'
import { lowerCase } from 'common/function'
import CreatedAccountSummary from '../CreatedAccountSummary'
import useDefaultAccountName, { fetchAddressBookName } from '../useDefaultAccountName'
import styles from './styles'
import MyInput from 'frontend/Components/UI/MyInput'

const PRIVATE_KEY_LENGTH = 64
const MODE = { INPUT: 'input', SUCCESS: 'success' }

const HEX_ONLY = /^[0-9a-fA-F]*$/

const ImportAccountModal = ({ onSubmit, onSuccess, onEditName, onCopyAddress }) => {
  const [mode, setMode] = useState(MODE.INPUT)
  const [privateKey, setPrivateKey] = useState('')
  const [importFailed, setImportFailed] = useState(false)
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [account, setAccount] = useState(null)
  const accountList = useSelector((s) => s.accountListRedux || [])
  const defaultAccountName = useDefaultAccountName()
  const [accountName, setAccountName] = useState(defaultAccountName)

  // Paste detection: if user adds >1 char in a single change, treat as paste
  // and strip a leading "0x"/"0X". Single-char typing is left untouched, so a
  // hand-typed "0x..." won't be stripped.
  const handleChangeText = (next) => {
    setImportFailed(false)
    setIsDuplicate(false)
    const isPaste = next.length - privateKey.length > 1
    if (isPaste && /^0x/i.test(next)) {
      next = next.slice(2)
    }
    setPrivateKey(next.replace(/\s+/g, ''))
  }

  const onClear = () => {
    setPrivateKey('')
    setImportFailed(false)
    setIsDuplicate(false)
  }

  const isValidHex = HEX_ONLY.test(privateKey)
  const isFilled = privateKey.length === PRIVATE_KEY_LENGTH && isValidHex
  // Show the error message either while the user is typing invalid characters,
  // or after a valid-looking key fails to import (invalid key or duplicate).
  const showError = (privateKey.length > 0 && !isValidHex) || importFailed || isDuplicate
  const errorMessage = isDuplicate ? I18n.t('v2.accountModal.duplicateAccount') : I18n.t('v2.accountModal.invalidPrivateKeyChars')

  const onImport = async () => {
    if (!isFilled || isLoading) return
    let derivedAddress = null
    try {
      derivedAddress = privateKeyToAccount('0x' + privateKey).address
    } catch (e) {
      setImportFailed(true)
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
      setImportFailed(true)
    }
  }

  if (mode === MODE.SUCCESS) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.addAccount.importAccount')}
          leftIcon={images.UIV2.icons.accountImport}
        />
        <CreatedAccountSummary
          title={I18n.t('v2.accountModal.importedAccount')}
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
          title={I18n.t('v2.addAccount.importAccount')}
          leftIcon={images.UIV2.icons.accountImport}
          rightElement={isFilled ? (
            <MyButton
              variant='primary'
              isLoading={isLoading}
              onPress={onImport}
              size='small'
              label={I18n.t('Initial.import')}
            />
          ) : null}
        />
        <View>
          <MyInput
            typeInput='area'
            value={privateKey}
            onChangeText={handleChangeText}
            placeholder={I18n.t('v2.accountModal.enterYourPrivateKey')}
            placeholderTextColor={Colors.TEXT_LOW}
            noErrorSpace
            autoFocus
            autoCapitalize='none'
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical='center'
            inputConfig={{ style: styles.inputTextArea }}
            inputWrapperConfig={{ style: styles.inputWrapperArea }}
            rightIcon={privateKey.length > 0 ? (
              <TouchableOpacity style={styles.clearBtn} onPress={onClear} activeOpacity={0.7}>
                <MyIcon uri={images.UIV2.icons.clear} variant='small' />
              </TouchableOpacity>
            ) : null}
          />
        </View>
        {showError ? (
          <View style={styles.errorRow}>
            <MyIcon uri={images.UIV2.icons.failed} variant='large' />
            <MyText className='text-medium' style={styles.errorMessage}>
              {errorMessage}
            </MyText>
          </View>
        ) : null}
      </MyViewPage>
    </View>
  )
}

export default ImportAccountModal
