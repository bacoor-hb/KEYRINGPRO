import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import Page from './page'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import MyButton from 'frontend/Components/UI/MyButton'
import NfcManager, { Ndef } from 'react-native-nfc-manager'
import I18n from 'assets/Lang'
import ExportToNFC from './Components/ExportToNFC'
import { cloneData, makeRandomHash, sleep } from 'common/function'
import ReduxService from 'common/redux'
import { REDUX_KEY } from 'common/constants/redux'
import { getPrivateKeyByAddress } from 'common/wallet'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { Share, View } from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { pickDirectory } from '@react-native-documents/picker'
import { AndroidScoped, FileSystem } from 'react-native-file-access'
import EnterPass from './Components/EnterPass'
import HowDoUse from './Components/HowDoUse'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { pixelByHeight, pixelByWidth } from 'common/styles'
let randomHash = ''
let isExportSuccess = false
class ExportToNFCTagScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    randomHash = ''
    isExportSuccess = false
  }

  saveFileAnroid = async (fileName, fileContent) => {
    return new Promise(async (resolve, reject) => {
      try {
        const { uri } = await pickDirectory({
          requestLongTermAccess: false
        })

        const contentPath = AndroidScoped.appendPath(uri, fileName + '.txt')

        FileSystem.writeFile(contentPath, fileContent, 'utf8')
          .then(() => {
            resolve(true)
          }).catch(() => {
            reject(new Error('noPermission'))
          })
      } catch (err) {
        resolve(false)
      }
    })
  }

  saveFileIOS = async (fileName, fileContent) => {
    return new Promise((resolve) => {
      try {
        const filePath = `${RNFS.TemporaryDirectoryPath}/${fileName}.txt`

        // write the file
        RNFS.writeFile(filePath, fileContent, 'utf8')
          .then(async (success) => {
            try {
              const result = await Share.share({
                url: filePath,
                title: fileName
              })
              if (result && result.action === Share.sharedAction) {
                resolve(true)
              }
              resolve(false)
            } catch (error) {
              // console.log({ error1: error })
              resolve(false)
            }
          })
          .catch((_err) => {
            // console.log({ error2: _err })
            resolve(false)
          })
      } catch (err) {
        // console.log({ error3: err })
        resolve(false)
      }
    })
  }

  handleExportToNFC = async () => {
    const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
    const { account } = activeAccount
    const address = account.address
    const privateKey = getPrivateKeyByAddress(address)

    randomHash = makeRandomHash()
    const payload = {
      data: privateKey,
      address
    }
    const nfcData = await this.nfcProxy.createExportDataNfc(payload, randomHash)

    await this.closeDrawer()
    await sleep(600)

    const callback = async () => {
      try {
        const bytes = Ndef.encodeMessage([Ndef.textRecord(nfcData)])
        await NfcManager.ndefHandler.writeNdefMessage(bytes)
        this.openDrawer({
          children: (
            <EnterPass _this={this} />
          ),
          onClose: () => {
            if (!isExportSuccess) {
              this.nfcProxy.handleReadingError(I18n.t('GlobalError.somethingWrongErr'))
            }
          }
        })
      } catch (error) {
        this.nfcProxy.handleReadingError(I18n.t('GlobalError.somethingWrongErr'))
      }
    }
    NfcManager.cancelTechnologyRequest().finally(() => {
      this.nfcProxy.handleReadNfcCard(callback, {
        allowEmptyCard: true,
        allowHasDataCard: true,
        allowReadOnlyCard: false
      })
    })
  }

  handleSaveFilBackupPasscode = async (password) => {
    try {
      let isSaveFile = false
      const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
      const accountListRedux = ReduxService.getReduxDataByKey(REDUX_KEY.accountListRedux)
      const { account, indexAccount } = activeAccount

      const activeAccountTemp = cloneData(activeAccount)
      const accountListReduxTemp = cloneData(accountListRedux)

      const address = account.address
      const fileName = (address.substring(0, 6)) + '-NFC-KeyCard-File-' + Date.now()
      const payload = {
        data: randomHash,
        address
      }

      const fileContent = await this.nfcProxy.createExportDataNfc(payload, password)

      if (ISIOS) {
        isSaveFile = await this.saveFileIOS(fileName, fileContent)
      } else {
        isSaveFile = await this.saveFileAnroid(fileName, fileContent)
      }
      if (isSaveFile) {
        isExportSuccess = true
        activeAccountTemp.account.isFromKeyCard = true
        activeAccountTemp.account.accountType = ACCOUNT_TYPE.COLD
        activeAccountTemp.account.passwordFile = randomHash
        activeAccountTemp.account.passwordFileEncode = fileContent
        accountListReduxTemp[indexAccount] = activeAccountTemp.account
        ReduxService.setActiveAccount(activeAccountTemp.account)
        ReduxService.setAccountList(accountListReduxTemp)

        await this.closeDrawer()
        await sleep(400)

        this.showAlert(
          I18n.t('v2.exportNfc.privateKeyDeleted'),
          '',
          {
            callback: () => {
              NavigationActions.reset(NAME_SCREEN.home)
            },
            closable: true,
            autoClose: false
          })
      } else {
        this.nfcProxy.handleReadingError(I18n.t('GlobalError.somethingWrongErr'))
      }
    } catch (error) {
      if (error?.message === 'noPermission') {
        this.nfcProxy.handleReadingError(I18n.t('v2.exportNfc.permissionDenied'))
      } else {
        this.nfcProxy.handleReadingError(I18n.t('GlobalError.somethingWrongErr'))
      }
    }
  }

  handleShowExport = async () => {
    const callbackOnReadingDone = async (tagEvent, isClearAndWrite = false) => {
      try {
        if (tagEvent?.ndefMessage?.length > 0 && !isClearAndWrite) {
          callbackNFCHasData(tagEvent)
          return
        }

        // Case card has data => is valid card => show confirm popup
        if (tagEvent && tagEvent.ndefMessage && tagEvent.ndefMessage[0] && tagEvent.ndefMessage[0].tnf === 1) {
          setTimeout(() => {
            this.openDrawer({
              children: (
                <ExportToNFC _this={this} />
              )
            })
          }, 500)
        } else {
          setTimeout(() => {
            this.openDrawer({
              children: (
                <ExportToNFC _this={this} />
              )
            })
          }, 500)
        }
      } catch (ex) {
        this.nfcProxy.handleReadingError(I18n.t('GlobalError.somethingWrongErr'))
      }
    }

    const callbackNFCHasData = (tagEvent) => {
      this.showAlert(
        I18n.t('v2.exportNfc.nfcNotEmpty'),
        '',
        {
          overClickClose: false,
          autoClose: false,
          type: 'error',
          moreView: (
            <View style={{ gap: pixelByWidth(18), marginTop: pixelByHeight(6) }} className='flex relative flex-row justify-between items-center'>
              <View style={{ flex: 1 }}>
                <MyButton className='w-full' onPress={this.closeAlert} label={I18n.t('Initial.close')} />
              </View>
              <View style={{ flex: 1 }}>
                <MyButton
                  onPress={() => {
                    this.closeAlert()
                    setTimeout(() => {
                      // NfcManager.cancelTechnologyRequest().finally(() => {
                      //   this.nfcProxy.handleReadNfcCard(e => callbackOnReadingDone(e, true), { allowReadOnlyCard: false })
                      // })
                      callbackOnReadingDone(tagEvent, true)
                    }, 500)
                  }}
                  variant='dangerous'
                  className='w-full'
                  label={I18n.t('NFC.continue')} />
              </View>
            </View>
          )
        }
      )
    }
    NfcManager.cancelTechnologyRequest().finally(() => {
      this.nfcProxy.handleReadNfcCard(callbackOnReadingDone, { allowReadOnlyCard: false })
    })
  }

  handleHowDoUse = () => {
    this.openDrawer({
      children: (
        <HowDoUse _this={this} />
      )
    })
  }

  render () {
    const Template = this.view
    return (
      <Template
        headerBlur
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader showAlert={this.showAlert} />}
        rightView={(
          <MyButton
            isUseHeader
            onPress={this.handleShowExport}
            size='small'
            label={I18n.t('v2.exportNfc.export')}
          />
        )}
      />
    )
  }
}

export default ExportToNFCTagScreen
