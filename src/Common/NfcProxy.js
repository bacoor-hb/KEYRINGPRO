import React from 'react'
import { Platform, Vibration } from 'react-native'
import NfcManager, {
  NfcTech,
  NfcError
} from 'react-native-nfc-manager'
import I18n from 'assets/Lang'
import { DEFAULT_PASSWORD_NFC } from './constants/app'
import NFCSettingPopup from 'frontend/Components/NFCSettingPopup'
import { convertNFCPayloadTextToReadableText, isArrayWithData } from './function'
import { ethers } from 'ethers'

class ErrSuccess extends Error {}

class NfcProxy {
  async init () {
    const supported = await NfcManager.isSupported()
    if (supported) {
      await NfcManager.start()
    }
    return supported
  }

  async isEnabled () {
    return NfcManager.isEnabled()
  }

  async isSupported () {
    return NfcManager.isSupported()
  }

  async goToNfcSetting () {
    return NfcManager.goToNfcSetting()
  }

  async checkNFCScan (baseContainer) {
    const isSupported = await this.isSupported()
    const isEnabled = await this.isEnabled()
    if (!isSupported) {
      baseContainer.showAlert(I18n.t('NFC.doesNotSupportNFC'), '', { type: true })

      return false
    } else if (isSupported && !isEnabled) {
      Vibration.vibrate()

      const callBackFunction = async () => {
        baseContainer.closeModal()
      }

      const callBackBeforeCloseModal = async () => {
        baseContainer.closeModal()
      }

      baseContainer.popup = (
        <NFCSettingPopup
          callBackBeforeGoSetting={callBackFunction}
          callBackBeforeCloseModal={callBackBeforeCloseModal}
          closeModal={baseContainer.closeModal}
        />
      )
      baseContainer.popsitionPopup = 'center'
      baseContainer.swipeToClose = false
      baseContainer.openModal()

      return false
    } else {
      return true
    }
  }

  async checkNfcIsFromKeyringHardWalletWeb (ndefPayload) {
    // Check if nfc is from keyring hardwallet web
    if (isArrayWithData(ndefPayload.ndefMessage) && ndefPayload.ndefMessage.length === 3) {
      // const keyringHardWalletUrl = convertNFCPayloadTextToReadableText(ndefPayload.ndefMessage[0])
      const keyringHardWalletAddress = convertNFCPayloadTextToReadableText(ndefPayload.ndefMessage[1])
      const keyringHardWalletEncryptData = convertNFCPayloadTextToReadableText(ndefPayload.ndefMessage[2])

      return !!(ethers.utils.isAddress(keyringHardWalletAddress) && keyringHardWalletEncryptData)
    }
    return false
  }

  async getEncryptPrivateKeyFromNfcKeyringHardWallet (ndefPayload) {
    let keyringHardWalletEncryptData = ''
    if (ndefPayload?.ndefMessage?.[2]) {
      keyringHardWalletEncryptData = await convertNFCPayloadTextToReadableText(ndefPayload.ndefMessage[2])
    }
    return keyringHardWalletEncryptData
  }

  disableProtection = async (callbackDoneAndroid, callbackErrorAndroid) => {
    const result = false

    try {
      await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.Ndef], {
        alertMessage: I18n.t('NFC.keepCardStill')
      })

      try {
        const AUTH_TAG = [0x1b, ...DEFAULT_PASSWORD_NFC]
        await NfcManager.nfcAHandler.transceive(AUTH_TAG)

        const CHANGE_DEFAULT_PASSWORD = [0xa2, 0x85, 0x00, 0x00, 0x00, 0x00]
        await NfcManager.nfcAHandler.transceive(CHANGE_DEFAULT_PASSWORD)

        const SET_PACK = [0xa2, 0x86, 0x00, 0x00, 0x00, 0x00]
        await NfcManager.nfcAHandler.transceive(SET_PACK)

        const PROTECT_ADDRESS = [0xa2, 0x83, 0x04, 0x00, 0x00, 0xff]
        await NfcManager.nfcAHandler.transceive(PROTECT_ADDRESS)

        const ENABLE_PASSWORD = [0xa2, 0x84, 0x00, 0x05, 0x00, 0x00]
        await NfcManager.nfcAHandler.transceive(ENABLE_PASSWORD)

        if (Platform.OS === 'ios') {
          await NfcManager.setAlertMessageIOS(I18n.t('NFC.processedSuccessfully'))
        }

        !ISIOS && callbackDoneAndroid && callbackDoneAndroid()
      } catch (e) {
        if (ISIOS) {
          NfcManager.invalidateSessionWithErrorIOS(I18n.t('GlobalError.somethingWrongErr'))
        } else {
          callbackErrorAndroid && callbackErrorAndroid()
        }
      }
      NfcManager.cancelTechnologyRequest()
    } catch (ex) {
      // handleException(ex)
      !ISIOS && callbackErrorAndroid && callbackErrorAndroid()
    } finally {
      NfcManager.cancelTechnologyRequest()
    }

    return result
  }

  eraseNfcA = async ({ isEraseNfcA = false, format = true, callbackError, callbackDone }) => {
    const result = false

    try {
      await NfcManager.start()

      await NfcManager.requestTechnology([NfcTech.NfcA], {
        alertMessage: I18n.t('NFC.keepCardStill')
      })

      // Write Record 1 Empty
      if (isEraseNfcA) {
        const cmd = [
          0xA2, // WRITE
          0x04, // page
          0x03,
          0x00,
          0xFE,
          0x00
        ]

        await NfcManager.nfcAHandler.transceive(cmd)
        if (ISIOS) {
          await NfcManager.setAlertMessageIOS(I18n.t('NFC.erasedNFCKeyCardSuccessfully'))
        }
        callbackDone && callbackDone()
        return true
      }

      const cmdReadCC = [0x30, 0x03]
      const [size] = await NfcManager.nfcAHandler.transceive(
        cmdReadCC
      )

      const blocks = (size * 8) / 4

      for (let i = 0; i < blocks; i++) {
        const blockNo = i + 0x04 // user block starts from 0x04
        const cmdWriteZero = [0xa2, blockNo, 0x0, 0x0, 0x0, 0x0]
        await NfcManager.nfcAHandler.transceive(cmdWriteZero)
      }

      if (format) {
        const cmdNdefFormat = [0xa2, 0x04, 0x03, 0x00, 0xfe, 0x00]
        await NfcManager.nfcAHandler.transceive(cmdNdefFormat)
        if (ISIOS) {
          await NfcManager.setAlertMessageIOS(I18n.t('NFC.erasedNFCKeyCardSuccessfully'))
        }
        callbackDone && callbackDone()
      } else {
        NfcManager.cancelTechnologyRequest()
        callbackError && callbackError()
      }
    } catch (ex) {
      if (!(ex instanceof NfcError.UserCancel)) {
        callbackError && callbackError()
      }
    } finally {
      NfcManager.cancelTechnologyRequest()
    }

    return result
  }
}

export default new NfcProxy()
export { ErrSuccess }
