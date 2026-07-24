import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import Page from './page'
import CopyNFCTag from './Component/CopyNFCTag'
import { checkNFCDataFormat, convertNFCPayloadTextToReadableText, decryptBackupFileContent, decryptPrivateKeyFromKeyringHardwalletWeb, getAddressFromNFCData, getPrivateKeyHashFromNFCData, lowerCase, sleep, verifyCorrectWalletByPk } from 'common/function'
import EnterPassShowPrivateKey from './Component/EnterPassShowPrivateKey'
import ViewPrivateKey from '../AccountDetail/Component/ViewPrivateKey'
import NfcProxy from 'common/NfcProxy'
import I18n from 'assets/Lang'
import NfcManager, { NfcTech, Ndef, NfcError } from 'react-native-nfc-manager'
import ReduxService from 'common/redux'
import EraserNFC from './Component/EraserNFC'
import { Platform } from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker'
import { decryptStringAesGcm } from 'common/cryptoVault'

class NFCTagOperationScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.infoNFC = null
  }

   openLoadingPopupForAndroid = (title = I18n.t('NFC.readyToScan'), autoCloseTimming, isTapCard = false, subTitle, numSteps = 0, currentStep = 1) => {
     this.nfcProxy.openLoadingPopupNFCForAndroid(
       I18n.t('NFC.readyToScan'),
       0,
       {}
     )
   }

  getFilePath = async () => {
    try {
      const [res] = await pick({
        type: [types.plainText]
      })
      return res
    } catch (err) {
      if (isErrorWithCode(err) && err?.code === errorCodes.OPERATION_CANCELED) {
        return false
      } else {
        this.showAlert(I18n.t('v2.home.cantReadFile'), '', { type: true, timeout: 4000 })
        return false
      }
    }
  }

  onShowFilePicker = async () => {
    const fileObj = await this.getFilePath()
    if (fileObj) {
      const split = fileObj.uri.split('/')
      const fileName = split.pop()
      const diviceDir = split.pop()
      let realFilePath = ISIOS ? `${RNFS.TemporaryDirectoryPath}${diviceDir}/${fileName}` : fileObj.uri
      if (ISIOS && realFilePath) {
        realFilePath = decodeURIComponent(realFilePath)
      }
      try {
        const fileContent = await RNFS.readFile(realFilePath, 'utf8')
        return fileContent
      } catch (_err) {
        this.showAlert(I18n.t('v2.file.cantReadFileContent'), '', { type: true, timeout: 4000 })
        return false
      }
    }
    return false
  }

  checkInvalidCardId=async (cardId) => {
    try {
      const LIST_URL_API = [
        'https://api-airdropband.w3w.app',
        'https://api-airdropband.keyring.app',
        'https://api-hardwallet.w3w.app',
        'https://api-hardwallet.keyring.app'
      ]

      const arrPromise = LIST_URL_API.map(async (url) => {
        try {
          const res = await fetch(`${url}/nfc-card/${cardId}/check-valid-card`)
          const data = await res.json()
          return data?.data
        } catch (error) {
          return null
        }
      })
      const result = await Promise.all(arrPromise)

      return result.some(item => item?.isValid || false)
    } catch (error) {
      return false
    }
  }

  handleCopyNFCTag =async (address, nfcData) => {
    const callback = async () => {
      // Dismiss the CopyNFCTag drawer first: on Android the scan UI is itself a drawer,
      // and on iOS the system sheet would otherwise come up over this one.
      this.closeDrawer()
      await sleep(500) // drawer close animation is 400ms

      try {
        const isNFCReady = await this.nfcProxy.checkNFCIsReadyForScan()
        if (!isNFCReady) {
          return
        }

        // Android has no system NFC UI — without this the user taps a card against a
        // screen that shows nothing.
        this.nfcProxy.openLoadingPopupNFCForAndroid()

        await NfcManager.start()
        await NfcManager.requestTechnology(NfcTech.Ndef, {
          alertMessage: I18n.t('NFC.keepCardStill')
        })

        const tag = await NfcManager.getTag()
        tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()

        const isLocked = tag?.ndefStatus?.status === 3
        const isEmpty = !tag?.ndefMessage || tag.ndefMessage[0]?.tnf === 0

        if (isLocked) {
          this.nfcProxy.closeLoadingPopupNFCForAndroid()
          this.showAlert(I18n.t('NFC.thisIsLockedNFCKeyCard'), I18n.t('NFC.cardLocked'), { type: true, timeout: 4000 })
          return
        }

        // Only a blank card may be written to, so an in-use keycard can't be clobbered.
        if (!isEmpty) {
          this.nfcProxy.closeLoadingPopupNFCForAndroid()
          this.showAlert(I18n.t('NFC.notEmptyCard'), '', { type: true, timeout: 4000 })
          return
        }

        await NfcManager.ndefHandler.writeNdefMessage(Ndef.encodeMessage([Ndef.textRecord(nfcData)]))

        if (Platform.OS === 'ios') {
          await NfcManager.setAlertMessageIOS(I18n.t('NFC.processedSuccessfully'))
        } else {
          this.nfcProxy.closeLoadingPopupNFCForAndroid()
        }
        this.showAlert(I18n.t('NFC.copyNFCCardSuccess'), '', { timeout: 4000 })
      } catch (error) {
        this.nfcProxy.closeLoadingPopupNFCForAndroid()
        // Dismissing the scan sheet is not an error — alerting on it is the stray
        // "Error / Error" toast users were seeing.
        if (!(error instanceof NfcError.UserCancel)) {
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
        }
      } finally {
        NfcManager.cancelTechnologyRequest().catch(() => 0)
      }
    }

    this.openDrawer({
      children: (
        <CopyNFCTag callback={callback} />
      )
    })
  }

  handleReadNFCTag = () => {
    const callback = async () => {
      await this.closeDrawer()
      // delay 500ms for closing drawer
      await sleep(500)

      try {
        const isNFCReady = await this.nfcProxy.checkNFCIsReadyForScan()
        if (!isNFCReady) {
          return
        }

        this.nfcProxy.openLoadingPopupNFCForAndroid()

        await NfcManager.start()
        await NfcManager.requestTechnology(NfcTech.Ndef, {
          alertMessage: I18n.t('NFC.keepCardStill')
        })

        const ndefPayload = await NfcManager.getTag()
        ndefPayload.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()
        this.nfcProxy.closeLoadingPopupNFCForAndroid()

        if (ndefPayload && (!ndefPayload.ndefMessage || (ndefPayload.ndefMessage[0] && ndefPayload.ndefMessage[0].tnf === 0))) {
          this.showAlert(I18n.t('NFC.emptyCardErr'), '', { type: true, timeout: 4000 })
          return
        }

        if (!ndefPayload || !ndefPayload.ndefMessage) {
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
          return
        }

        const privateKeyHash = convertNFCPayloadTextToReadableText(ndefPayload.ndefMessage[0])
        const address = getAddressFromNFCData(privateKeyHash)
        const isCorrectFormat = checkNFCDataFormat(ndefPayload.ndefMessage[0], privateKeyHash)

        if (!isCorrectFormat || !privateKeyHash) {
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
          return
        }
        // The write step opens its own NFC session, so this one has to be fully torn
        // down first — otherwise iOS rejects the second requestTechnology immediately
        // and the copy drawer's callback lands straight in its error branch.
        await NfcManager.cancelTechnologyRequest().catch(() => 0)
        await sleep(500)
        this.handleCopyNFCTag(address, privateKeyHash)
        return
      } catch (error) {
        this.nfcProxy.closeLoadingPopupNFCForAndroid()
        if (!(error instanceof NfcError.UserCancel)) {
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
        }
      }

      NfcManager.cancelTechnologyRequest().catch(() => 0)
    }

    this.openDrawer({
      children: (
        <CopyNFCTag callback={callback} isReadCopy />
      )
    })
  }

  handleEnterPassShowPrivateKey =async () => {
    this.nfcProxy.handleReadNfcCard(async (tagEvent) => {
      const isNfcFromKHW = await NfcProxy.checkNfcIsFromKeyringHardWalletWeb(tagEvent)

      const privateKeyEncryptFromKHW = await NfcProxy.getEncryptPrivateKeyFromNfcKeyringHardWallet(tagEvent)
      const privateKeyHash = convertNFCPayloadTextToReadableText(tagEvent.ndefMessage[0])
      const isCorrectFormat = checkNFCDataFormat(tagEvent.ndefMessage[0], privateKeyHash) || isNfcFromKHW

      if (!isCorrectFormat && !isNfcFromKHW) {
        this.closeDrawer()
        this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
      }

      // Show private key from KEYRING HARD WALLET WEB
      if (isNfcFromKHW) {
        const isInvalidCardId = await this.checkInvalidCardId(tagEvent.id)
        if (!isInvalidCardId) {
          this.closeDrawer()
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
          return
        }
        const privateKeyDecryptFromAirDropBandWeb = decryptPrivateKeyFromKeyringHardwalletWeb(privateKeyEncryptFromKHW, '')

        const validPk = verifyCorrectWalletByPk(privateKeyDecryptFromAirDropBandWeb)

        if (privateKeyDecryptFromAirDropBandWeb && validPk) {
          setTimeout(() => {
            this.handleShowPrivateKey(privateKeyDecryptFromAirDropBandWeb)
          }, 500)
        } else {
          const infoNFC = {
            privateKeyEncryptFromKHW: privateKeyEncryptFromKHW,
            isNfcFromKHW
          }

          this.openDrawer({
            children: (
              <EnterPassShowPrivateKey infoNFC={infoNFC} _this={this} />
            )
          })
        }
        return
      }

      // Show private key from KEYRING PRO APP
      if (privateKeyHash) {
        const address = getAddressFromNFCData(privateKeyHash)
        const accountListRedux = ReduxService.getReduxDataByKey('accountListRedux') || []
        const privateKeyHashWithoutAddress = getPrivateKeyHashFromNFCData(privateKeyHash)

        const findAccount = accountListRedux.find(item => {
          return item && item?.passwordFile && lowerCase(item?.address) === lowerCase(address)
        })

        if (findAccount) {
          let privateKeyFromHash
          const privateKeyFromHashAES = decryptBackupFileContent(privateKeyHashWithoutAddress, findAccount.passwordFile.toString())
          const privateKeyFromHashAESGCM = await decryptStringAesGcm(privateKeyHashWithoutAddress, findAccount.passwordFile.toString())

          if (privateKeyFromHashAES) {
            privateKeyFromHash = privateKeyFromHashAES
          } else {
            privateKeyFromHash = privateKeyFromHashAESGCM
          }

          const addressFromHash = getAddressFromNFCData(privateKeyHash)

          if (addressFromHash !== address || !privateKeyFromHash) {
            this.showAlert(I18n.t('NFC.accountNotExistErr'), '', { type: true, timeout: 4000 })
            NfcManager.cancelTechnologyRequest()

            return
          }
          const infoNFC = {
            passwordFile: findAccount.passwordFile,
            privateKeyFromHash,
            passwordFileEncode: findAccount.passwordFileEncode
          }

          this.openDrawer({
            children: (
              <EnterPassShowPrivateKey infoNFC={infoNFC} _this={this} />
            )
          })
        } else {
          const fileContent = await this.onShowFilePicker()

          if (fileContent) {
            const infoNFC = {
              passwordFileEncode: fileContent,
              dataNFC: privateKeyHashWithoutAddress
            }

            this.openDrawer({
              children: (
                <EnterPassShowPrivateKey isUseFile infoNFC={infoNFC} _this={this} />
              )
            })
          } else {
            NfcManager.cancelTechnologyRequest()
          }
        }
      }
    })
  }

  handleShowPrivateKey = (privateKey) => {
    this.openDrawer({
      children: (
        <ViewPrivateKey privateKey={privateKey} _this={this} />
      )
    })
  }

  handleEraserNFC = async () => {
    const isNFCReady = await NfcProxy.checkNFCScan(this)
    if (!isNFCReady && !ISIOS) {
      return
    }

    const callbackDone = async () => {
      this.closeDrawer()
      NfcManager.cancelTechnologyRequest().catch(() => 0)
      await sleep(500)
      this.showAlert(I18n.t('NFC.erasedNFCKeyCardSuccessfully'), '', { timeout: 4000 })
      // this.showAlert(I18n.t('NFC.processedSuccessfully'), '', { timeout: 4000 })
    }

    const callbackError = (error = {}) => {
      const { message } = error
      this.closeDrawer()
      if (message === I18n.t('NFC.thisIsLockedNFCKeyCard')) {
        this.showAlert(I18n.t('NFC.thisIsLockedNFCKeyCard'), I18n.t('NFC.cardLocked'), { type: true, timeout: 4000 })
      } else {
        this.showAlert(I18n.t('Initial.error'), '', { type: true, timeout: 4000 })
      }
      this.closeDrawer()
      NfcManager.cancelTechnologyRequest().catch(() => 0)
    }

    const callback = async () => {
      this.closeDrawer()
      // delay 500ms for closing drawer
      await sleep(500)
      setTimeout(() => {
        this.openLoadingPopupForAndroid()
      }, 400)

      await NfcProxy.eraseNfcA({ isEraseNfcA: true, callbackDone, callbackError })
      NfcManager.cancelTechnologyRequest().catch(() => 0)
    }

    this.openDrawer({
      children: (
        <EraserNFC callback={callback} />
      )
    })
  }

  render () {
    const Template = this.view
    return (
      <Template
        noFooter
        headerBlur
        _this={this}
        state={this.state}
        leftAction={this.onCancel}
      />
    )
  }
}

export default NFCTagOperationScreen
