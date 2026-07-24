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
import { pickDirectory } from '@react-native-documents/picker'
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
      if (ISIOS) {
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
