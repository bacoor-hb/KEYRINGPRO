import React from 'react'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'
import I18n from 'assets/Lang'
import * as RNFS from '@dr.pogodin/react-native-fs'
import {
  decryptBackupFileContent,
  convertNFCPayloadTextToReadableText,
  getAddressFromNFCData,
  getPrivateKeyHashFromNFCData,
  checkNFCDataFormat,
  decryptPrivateKeyFromKeyringHardwalletWeb,
  verifyCorrectWalletByPk
} from 'common/function'
import { connect } from 'react-redux'
import { chainType } from 'common/constants/chain'
import ModalRestoreFinish from './components/ModalRestoreFinish'
import ModalWrongPassword from './components/ModalWrongPassword'
import { bindActionCreators } from 'redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import NfcManager, { NfcTech, Ndef, NfcError } from 'react-native-nfc-manager'
import ModalPrivateKey from './components/ModalPrivateKey/index'
import { Platform, Vibration } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'

import ConfirmWriteNFCPopup from './components/ConfirmWriteNFCPopup/index'
import NfcProxy from 'common/NfcProxy'
import LoadingScanNFCPopup from './components/LoadingScanNFCPopup'
import SecureWindow from 'react-native-secure-window'
import { NavigationActions } from 'src/navigation/NavigationService'
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker'
class KeyCardOperation extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      activeSlide: 0,
      fileEncryptContent: '',
      fileName: '',
      isRestoring: false,
      enterPin: '',
      isAutoPlayBanner: true
    }
  }

  componentDidMount () {
    const { isShowPrivateKey = false } = this.props.route.params || {}
    if (isShowPrivateKey) {
      this.onHandleShowPrivateKey()
    }
  }

  componentWillUnmount () {
    try {
      SecureWindow.changeSecureWindow(false)
    } catch (error) {
      //
    }
  }

  getFilePath = async () => {
    try {
      const [res] = await pick({
        type: [types.plainText]
      })
      return res
    } catch (err) {
      if (isErrorWithCode(err) && err?.code === errorCodes.OPERATION_CANCELED) {
        NavigationActions.goBack()
        return false
      } else {
        this.showAlert(I18n.t('v2.home.cantReadFile'), '', { type: true, callback: () => NavigationActions.goBack() })
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
      RNFS.readFile(realFilePath, 'utf8')
        .then((fileContent) => {
          this.setState({
            fileName: fileObj.name.replace(/\.txt/, ''),
            fileEncryptContent: fileContent
          })
        }).catch(_err => {
          this.showAlert(I18n.t('v2.file.cantReadFileContent'), '', { type: true, callback: () => NavigationActions.goBack() })
        })
    }
  }

  onShowModalFinish = () => {
    this.popup = (
      <ModalRestoreFinish
        isRestoring={this.state.isRestoring}
        closeModal={this.closeModal} />
    )
    this.swipeToClose = false
    this.popsitionPopup = 'center'
    this.openModal()
  }

  onShowModalWrongPass = () => {
    const onResetPass = () => {
      this.setState({ enterPin: '' })
    }
    this.popup = (
      <ModalWrongPassword
        onResetPass={onResetPass}
        isRestoring={this.state.isRestoring}
        closeModal={this.closeModal} />
    )
    this.popsitionPopup = 'center'
    this.swipeToClose = false
    this.openModal()
  }

  onChangeEnterPIN = (value) => () => {
    const newEnterPin = this.state.enterPin + value
    this.setState({ enterPin: newEnterPin }, () => {
      newEnterPin.length === 4 && this.onRestore()
    })
  }

  showError = () => {
    this.showAlert(I18n.t('v2.file.cantRestoreBackup'), '', { type: true, timeout: 4000 })
    this.setState({
      enterPin: ''
    })
  }

  onDeleteNumber = () => () => {
    const newEnterPin = this.state.enterPin.slice(0, -1)
    this.setState({ enterPin: newEnterPin })
  }

  onEraseNFCCard = async () => {
    const isNFCReady = await NfcProxy.checkNFCScan(this)
    if (!isNFCReady && !ISIOS) {
      return
    }

    const callbackDone = () => {
      this.closeModal()
      this.showAlert(I18n.t('NFC.processedSuccessfully'), '', { timeout: 4000 })
      NfcManager.cancelTechnologyRequest().catch(() => 0)
    }

    const callbackError = (error = {}) => {
      const { message } = error
      this.closeModal()
      if (message === I18n.t('NFC.thisIsLockedNFCKeyCard')) {
        this.showAlert(I18n.t('NFC.thisIsLockedNFCKeyCard'), I18n.t('NFC.cardLocked'), { type: true, timeout: 4000 })
      } else {
        this.showAlert(I18n.t('Initial.error'), '', { type: true, timeout: 4000 })
      }
      this.closeModal()
      NfcManager.cancelTechnologyRequest().catch(() => 0)
    }

    const callback = async () => {
      if (ISIOS) {
        this.closeModal()
      } else {
        this.openLoadingPopupForAndroid()
      }

      await NfcProxy.eraseNfcA({ format: true, callbackDone, callbackError })
      NfcManager.cancelTechnologyRequest().catch(() => 0)
    }
    //
    this.popup = (
      <ConfirmWriteNFCPopup
        title={I18n.t('NFC.resetNFCKeyCard')}
        subTitle={I18n.t('NFC.makeSureEraseCard')}
        buttonText={I18n.t('NFC.resetNow')}
        isUsedText
        isDelete
        writeMessageOnCard={callback}
        closeModal={this.closeModal} />
    )
    this.popsitionPopup = 'center'

    this.swipeToClose = false
    this.openModal()
  }

  onHandleCopyNFC = async () => {
    try {
      const { accountListRedux } = this.props
      ISIOS && this.closeModal()

      const isNFCReady = await NfcProxy.checkNFCScan(this)
      if (!isNFCReady && !ISIOS) {
        return
      }

      this.openLoadingPopupForAndroid()

      await NfcManager.start()
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage: I18n.t('NFC.keepCardStill')
      })

      const ndefPayload = await NfcManager.getTag()
      ndefPayload.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()
      if (ndefPayload && (!ndefPayload.ndefMessage || (ndefPayload.ndefMessage[0] && ndefPayload.ndefMessage[0].tnf === 0))) {
        this.showAlert(I18n.t('NFC.emptyCardErr'), '', { type: true, timeout: 4000 })
        NfcManager.cancelTechnologyRequest()

        return
      }
      if (ndefPayload && ndefPayload.ndefMessage) {
        const privateKeyHash = await convertNFCPayloadTextToReadableText(ndefPayload.ndefMessage[0])
        const isCorrectFormat = checkNFCDataFormat(ndefPayload.ndefMessage[0], privateKeyHash)

        if (!isCorrectFormat) {
          this.closeModal()
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
          NfcManager.cancelTechnologyRequest()
          return
        }

        if (privateKeyHash) {
          const address = getAddressFromNFCData(privateKeyHash)

          const findAccount = accountListRedux.filter(item => {
            return (
              item &&
              item.passwordFile && (
                item?.address === address ||
                item?.rootAddress === address
              )
            )
          })[0]

          if (findAccount) {
            this.openConfirmWritePopupCopy(findAccount.address, privateKeyHash, findAccount)
          } else {
            this.showAlert(I18n.t('NFC.accountNotExistErr'), '', { type: true, timeout: 4000 })
            NfcManager.cancelTechnologyRequest()
          }
        } else {
          NfcManager.cancelTechnologyRequest()
        }
      }
    } catch (error) {
      //
    }
  }

  openLoadingPopupForAndroid = (title = I18n.t('NFC.readyToScan'), autoCloseTimming, isTapCard = false, subTitle, numSteps = 0, currentStep = 1) => {
    if (!ISIOS) {
      autoCloseTimming && Vibration.vibrate()
      let timeout
      if (autoCloseTimming) {
        timeout = setTimeout(() => {
          this.closeModal()
          NfcManager.cancelTechnologyRequest().catch(() => 0)
          clearTimeout(timeout)
        }, autoCloseTimming)
      }
      const closeModal = () => {
        this.closeModal()
        NfcManager.cancelTechnologyRequest().catch(() => 0)
        clearTimeout(timeout)
      }
      this.popup = (
        <LoadingScanNFCPopup
          currentStep={currentStep}
          numSteps={numSteps}
          subTitle={subTitle}
          isTapCard={isTapCard}
          closeModal={closeModal}
          title={title}
        />
      )
      this.popsitionPopup = 'bottom'
      this.swipeToClose = false
      this.openModal()
    }
  }

  openConfirmWritePopupCopy = async (address, nfcData, item) => {
    try {
      this.openLoadingPopupForAndroid()

      const tag = await NfcManager.getTag()
      tag.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()
      const bytes = Ndef.encodeMessage([Ndef.textRecord(nfcData)])

      const writeMessageOnCard = async () => {
        ISIOS && this.closeModal()
        try {
          if (bytes) {
            this.openLoadingPopupForAndroid()
            await NfcManager.start()
            await NfcManager.requestTechnology(NfcTech.Ndef, {
              alertMessage: I18n.t('NFC.keepCardStill')
            })
            const ndefPayload = await NfcManager.getTag()
            ndefPayload.ndefStatus = await NfcManager.ndefHandler.getNdefStatus()
            if (Platform.OS === 'ios') {
              await NfcManager.setAlertMessageIOS(I18n.t('NFC.processedSuccessfully'))
            } else {
              this.closeSheet()
            }
            if (ndefPayload && (!ndefPayload.ndefMessage || (ndefPayload.ndefMessage[0] && ndefPayload.ndefMessage[0].tnf === 0))) {
              await NfcManager.ndefHandler.writeNdefMessage(bytes)
              this.closeModal()
              this.showAlert(I18n.t('NFC.copyNFCCardSuccess'), '', { timeout: 4000 })
              NfcManager.cancelTechnologyRequest().catch(() => 0)
            } else if (ndefPayload && ndefPayload.ndefStatus && ndefPayload.ndefStatus.status === 3) {
              this.closeModal()
              this.showAlert(I18n.t('NFC.thisIsLockedNFCKeyCard'), I18n.t('NFC.cardLocked'), { type: true, timeout: 4000 })
              NfcManager.cancelTechnologyRequest()
            } else {
              this.closeModal()
              this.showAlert(I18n.t('NFC.notEmptyCard'), '', { type: true, timeout: 4000 })
              NfcManager.cancelTechnologyRequest().catch(() => 0)
            }
          } else {
            this.setState({ isLoading: false }, () => {
              this.closeModal()
              this.showAlert(I18n.t('Initial.error'), '', { type: true, timeout: 4000 })
              NfcManager.cancelTechnologyRequest().catch(() => 0)
            })
          }
        } catch (error) {
          if (!(error instanceof NfcError.UserCancel)) {
            this.showAlert(I18n.t('Initial.error'), '', { type: true, timeout: 4000 })
          }
          NfcManager.cancelTechnologyRequest().catch(() => 0)
          this.setState({ isLoading: false }, () => {
            this.closeModal()
          })
        }
      }

      if (tag && tag.ndefMessage && tag.ndefMessage[0] && tag.ndefMessage[0].tnf === 1) {
        this.popup = (
          <ConfirmWriteNFCPopup
            title={I18n.t('NFC.copyCard')}
            subTitle={I18n.t('NFC.copyNFCCardDes1')}
            buttonText={I18n.t('Initial.copy')}
            isCopy
            isUsedText
            address={address}
            writeMessageOnCard={writeMessageOnCard}
            closeModal={this.closeModal} />
        )
        this.popsitionPopup = 'center'
        this.swipeToClose = false
        this.openModal()
      } else {
        if (bytes) {
          await NfcManager.ndefHandler // Step2
            .writeNdefMessage(bytes) // Step3

          if (Platform.OS === 'ios') {
            await NfcManager.setAlertMessageIOS(I18n.t('NFC.copyNFCCardSuccess'))
          }
        } else {
          this.setState({ isLoading: false }, () => {
            this.showAlert(I18n.t('v2.common.error'), '', { type: true, callback: () => NavigationActions.navigate('KeyCardOperation'), timeout: 4000 })
          })
        }

        this.closeModal()
        NfcManager.cancelTechnologyRequest().catch(() => 0)
      }
    } catch (ex) {
      this.setState({ isLoading: false }, () => {
        this.closeModal()
        this.showAlert(I18n.t('v2.keyCard.somethingError'), '', { type: true, callback: () => NavigationActions.navigate('KeyCardOperation'), timeout: 4000 })
      })
    }

    // Step 4
    NfcManager.cancelTechnologyRequest().catch(() => 0)
  }

  openPrivateKeyPopup = (privateKey) => {
    const onCopyPrivateKey = () => {
      privateKey && Clipboard.setString(privateKey)
      this.showAlert(I18n.t('Initial.copyDone', { value: 'PrivateKey' }), '', { type: 'toast' })
    }
    this.popup = (
      <ModalPrivateKey
        privateKey={privateKey}
        onCopyPrivateKey={onCopyPrivateKey}
        closeModal={this.closeModal} />
    )
    this.popsitionPopup = 'center'
    this.swipeToClose = false
    this.openModal()
    try {
      SecureWindow.changeSecureWindow(true)
    } catch (error) {
      //
    }
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

  onHandleShowPrivateKey = async () => {
    const { accountListRedux } = this.props

    const callbackOnReadingDone = async (tagEvent) => {
      const isNfcFromKHW = await NfcProxy.checkNfcIsFromKeyringHardWalletWeb(tagEvent)

      const privateKeyEncryptFromKHW = await NfcProxy.getEncryptPrivateKeyFromNfcKeyringHardWallet(tagEvent)
      const privateKeyHash = convertNFCPayloadTextToReadableText(tagEvent.ndefMessage[0])
      const isCorrectFormat = checkNFCDataFormat(tagEvent.ndefMessage[0], privateKeyHash) || isNfcFromKHW

      if (!isCorrectFormat && !isNfcFromKHW) {
        this.closeModal()
        this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
        return
      }

      // Show private key from KEYRING HARD WALLET WEB
      if (isNfcFromKHW) {
        const isInvalidCardId = await this.checkInvalidCardId(tagEvent.id)
        if (!isInvalidCardId) {
          this.closeModal()
          this.showAlert(I18n.t('NFC.notCorrectFormatNFCard'), '', { type: true, timeout: 4000 })
          return
        }
        const privateKeyDecryptFromAirDropBandWeb = decryptPrivateKeyFromKeyringHardwalletWeb(privateKeyEncryptFromKHW, '')

        const validPk = verifyCorrectWalletByPk(privateKeyDecryptFromAirDropBandWeb)

        if (privateKeyDecryptFromAirDropBandWeb && validPk) {
          setTimeout(() => {
            this.openPrivateKeyPopup(privateKeyDecryptFromAirDropBandWeb)
          }, 500)
          return
        } else {
          const callBackFunction = (privateKeyDecrypt) => {
            NavigationActions.goBack()
            this.openPrivateKeyPopup(privateKeyDecrypt)
          }

          NavigationActions.navigate('enterPassNFCScreen', {
            callBackFunction: callBackFunction,
            privateKeyEncryptFromKHW: privateKeyEncryptFromKHW,
            isNfcFromKHW
          })

          return
        }
      }

      // Show private key from KEYRING PRO APP
      if (privateKeyHash) {
        const address = getAddressFromNFCData(privateKeyHash)

        const privateKeyHashWithoutAddress = getPrivateKeyHashFromNFCData(privateKeyHash)
        const findAccount = accountListRedux.filter(item => {
          // check chain not work in EMV ethereum
          const isOtherChainEmv = item.chain === chainType.btc || item.chain === chainType.solana

          return item && item.passwordFile && ((item.address && item.address === address) || (isOtherChainEmv && item.rootAddress === address))
        })[0]

        if (findAccount) {
          const privateKeyFromHash = decryptBackupFileContent(privateKeyHashWithoutAddress, findAccount.passwordFile.toString())
          const addressFromHash = getAddressFromNFCData(privateKeyHash)

          if (addressFromHash !== address || !privateKeyFromHash) {
            this.showAlert(I18n.t('NFC.accountNotExistErr'), '', { type: true, callback: () => NavigationActions.navigate('keyCardOperation'), timeout: 4000 })
            NfcManager.cancelTechnologyRequest()

            return
          }

          const callBackFunction = () => {
            NavigationActions.goBack()
            this.openPrivateKeyPopup(privateKeyFromHash)
          }

          NavigationActions.navigate('enterPassNFCScreen', {
            callBackFunction: callBackFunction,
            passwordFile: findAccount.passwordFile,
            passwordFileEncode: findAccount.passwordFileEncode
          })
        } else {
          NfcManager.cancelTechnologyRequest()
          this.showAlert(I18n.t('NFC.accountNotExistErr'), '', { type: true, callback: () => NavigationActions.navigate('keyCardOperation'), timeout: 4000 })
        }
      }
    }
    this.nfcProxy.handleReadNfcCard(callbackOnReadingDone, { allowEmptyCard: false })
  }

  onHandleLockCardNfc = async () => {
    this.nfcProxy.onHandleLockCardNfc()
  }

  onOpenOptionPopup = (popup, popsitionPopup = 'bottom') => () => {
    this.popsitionPopup = popsitionPopup
    this.popup = popup
    this.openModal()
  }

  onChangeText = (text) => {
    this.setState({ password: text })
  }

  onBackRoute = () => {
    NavigationActions.goBack()
  }

  openNFCKeyCardPopUp = () => {
    this.popup = (
      <ConfirmWriteNFCPopup
        title={I18n.t('NFC.copyCard')}
        subTitle={I18n.t('NFC.copyNFCCardDes')}
        buttonText={I18n.t('NFC.read')}
        isCopy
        isOtherType
        isUsedText
        address=''
        writeMessageOnCard={this.onHandleCopyNFC}
        closeModal={this.closeModal} />
    )
    this.popsitionPopup = 'center'
    this.swipeToClose = false
    this.openModal()
  }

  render () {
    const Template = this.view
    return (
      <Template
        noFooter
        leftAction={() => NavigationActions.navigate('settings')}
        title={I18n.t('MenuScreen.keyCardOperation.titleHeader')}
        func={this}
        props={this.props}
        state={this.state}
      />
    )
  }
}

const mapDispatchToProps = (dispatch) => ({
  setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch)
})

const mapStateToProps = (state) => ({
  settingsRedux: state.settingsRedux,
  accountListRedux: state.accountListRedux,
  blockchainListRedux: state.blockchainListRedux
})

export default connect(mapStateToProps, mapDispatchToProps)(KeyCardOperation)
