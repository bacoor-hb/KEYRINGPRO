import React from 'react'
import { Platform, Vibration } from 'react-native'
import NfcManager, {
  NfcError,
  NfcTech
} from 'react-native-nfc-manager'
import I18n from 'assets/Lang'
import NFCSettingPopup from 'frontend/Components/NFCSettingPopup'
import { checkNFCDataFormat, convertNFCPayloadTextToReadableText, decryptBackupFileContent, getAddressFromNFCData, getPrivateKeyHashFromNFCData, lowerCase, sleep } from './function'
import LoadingScanNFCPopup from 'frontend/Screen/KeyCardOperation/components/LoadingScanNFCPopup'
import ConfirmWriteNFCPopup from 'frontend/Screen/KeyCardOperation/components/ConfirmWriteNFCPopup'
import { getKeyCardPassword } from './wallet'
import { decryptAesGcm, derivePbkdf2, encryptAesGcm, PBKDF2_ITERATIONS_DEFAULT, randomBytes, SALT_LENGTH } from './cryptoVault'
import DeviceInfo from 'react-native-device-info'
import { ENVELOPE_VERSION } from './backup'
import { zeroAddress } from 'viem'

class NfcProxyV2 {
  constructor (baseContainer) {
    this.baseContainer = baseContainer
  }

  async init () {
    const supported = await NfcManager.isSupported()
    if (supported) {
      await NfcManager.start()
    }
    return supported
  }

  async isEnabled () {
    const isEnabled = await NfcManager.isEnabled()
    return isEnabled
  }

  async isSupported () {
    const isSupported = await NfcManager.isSupported()
    return isSupported
  }

  async goToNfcSetting () {
    return NfcManager.goToNfcSetting()
  }

  handleReadingError = (errorMessage = I18n.t('NFC.readOnlyCardErr')) => {
    this.baseContainer.showAlert(errorMessage, '', { type: true, timeout: 4000 })
    NfcManager.cancelTechnologyRequest().catch(() => 0)
  }

  async checkNFCIsReadyForScan () {
    const isSupported = await this.isSupported()
    const isEnabled = await this.isEnabled()
    if (!isSupported) {
      this.baseContainer.showAlert(I18n.t('NFC.doesNotSupportNFC'), '', { type: true })

      return false
    } else if (isSupported && !isEnabled) {
      Vibration.vibrate()

      const callBackFunction = async () => {
        this.baseContainer.closeDrawer()
      }

      const callBackBeforeCloseModal = async () => {
        this.baseContainer.closeDrawer()
      }

      this.baseContainer.openDrawer({
        addDrawer: true,
        backdrop: true,
        position: 'center',
        children: <NFCSettingPopup
          callBackBeforeGoSetting={callBackFunction}
          callBackBeforeCloseModal={callBackBeforeCloseModal}
          closeModal={this.baseContainer.closeSheet}
        />
      })
      return false
    } else {
      return true
    }
  }

  // Android-only: iOS shows its own system NFC sheet, so nothing is rendered there.
  // The scan UI is a drawer (MyDrawer/BottomSheet), so panning it down closes it —
  // onClose is the single place that cancels the pending technology request, and it
  // fires for both the Close button and the swipe gesture.
  openLoadingPopupNFCForAndroid = (title = I18n.t('NFC.readyToScan'), autoCloseTimming, options = {}) => {
    if (!ISIOS) {
      const {
        // allowEmptyCard = true,
        // allowHasDataCard = true,
        // allowReadOnlyCard = true,
        callbackReject = () => {}
      } = options

      autoCloseTimming && Vibration.vibrate()
      let timeout
      if (autoCloseTimming) {
        // Timed out waiting for a card: drop the pending request as well as the drawer.
        timeout = setTimeout(() => {
          this.closeLoadingPopupNFCForAndroid()
          NfcManager.cancelTechnologyRequest().catch(() => 0)
        }, autoCloseTimming)
      }

      // Guard so a read that completes right as the user dismisses the drawer doesn't
      // reject the caller after it already resolved.
      this.isScanDrawerOpen = true

      const onClose = () => {
        if (!this.isScanDrawerOpen) {
          return
        }
        this.isScanDrawerOpen = false
        clearTimeout(timeout)
        NfcManager.cancelTechnologyRequest().catch(() => 0)
        callbackReject()
      }

      // addDrawer: true — a keycard signature is almost always requested from a screen
      // that already has a drawer up (Send / Exchange / WalletConnect request). Without
      // it MyDrawerUI replaces the whole stack, unmounting the form we have to return to.
      //
      // height: 'auto' — the scan UI must hug its content, not fill the screen.
      // heightDrawer can't express that: MyDrawerUI does `drawer.heightDrawer ||
      // heightDrawerDefault`, so passing null/0 falls back to the near-fullscreen
      // default. drawer.style is merged AFTER that height, so it's what overrides it.
      this.baseContainer.openDrawer({
        addDrawer: true,
        backdrop: true,
        enablePanDownToClose: true,
        style: { height: 'auto' },
        onClose,
        children: (
          <LoadingScanNFCPopup
            closeModal={this.baseContainer.closeDrawer}
            title={title}
          />
        )
      })
    }
  }

  // Dismiss the Android scan drawer after a successful read (or a timeout), without
  // running the user-cancel path in onClose.
  closeLoadingPopupNFCForAndroid = () => {
    if (ISIOS || !this.isScanDrawerOpen) {
      return
    }
    this.isScanDrawerOpen = false
    this.baseContainer.closeDrawer()
  }

  async handleReadNfcCard (callbackOnReadingDone, options = {}) {
    const {
      allowEmptyCard = true,
      allowHasDataCard = true,
      allowReadOnlyCard = true,
      callbackReject = () => {}
    } = options

    try {
      const isNFCReady = await this.checkNFCIsReadyForScan()
      if (!isNFCReady) {
        return
      }

      this.openLoadingPopupNFCForAndroid(
        I18n.t('NFC.readyToScan'),
        0,
        options
      )

      await NfcManager.start()
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: I18n.t('NFC.keepCardStill')
      })

      const tagEvent = await NfcManager.getTag()
      tagEvent.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS(I18n.t('NFC.processedSuccessfully'))
      } else {
        this.closeLoadingPopupNFCForAndroid()
      }

      // if (allowEmptyCard) {
      //   if (tagEvent && (tagEvent.ndefMessage === undefined || tagEvent.ndefMessage.length === 0)) {
      //     this.baseContainer.showAlert(I18n.t('NFC.emptyCardErr'), '', { type: true, timeout: 4000 })
      //     NfcManager.cancelTechnologyRequest()
      //     return
      //   }
      // }

      // Case need to check empty card
      // Case card is empty => true => show error
      if (!allowEmptyCard) {
        if (tagEvent && (tagEvent.ndefMessage === undefined || tagEvent.ndefMessage.length === 0)) {
          this.baseContainer.showAlert(I18n.t('NFC.emptyCardErr'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }

        if (tagEvent && (!tagEvent.ndefMessage || (tagEvent.ndefMessage[0] && tagEvent.ndefMessage[0].tnf === 0))) {
          this.baseContainer.showAlert(I18n.t('NFC.emptyCardErr'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }
      }

      // Case need to check card is not empty
      // Case card is not empty => true => show error
      if (!allowHasDataCard) {
        if (tagEvent && tagEvent.ndefMessage && tagEvent.ndefMessage[0] && tagEvent.ndefMessage[0].tnf === 1) {
          this.baseContainer.showAlert(I18n.t('NFC.notEmptyCard'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }
      }

      // Case need to check read only card
      // case card is read only => true => show error
      if (!allowReadOnlyCard) {
        if (tagEvent && tagEvent.ndefStatus && tagEvent.ndefStatus.status === 3) {
          this.baseContainer.showAlert(I18n.t('NFC.thisIsLockedNFCKeyCard'), I18n.t('NFC.cardLocked'), { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }
      }

      if (tagEvent && (tagEvent.ndefMessage || (!tagEvent.ndefMessage && tagEvent?.ndefStatus?.status === 2))) {
        await sleep(500) // why 500 => because animationDuration of modal is 400ms
        callbackOnReadingDone && await callbackOnReadingDone(tagEvent)
        NfcManager.cancelTechnologyRequest()
      } else {
        if (tagEvent && tagEvent.ndefStatus && tagEvent.ndefStatus.status === 1) {
          this.baseContainer.showAlert(I18n.t('NFC.thisCardMayBeDamaged'), I18n.t('NFC.cardCannotBeOperated'), { type: true, timeout: 4000 })
        } else {
          this.baseContainer.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
        }

        NfcManager.cancelTechnologyRequest()
      }
    } catch (error) {
      // The scan drawer is only still up if we failed before the read completed
      // (NFC switched off mid-scan, tag lost, ...) — the success path already closed it.
      this.closeLoadingPopupNFCForAndroid()

      if (!(error instanceof NfcError.UserCancel)) {
        this.baseContainer.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
      }
      if (error instanceof NfcError.UserCancel) {
        callbackReject(error)
      }

      NfcManager.cancelTechnologyRequest()
    }
  }

  async handleReadNfcCardToLock (callbackOnReadingDone, options = {}) {
    try {
      const {
        allowEmptyCard = true,
        allowHasDataCard = true,
        allowReadOnlyCard = true
      } = options
      const isNFCReady = await this.checkNFCIsReadyForScan()
      if (!isNFCReady) {
        return
      }
      this.openLoadingPopupNFCForAndroid()
      await NfcManager.start()
      await NfcManager.requestTechnology([NfcTech.NfcA, NfcTech.Ndef], {
        alertMessage: I18n.t('NFC.keepCardStill')
      })

      const tagEvent = await NfcManager.getTag()
      tagEvent.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()

      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS(I18n.t('NFC.processedSuccessfully'))
      } else {
        this.closeLoadingPopupNFCForAndroid()
      }

      // Case need to check empty card
      // Case card is empty => true => show error
      if (!allowEmptyCard) {
        if (tagEvent && (!tagEvent.ndefMessage || (tagEvent.ndefMessage[0] && tagEvent.ndefMessage[0].tnf === 0))) {
          this.baseContainer.showAlert(I18n.t('NFC.emptyCardErr'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }
      }

      // Case need to check card is not empty
      // Case card is not empty => true => show error
      if (!allowHasDataCard) {
        if (tagEvent && tagEvent.ndefMessage && tagEvent.ndefMessage[0] && tagEvent.ndefMessage[0].tnf === 1) {
          this.baseContainer.showAlert(I18n.t('NFC.notEmptyCard'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }
      }

      // Case need to check read only card
      // case card is read only => true => show error
      if (!allowReadOnlyCard) {
        if (tagEvent && tagEvent.ndefStatus && tagEvent.ndefStatus.status === 3) {
          this.baseContainer.showAlert(I18n.t('NFC.thisIsLockedNFCKeyCard'), I18n.t('NFC.cardLocked'), { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }
      }

      if (tagEvent && tagEvent.ndefMessage) {
        await sleep(500) // why 500 => because animationDuration of modal is 400ms
        callbackOnReadingDone && await callbackOnReadingDone(tagEvent)
        NfcManager.cancelTechnologyRequest()
      } else {
        if (tagEvent && tagEvent.ndefStatus && tagEvent.ndefStatus.status === 1) {
          this.baseContainer.showAlert(I18n.t('NFC.thisCardMayBeDamaged'), I18n.t('NFC.cardCannotBeOperated'), { type: true, timeout: 4000 })
        } else {
          this.baseContainer.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
        }

        NfcManager.cancelTechnologyRequest()
      }
    } catch (error) {
      if (!(error instanceof NfcError.UserCancel)) {
        this.baseContainer.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
      }
    }
  }

  onLockCard=() => {
    const callbackOnReadingDone = async (tagEvent) => {
      const callbackOnLockDone = async (tagEvent) => {
        this.baseContainer.showAlert(null, I18n.t('NFC.cardLocked'), { timeout: 4000 })
      }
      this.baseContainer.closeModal()

      if (tagEvent && tagEvent.ndefStatus && tagEvent.ndefStatus.status === 3) {
        await callbackOnLockDone(tagEvent)

        NfcManager.cancelTechnologyRequest()
      } else {
        await this.handleLockCard(tagEvent, callbackOnLockDone)
      }
    }
    this.baseContainer.closeModal()
    this.handleReadNfcCardToLock(callbackOnReadingDone)
  }

  onHandleLockCardNfc = () => {
    this.baseContainer.popup = (
      <ConfirmWriteNFCPopup
        title={I18n.t('NFC.warning')}
        subTitle={I18n.t('NFC.desLockKeyCard')}
        buttonText={I18n.t('NFC.lock')}
        isLock
        isOtherType
        isUsedText
        address=''
        writeMessageOnCard={this.onLockCard}
        closeModal={this.baseContainer.closeModal}
      />
    )
    this.baseContainer.popsitionPopup = 'center'
    this.baseContainer.swipeToClose = false
    this.baseContainer.openModal()
  }

  async handleLockCard (tagEvent, callbackOnLockDone, options = {}) {
    try {
      const isNFCReady = await this.checkNFCIsReadyForScan()
      if (!isNFCReady) {
        return
      }
      // Start NFC scanning

      tagEvent.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()

      if (tagEvent && tagEvent.ndefMessage) {
        if (ISIOS) {
          await NfcManager.ndefHandler.makeReadOnly()
          await sleep(500) // why 500 => because animationDuration of modal is 400ms
          callbackOnLockDone && await callbackOnLockDone(tagEvent)
          NfcManager.cancelTechnologyRequest()
        } else {
          const command = [0xA2, 2, 0x00, 0x00, 0xFF, 0xFF] // Locks memory pages 3–15
          // Transceive the lock command
          await NfcManager.transceive(command)
          await sleep(500) // why 500 => because animationDuration of modal is 400ms
          callbackOnLockDone && await callbackOnLockDone(tagEvent)
          NfcManager.cancelTechnologyRequest()
        }
      } else {
        this.baseContainer.showAlert(I18n.t('NFC.thisCardMayBeDamaged'), I18n.t('NFC.cardCannotBeOperated'), { type: true, timeout: 4000 })
        NfcManager.cancelTechnologyRequest()
      }
    } catch (error) {
      // logDebug({ error })
      this.baseContainer.showAlert(I18n.t('NFC.thisCardMayBeDamaged'), I18n.t('NFC.cardCannotBeOperated'), { type: true, timeout: 4000 })
      NfcManager.cancelTechnologyRequest()
    }
  }

  async getPrivateKeyFromNFC (userAddress, passwordFile, options = {}) {
    const { callbackOnUserCancel, callbackReject } = options
    try {
      passwordFile = passwordFile || getKeyCardPassword(userAddress)
      let privateKey = ''
      const callbackOnReadingDone = async (tagEvent) => {
        const privateKeyHash = convertNFCPayloadTextToReadableText(tagEvent.ndefMessage[0])
        const isCorrectFormat = checkNFCDataFormat(tagEvent.ndefMessage[0], privateKeyHash)
        const addressFromNFCData = getAddressFromNFCData(privateKeyHash)

        if (!isCorrectFormat) {
          this.baseContainer.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
        }

        if (privateKeyHash) {
          const dataEncode = getPrivateKeyHashFromNFCData(privateKeyHash)
          privateKey = await this.decryptDataNfc(dataEncode, passwordFile || '')

          if (lowerCase(addressFromNFCData) !== lowerCase(userAddress) || !privateKey) {
            privateKey = ''
            this.baseContainer.showAlert(I18n.t('NFC.nfcNotMatchAccountErr'), '', { type: true, timeout: 4000 })
            NfcManager.cancelTechnologyRequest()
          }
        } else {
          callbackOnUserCancel && callbackOnUserCancel()
        }
      }
      await this.handleReadNfcCard(callbackOnReadingDone,
        {
          allowEmptyCard: false,
          callbackReject
        })
      return privateKey
    } catch (error) {
      this.baseContainer.showAlert(I18n.t('NFC.nfcNotMatchAccountErr'), '', { type: true, timeout: 4000 })
      NfcManager.cancelTechnologyRequest()
      return ''
    }
  }

  createExportDataNfc= async (data = { address: zeroAddress, data: '' }, password) => {
    const salt = randomBytes(SALT_LENGTH)
    const key = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS_DEFAULT)
    const { iv, tag, ciphertext } = encryptAesGcm(JSON.stringify(data?.data), key)

    const envelope = {
      version: ENVELOPE_VERSION,
      createdAt: new Date().toISOString(),
      appVersion: `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`,
      gcm: {
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        iterations: PBKDF2_ITERATIONS_DEFAULT,
        salt: salt.toString('base64')
      },
      address: data.address
    }

    return JSON.stringify(envelope)
  }

  decryptDataNfc= async (content, password) => {
    try {
      const parsed = JSON.parse(content)

      const env = parsed?.gcm
      if (!env) {
        return decryptBackupFileContent(content, password)
      }

      const key = await derivePbkdf2(
        password,
        Buffer.from(env.salt, 'base64'),
        env.iterations
      )
      const plaintext = decryptAesGcm({
        iv: Buffer.from(env.iv, 'base64'),
        tag: Buffer.from(env.tag, 'base64'),
        ciphertext: Buffer.from(env.ciphertext, 'base64')
      }, key)
      return JSON.parse(plaintext)
    } catch (error) {
      try {
        return decryptBackupFileContent(content, password)
      } catch (error) {
        return ''
      }
    }
  }

  detectVersionFileNfc= (content) => {
    try {
      const parsed = JSON.parse(content)
      return parsed?.version || 1
    } catch (error) {
      return 1
    }
  }
}

export default NfcProxyV2
