import React from 'react'
import BaseContainer from 'frontend/Container/BaseContainer'
import Page from './page'
import I18n from 'assets/Lang'
import { Share } from 'react-native'
import * as RNFS from '@dr.pogodin/react-native-fs'
import { connect } from 'react-redux'
// components
import PermissionRequestPopup from './components/PermissionRequestPopup'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { pickDirectory, saveDocuments, errorCodes, isErrorWithCode } from '@react-native-documents/picker'
import { NavigationActions } from 'src/navigation/NavigationService'
import { FileSystem, AndroidScoped } from 'react-native-file-access'
import { getPrivateKeyByAddress } from 'common/wallet'
import RightHeader from './components/RightHeader'
import { NAME_SCREEN } from 'common/constants/navigation'
import { createBackupV2 } from 'common/backup'
import moment from 'moment'
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { KEYSTORE } from 'common/constants/redux'

class BackUpWalletScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = {
      isShowPassword: false,
      newPassword: '',
      confirmPassword: '',
      isPassNotMatch: false,
      isCreatingBackup: false,
      listBackupFiles: []
    }
  }

  componentDidMount () {
    this.getListBackupFiles()
  }

  getListBackupFiles = async () => {
    const data = await getDataFromAsyncStorage(KEYSTORE.HISTORY_BACKUP, null)
    if (data) {
      this.setState({ listBackupFiles: data })
    }
  }

  setListBackupFiles = (data) => {
    if (data) {
      const arrData = [data, ...(this.state.listBackupFiles || [])]
      this.setState({ listBackupFiles: arrData })
      storeDataToAsyncStorage(KEYSTORE.HISTORY_BACKUP, arrData)
    }
  }

  saveFileAnroid = async (fileName, fileContent) => {
    try {
      const dataFileBackup = {
        fileName,
        fileContent,
        time: moment(new Date()).format('HH:mm YYYY-MM-DD')
      }

      const { uri } = await pickDirectory({
        requestLongTermAccess: false
      })

      const contentPath = AndroidScoped.appendPath(uri, fileName + '.txt')
      dataFileBackup.filePath = contentPath

      FileSystem.writeFile(contentPath, fileContent, 'utf8')
        .then((result) => {
          dataFileBackup.result = result
          this.setListBackupFiles(dataFileBackup)
          this.showAlert(null, '', { callback: this.onBackRoute })
        }).catch(_err => {
          this.popup = (
            <PermissionRequestPopup
              closeModal={this.closeModal} />
          )
          this.swipeToClose = false
          this.openModal()
        })
    } catch (err) {
      this.showAlert(null, '', { type: true, callback: () => this.onBackRoute })
    }
  }

  saveFileIOS = async (fileName, fileContent, filePath) => {
    try {
      const dataFileBackup = {
        fileName,
        fileContent,
        filePath,
        time: moment(new Date()).format('HH:mm YYYY-MM-DD')
      }

      // write the file
      RNFS.writeFile(filePath, fileContent, 'utf8')
        .then(async (success) => {
          try {
            const result = await Share.share({
              url: filePath,
              title: fileName
            })
            dataFileBackup.result = result

            if (result && result.action === Share.sharedAction) {
              this.setListBackupFiles(dataFileBackup)
              this.showAlert(null, '', { callback: this.onBackRoute })
            }
          } catch (error) {
            this.showAlert(null, '', { type: true })
          }
        })
        .catch((_err) => {
          this.showAlert(null, '', { type: true })
        })
    } catch (err) {
      this.showAlert(null, '', { type: true, callback: this.onBackRoute })
    }
  }

  // macOS-only save path ("Designed for iPad" / Catalyst). The share sheet used by
  // saveFileIOS is unusable there: UIKit-on-macOS reports completed = NO for the
  // "Save to Files" activity even when the file was written, and RN's native handler
  // only calls back when `completed` is YES or `activityType` is nil
  // (RCTActionSheetManager.mm) — so with a non-nil activityType the Share.share promise
  // never settles at all. Either way we never reached the success branch: no popup and
  // no history entry. The document picker resolves with the real target uri instead, or
  // rejects with OPERATION_CANCELED. iPhone keeps the share sheet (AirDrop, Mail, ...).
  saveFileMac = async (fileName, fileContent, filePath) => {
    const dataFileBackup = {
      fileName,
      fileContent,
      filePath,
      time: moment(new Date()).format('HH:mm YYYY-MM-DD')
    }

    try {
      await RNFS.writeFile(filePath, fileContent, 'utf8')

      // encodeURI because the native side does `URL(string:)!` on each entry — an
      // un-escaped path (a space in the macOS user name is enough) would crash there.
      const [savedFile] = await saveDocuments({
        sourceUris: [`file://${encodeURI(filePath)}`],
        copy: true
      })

      // The user picked the destination, so report where it actually landed.
      dataFileBackup.filePath = savedFile?.uri || filePath
      dataFileBackup.result = savedFile
      this.setListBackupFiles(dataFileBackup)
      this.showAlert(null, '', { callback: this.onBackRoute })
    } catch (err) {
      // Dismissing the save dialog is not an error — leave the screen as it is.
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return
      this.showAlert(null, '', { type: true })
    }
  }

  onBackupFile = async () => {
    if (this.state.isCreatingBackup) return
    this.setState({ isCreatingBackup: true })
    try {
      const { accountListRedux, activeEvmChainIdsRedux, accountTokenListRedux } = this.props
      const { confirmPassword } = this.state
      const fileName = 'keyring-backup-file-' + Date.now()

      const walletData = {
        accounts: (accountListRedux || []).map(account => ({
          ...account,
          privateKey: getPrivateKeyByAddress(account.address)
        })),
        // User's active EVM chains + per-account token list, so a restore brings
        // back the same chain selection and tokens without waiting for a refetch.
        activeEvmChainIds: activeEvmChainIdsRedux || [],
        accountTokenList: accountTokenListRedux || {}
      }

      // Only the encryption step is slow (PBKDF2 ~900k iterations). The save
      // step that follows shows its own native UI (Share sheet / directory
      // picker), so loading is cleared right after encryption.
      const fileContent = await createBackupV2({ password: confirmPassword, walletData })
      this.setState({ isCreatingBackup: false })

      const filePath = `${RNFS.TemporaryDirectoryPath}/${fileName}.txt`
      if (ISMAC) {
        this.saveFileMac(fileName, fileContent, filePath)
      } else if (ISIOS) {
        this.saveFileIOS(fileName, fileContent, filePath)
      } else {
        this.saveFileAnroid(fileName, fileContent)
      }
    } catch (error) {
      this.setState({ isCreatingBackup: false })
      this.showAlert(I18n.t('v2.file.cantCreateBackup'), '', { type: true })
    }
  }

  onBackRoute = () => {
    const { onBackRoute } = this.props.route.params || {}
    if (onBackRoute) {
      onBackRoute()
    } else {
      NavigationActions.reset(NAME_SCREEN.home)
    }
  }

  onChangeCheckbox = () => {
    this.setState({ isShowPassword: !this.state.isShowPassword })
  }

  onChangeText = (name) => (value) => {
    this.setState({ [name]: value }, () => {
      const { confirmPassword, newPassword } = this.state
      this.setState({ isPassNotMatch: confirmPassword.length > 0 && newPassword !== confirmPassword })
    })
  }

  onOpenOptionPopup = (popup, popsitionPopup = 'bottom') => () => {
    this.popsitionPopup = popsitionPopup
    this.backdropPressToClose = true
    this.popup = popup
    this.entryPopup = 'bottom'
    this.openModal()
  }

  render () {
    const Template = this.view
    return (
      <ThemeContext.Consumer>{(context) => {
        return (
          <Template
            leftAction={this.onBackRoute}
            noFooter
            rightView={(
              // <TouchableOpacity
              //   style={styles.inforIconBox}
              //   onPress={this.onOpenOptionPopup(<InfoBackupPopup closeModal={this.closeModal} />, 'center')}
              // >
              //   <Image resizeMode='contain' source={images[`informationRoundIcon${context.modeTheme}`]} style={styles.inforIcon} />
              // </TouchableOpacity>
              <RightHeader handleCreate={this.onBackupFile} isLoading={this.state.isCreatingBackup} isDisabled={this.state.isPassNotMatch || !this.state.newPassword.length || !this.state.confirmPassword.length} />
            )}
            // title={I18n.t('MenuScreen.BackUpWalletScreen.titleHeader')}
            func={this}
            props={this.props}
            state={this.state}
            scrollPage
            paddingTop={0}
          />
        )
      }}
      </ThemeContext.Consumer>
    )
  }
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  activeEvmChainIdsRedux: state.activeEvmChainIdsRedux,
  accountTokenListRedux: state.accountTokenListRedux
})

export default connect(mapStateToProps)(BackUpWalletScreen)
