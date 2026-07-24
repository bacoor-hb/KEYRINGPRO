import React, { useState } from 'react'
import I18n from 'assets/Lang'
import { View, Keyboard } from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { pick, types, isErrorWithCode, errorCodes } from '@react-native-documents/picker'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'

import MyButton from 'frontend/Components/UI/MyButton'

import images from 'assets/Image'
import { pixelByHeight } from 'common/styles'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { decryptBackupFileContent, jsonStr2Obj, lowerCase, isObject, deepRemoveFields } from 'common/function'
import { storeDataToSecureStorage } from 'common/storage/secureStorage'
import { KEYSTORE } from 'common/constants/redux'
import { migrateAccountListToV2 } from 'common/wallet'
import { detectBackupFormat, parseBackupV2 } from 'common/backup'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { STANDARD_CHAIN } from 'common/constants/app'
import {
  hasPassword as vaultHasPassword,
  isUnlocked as vaultIsUnlocked,
  encryptPrivateKey as vaultEncryptPrivateKey
} from 'common/secureVault'
import styles from './styles'
import StatusMessage from '../UI/StatusMessage'
import ScrollViewBlurHeader from '../UI/ScrollViewBlurHeader'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import InputCustom from '../UI/InputCustom'

const MODE = { INPUT: 'input', SUCCESS: 'success', ERROR: 'error' }

// Pick a backup file via the native picker. Returns { name, content } on
// success, null if the user cancelled, or throws on read errors. Run this
// BEFORE opening the modal — on iOS the file picker conflicts with a freshly
// presented modal and the modal can fail to appear after the picker dismisses.
export const pickBackupFile = async () => {
  try {
    const [res] = await pick({ type: [types.plainText] })
    const split = res.uri.split('/')
    const name = split.pop()
    const dir = split.pop()
    let realPath = ISIOS ? `${RNFS.TemporaryDirectoryPath}${dir}/${name}` : res.uri
    if (ISIOS && realPath) {
      realPath = decodeURIComponent(realPath)
    }
    const content = await RNFS.readFile(realPath, 'utf8')
    return { name: (res.name || name).replace(/\.txt$/, ''), content }
  } catch (err) {
    if (isErrorWithCode(err) && err?.code === errorCodes.OPERATION_CANCELED) {
      return null
    }
    throw err
  }
}

const RestoreFromFileModal = ({ onSuccess, initialFileName = '', initialFileContent = '' }) => {
  // Fallback for the full-screen error mode when the failure has no decrypt/parse
  // message of its own. Computed here (not at module load) so it resolves in the
  // current locale.
  const DEFAULT_ERROR_MESSAGE = I18n.t('v2.restore.couldNotRestoreFile')
  const [mode, setMode] = useState(MODE.INPUT)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [fileName] = useState(initialFileName)
  const [fileContent] = useState(initialFileContent)
  // Message shown on the full-screen ERROR mode (the decrypt/parse reason).
  const [errorMessage, setErrorMessage] = useState('')

  const onChangePassword = (text) => {
    setPassword(text)
  }

  const onRestore = async () => {
    if (!fileContent || !password || isLoading) return
    setIsLoading(true)
    try {
      const format = detectBackupFormat(fileContent)

      // Flatten to a raw account list compatible with migrateAccountListToV2.
      // v2 envelope stores accounts under payload.accounts; legacy stores
      // either listAccountsSort or chain-grouped arrays via g.data.
      let rawAccountList = []
      // V2 backups also carry the user's active chains + per-account token list
      // so the restored wallet shows the same chains/tokens without a refetch.
      let backupActiveEvmChainIds = []
      let backupAccountTokenList = null
      if (format === 'v2') {
        try {
          const payload = await parseBackupV2({ content: fileContent, password: password.toString() })
          rawAccountList = payload?.accounts || []
          backupActiveEvmChainIds = Array.isArray(payload?.activeEvmChainIds) ? payload.activeEvmChainIds : []
          backupAccountTokenList = isObject(payload?.accountTokenList, true) ? payload.accountTokenList : null
        } catch {
          setIsLoading(false)
          setErrorMessage(I18n.t('v2.restore.couldNotDecrypt'))
          setMode(MODE.ERROR)
          return
        }
      } else {
        const backupFileContent = decryptBackupFileContent(fileContent, password.toString())
        const backupFileContentObj = jsonStr2Obj(backupFileContent)
        if (!backupFileContentObj) {
          setIsLoading(false)
          setErrorMessage(I18n.t('v2.restore.couldNotDecrypt'))
          setMode(MODE.ERROR)
          return
        }
        if (backupFileContentObj?.listAccounts) {
          rawAccountList = backupFileContentObj?.listAccountsSort || []
        } else {
          rawAccountList = (backupFileContentObj || []).flatMap((g) => g?.data || [])
        }
      }

      // Encrypt PKs if the user has set a vault password during the preceding
      // SetPassword step. Vault is unlocked at this point, so encryption is
      // synchronous; otherwise PKs are stored plaintext (auto-migrated later
      // when a password is set).
      const shouldEncrypt = vaultHasPassword() && vaultIsUnlocked()
      const listPrivateKeyByAddress = {}
      rawAccountList.forEach((account) => {
        const addressLowerCase = lowerCase(account?.address || '')
        if (!addressLowerCase || listPrivateKeyByAddress[addressLowerCase] || !account?.privateKey) return
        listPrivateKeyByAddress[addressLowerCase] = shouldEncrypt
          ? vaultEncryptPrivateKey(account.privateKey)
          : account.privateKey
      })

      // Same V2 migration as App.js init (collapse EVM duplicates, collect chainIds).
      const { migratedList, activeEvmChainIds } = migrateAccountListToV2(rawAccountList)

      if (isObject(listPrivateKeyByAddress, true)) {
        storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, listPrivateKeyByAddress)
      }

      // Tear down any WalletConnect sessions from the previous wallet before we
      // swap in the restored accounts — otherwise old dApp sessions linger and
      // stay bound to accounts that no longer exist. Swallows its own errors.
      await ReduxService.disconnectAllWalletConnect()

      // Reset the wallet-data slices first so the restored backup starts from a
      // clean slate (no stale tokens / custom chains from a previous wallet).
      // App config + the vault password are preserved. accountList, active
      // chains and blockchainList are then repopulated from the backup below.
      ReduxService.resetWalletDataForRestore()

      ReduxService.callDispatchAction(StorageReduxAction.setAccountList(
        deepRemoveFields(migratedList, ['privateKey', 'privateKeyInput'])
      ))
      // V1 backups carry per-chain accounts so migrate yields chainIds. V2
      // backups are already collapsed (chain='evm', no chainId) but now persist
      // the user's active chains explicitly — prefer those, falling back to the
      // migrate-derived ids, then to the reset's default chain list.
      const restoredActiveChainIds = backupActiveEvmChainIds.length > 0
        ? backupActiveEvmChainIds
        : activeEvmChainIds
      if (restoredActiveChainIds.length > 0) {
        ReduxService.callDispatchAction(StorageReduxAction.setActiveEvmChainIds(restoredActiveChainIds))
      }

      // Restore the user's per-account token list from the backup so the
      // restored wallet shows the same tokens immediately (a refresh updates
      // balances/prices afterwards). resetWalletDataForRestore() cleared it.
      if (backupAccountTokenList) {
        ReduxService.callDispatchAction(StorageReduxAction.setAccountTokenList(backupAccountTokenList))
      }

      // Mark V2 migration done so App.js init skips re-migrating on next launch.
      const migrationFlags = ReduxService.getMigrationFlags()
      ReduxService.callDispatchAction(StorageReduxAction.setMigrationFlags({
        ...migrationFlags,
        accountListV2Migrated: true
      }))

      // Rebuild chain metadata for the restored active chains — the reset seeded
      // defaults; this fills any custom/removed-default chain (from API) so the
      // chain selector + balance fetch have data without waiting for a relaunch.
      await ReduxService.seedMissingActiveChains()

      // Refresh chain names/metadata from the API in the background — the seed
      // above uses hardcoded defaults, so chain names may be stale. Fire-and-
      // forget; it dispatches the updated blockchainList when done and the UI
      // re-renders then (no need to block the restore success flow).
      ReduxService.refeshBlockChainList()

      // Kick off a background token fetch for the first EVM account — it's the
      // one expanded by default at the top of the home account list, so it needs
      // a fresh balance to show right away (the restored snapshot may be stale or
      // absent). Fire-and-forget; it also flips the per-address token-loading
      // flag so the home list can show a loading icon for that account.
      const firstEvmAccount = migratedList.find((a) => a?.chain === STANDARD_CHAIN.Evm && a?.address)
      if (firstEvmAccount) {
        refreshAccountTokens(firstEvmAccount.address)
      }

      setIsLoading(false)
      setMode(MODE.SUCCESS)
      onSuccess?.()
    } catch (err) {
      setIsLoading(false)
      // Surface the decrypt/parse reason (e.g. "Could not decrypt bytes. Wrong
      // password?") on the full-screen error mode; fall back to a generic line.
      setErrorMessage(err?.message || DEFAULT_ERROR_MESSAGE)
      setMode(MODE.ERROR)
    }
  }

  if (mode === MODE.SUCCESS) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.welcome.restoreBackupFile')}
          leftIcon={images.UIV2.icons.home.restoreUsingBackupFile}
        />
        <StatusMessage
          variant='success'
          title={I18n.t('v2.restore.accountRestored')}
          titleConfig={{ className: 'text-green', variant: 'subTitle' }}
          style={styles.successStatus}
        />
      </MyViewPage>
    )
  }

  if (mode === MODE.ERROR) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.welcome.restoreBackupFile')}
          leftIcon={images.UIV2.icons.home.restoreUsingBackupFile}
        />
        <StatusMessage
          variant='error'
          title={I18n.t('MenuScreen.RestoreWalletScreen.walletCantRestore')}
          titleConfig={{ className: 'text-red', variant: 'subTitle' }}
          message={errorMessage || DEFAULT_ERROR_MESSAGE}
          style={styles.errorStatus}
        />
      </MyViewPage>
    )
  }

  const isFilled = password.length > 0 && fileContent.length > 0

  return (
    <View
      style={{ flex: 1 }}
      onTouchEnd={(e) => {
        if (e.target === e.currentTarget) Keyboard.dismiss()
      }}
    >
      <MyViewPage isUseDrawer style={styles.container}>
        <TitleDrawer
          absolute
          hasBlur
          title={I18n.t('v2.welcome.restoreBackupFile')}
          leftIcon={images.UIV2.icons.home.restoreUsingBackupFile}
          rightElement={isFilled ? (
            <MyButton
              variant='primary'
              isLoading={isLoading}
              onPress={onRestore}
              size='small'
              label={I18n.t('Initial.restore')}
            />
          ) : null}
        />
        <ScrollViewBlurHeader isUseDrawer>

          <View style={styles.passwordRow}>
            <View
              style={{ paddingTop: pixelByHeight(8), alignItems: 'center', justifyContent: 'center' }}
            >
              <MyTextTicker className='text-center'>{fileName}</MyTextTicker>
            </View>
            <InputCustom
              value={password}
              onChangeText={onChangePassword}
              placeholder={I18n.t('NFC.enterPass')}
              typeInput='password'
              autoCapitalize='none'
              autoCorrect={false}
              spellCheck={false}
              inputWrapperConfig={{
                style: {
                  minHeight: pixelByHeight(62)
                }
              }}
            />
            <StatusMessage
              iconConfig={{
                className: 'm-auto'
              }}
              title={I18n.t('v2.restore.important')}
              variant='warning'
              message={I18n.t('MenuScreen.RestoreWalletScreen.doNotLoadPrivateKey')}
            />
          </View>

          {/* <View style={styles.warningBox}>
          <MyIcon uri={images.UIV2.icons.warning} variant='large' />
          <View style={styles.warningContent}>
            <MyText className='text-white' style={styles.warningTitle}>{I18n.t('v2.restore.important')}</MyText>
            <MyText className='text-medium' style={styles.warningDesc}>
              {I18n.t('MenuScreen.RestoreWalletScreen.doNotLoadPrivateKey')}
            </MyText>
          </View>
        </View> */}
        </ScrollViewBlurHeader>
      </MyViewPage>
    </View>
  )
}

export default RestoreFromFileModal
