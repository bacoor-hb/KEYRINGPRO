/* eslint-disable eqeqeq */
import React from 'react'
import { connect } from 'react-redux'
import BaseContainer from 'frontend/Container/BaseContainer'
import { NavigationActions } from 'src/navigation/NavigationService'
import { bindActionCreators } from 'redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import WalletConnectPayPage from './page'
import TokenPreview from './Component/TokenPreview'
import I18n from 'assets/Lang'
import WalletConnectPay from 'common/walletConnectPay'
import { lowerCase, sleep } from 'common/function'
import AllChainServices from 'controller/AllChainServices'
import { getPrivateKeyByAddress, isAccountFromKeyCard, remove0xFromPrivateKey } from 'common/wallet'
import { getDataFromAsyncStorage } from 'common/storage/asyncStorage'
import { KEYSTORE } from 'common/constants/redux'
import { saveDataToAsyncStorage } from 'controller/Redux/lib/reducerConfig'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import RightHeader from './Component/RightHeader'
import FormEnterUserInfo from './Component/FormEnterUserInfo'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { decodeEventLog, erc20Abi, isAddress as isAddressEVM, zeroAddress } from 'viem'
export const TYPE_STEP_PAYMENT = {
  idle: 1,
  signing: 2,
  trackingHash: 3,
  success: 4,
  error: 5
}

let isPayment = false

class WalletConnectPayScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = WalletConnectPayPage
    this.forceCheckPermissionCamera = false
    // from router
    this.paymentOptions = this.props?.route?.params?.paymentOptions

    this.state = {
      chainId: null,
      optionsPayments: null,
      infoTokens: {},
      isBackToScanScreen: false,
      paymentOptions: {}
    }

    isPayment = false
  }

  componentDidMount () {
    try {
      const optionsPayments = {}
      let chainIdDefault

      this.paymentOptions.options.forEach(option => {
        if (option?.actions?.length <= 0) {
          return
        }

        const partsAccount = option.account.split(':')
        const partsToken = option.amount.unit.split(':')

        const chainId = partsAccount[1]
        const address = partsAccount[2]
        let addressToken = partsToken[2]

        if (!isAddressEVM(addressToken)) {
          addressToken = zeroAddress
        }

        option.token = {
          ...option.amount.display,
          address: addressToken,
          value: option.amount.value
        }

        if (!chainIdDefault) {
          chainIdDefault = chainId
        }
        if (!optionsPayments[chainId]) {
          optionsPayments[chainId] = []
        }

        if (!optionsPayments[chainId]?.address?.includes(address)) {
          optionsPayments[chainId].push(option)
        }
      })

      const optionsFirst = optionsPayments[chainIdDefault][0]
      const part = optionsFirst?.amount?.unit?.split(':')
      let address = part[2]
      if (!isAddressEVM(address)) {
        address = zeroAddress
      }
      const infoTokens = { ...optionsFirst.amount, address, chainId: chainIdDefault }

      this.setState({ paymentOptions: this.paymentOptions, optionsPayments, chainId: chainIdDefault, infoTokens })
    } catch (error) {
      // console.log({ error })
    }
  }

  handleGetToAddress = async (hash) => {
    try {
      let toAddress = ''
      const client = ViemWeb3.getPublicClient(this.state.chainId)
      const logHash = await client.getTransactionReceipt({ hash })
      logHash.logs.forEach((log) => {
        try {
          const logs = decodeEventLog({
            abi: erc20Abi,
            data: log.data,
            topics: log.topics
          })
          if (lowerCase(logs?.eventName) === 'transfer') {
            toAddress = logs.args.to
          }
        } catch (error) {
          // console.log({ error })
        }
      })
      return toAddress
    } catch (error) {
      return ''
    }
  }

  handleTrackingPayment = async (dataTracking, limit = 15) => {
    const result = await WalletConnectPay.confirmPayment(dataTracking)

    if (result.status === 'succeeded') {
      return result
    } else {
      if (result.status === 'processing') {
        if (limit === 0) {
          return {
            status: 'fail'
          }
        }
        await sleep(2000)
        const result = await this.handleTrackingPayment(dataTracking, limit - 1)
        return result
      } else {
        return result
      }
    }
  }

  handleSignatureMessage = async (actions, chainId) => {
    const activeAccount = this.props.activeAccount
    const { account } = activeAccount
    const address = account.address
    let privateKey = ''
    if (isAccountFromKeyCard(address)) {
      privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address)
      if (!privateKey) {
        this.callbackError('rejectNFC')
      }
    } else {
      privateKey = getPrivateKeyByAddress(address)
    }
    privateKey = remove0xFromPrivateKey(privateKey)
    const signatures = await Promise.all(actions.map((action) => {
      const { method: m, params } = action.walletRpc
      const parsedP = JSON.parse(params)

      switch (m) {
        case 'eth_signTypedData_v4':

          return AllChainServices.signTypedData(privateKey, parsedP[1])
        case 'eth_sendTransaction':
          return ViemWeb3.sendTransaction(chainId, privateKey, parsedP[0])
        case 'personal_sign':
          return AllChainServices.signPersionalMessage(privateKey, parsedP[0])
        default:
          throw new Error(`Unsupported RPC method: ${m}`)
      }
    }))
    return signatures
  }

  handleSubmitPayment = async (option, callback = () => {}) => {
    try {
      const { optionsPayments, chainId } = this.state
      const activeAccount = this.props.activeAccount
      const { account } = activeAccount
      const paymentOptions = this.paymentOptions
      const paymentId = paymentOptions.paymentId
      const idAccount = option.id
      const addressUser = account.address

      const historyWCPayObject = await getDataFromAsyncStorage(KEYSTORE.HISTORY_WC_PAY, {}) || {}
      const actions = await WalletConnectPay.getRequiredPaymentActions(paymentId, idAccount)

      if (actions?.length === 0) {
        this.callbackError('expired')
        return
      }

      const action = actions[0]
      if (!action) {
        this.callbackError('expired')
        return
      }

      callback(TYPE_STEP_PAYMENT.signing)
      await this.handleSubmitWebview()

      const signatures = await this.handleSignatureMessage(actions, chainId)

      callback(TYPE_STEP_PAYMENT.trackingHash)
      const dataTracking = {
        paymentId,
        optionId: idAccount,
        signatures
      }

      const resultTracking = await this.handleTrackingPayment(dataTracking)

      const dataHistory = {
        indexAccount: account.indexAccount,
        info: paymentOptions.info,
        collectData: paymentOptions.collectData,
        resultHash: resultTracking,
        optionsPayments: optionsPayments[chainId],
        optionPaid: option,
        chainId,
        block_timestamp: Date.now()
      }

      if (resultTracking.status === 'succeeded') {
        const hash = resultTracking?.info?.txId

        const toAddress = await this.handleGetToAddress(hash)
        if (toAddress) {
          dataHistory.toAddress = toAddress

          if (historyWCPayObject[addressUser]) {
            historyWCPayObject[addressUser].push(dataHistory)
            saveDataToAsyncStorage(historyWCPayObject, KEYSTORE.HISTORY_WC_PAY)
          } else {
            historyWCPayObject[addressUser] = [dataHistory]
            saveDataToAsyncStorage(historyWCPayObject, KEYSTORE.HISTORY_WC_PAY)
          }
        }

        callback(TYPE_STEP_PAYMENT.success, resultTracking)
        isPayment = true
        await refreshAccountTokens(addressUser, { chainIds: [chainId] })
      } else {
        this.callbackError(resultTracking.status)
        callback(TYPE_STEP_PAYMENT.error, resultTracking)
      }
    } catch (error) {
      // console.log({ error })

      this.callbackError(error)
      callback(TYPE_STEP_PAYMENT.error)
    }
  }

  async handleSubmitWebview () {
    return new Promise((resolve, reject) => {
      try {
        const { optionsPayments, chainId } = this.state

        const optionsPayment = optionsPayments[chainId][0]
        const urlEnterForm = optionsPayment?.collectData?.url

        if (urlEnterForm) {
          this.openDrawer({
            children: <FormEnterUserInfo
              url={urlEnterForm}
              onComplete={() => {
                this.closeDrawer()
                resolve(true)
              }}
              onError={() => reject(TYPE_STEP_PAYMENT.error)}
              onClose={() => reject(TYPE_STEP_PAYMENT.error)}
            />,
            addDrawer: true,
            onClose: () => reject(TYPE_STEP_PAYMENT.error)
          })
        } else {
          resolve(true)
        }
      } catch (error) {
        // console.log({ errorhandleSubmitWebview: error?.message })
        reject(error)
      }
    })
  }

  async callbackError (error) {
    this.closeDrawer()
    const status = error?.message || error
    let textError = I18n.t('Initial.WalletConnectPay.paymentFailed')

    if (status === 'cancelled') {
      textError = I18n.t('Initial.WalletConnectPay.paymentCancelled')
    } else if (status === 'expired') {
      textError = I18n.t('Initial.WalletConnectPay.qrExpired')
    } else if (status === 'rejectNFC') {
      textError = I18n.t('NFC.userCancel')
    }
    this.showAlert(textError, '', { type: true, callback: () => this.onCancel(), timeout: 4000 })
  }

  handleSelectChain = (chainId) => {
    const { optionsPayments } = this.state
    if (chainId !== this.state.chainId) {
      const optionsFirst = optionsPayments[chainId][0]
      const part = optionsFirst?.amount?.unit?.split(':')
      const address = part[2]
      const infoTokens = { ...optionsFirst.amount, address, chainId: chainId }

      this.setState({ chainId, infoTokens })
    }
  }

  handleTokenSelect = (option) => {
    this.openDrawer({
      children: <TokenPreview option={option} _this={this} />,
      scrollView: false,
      onClose: () => {
        if (isPayment) {
          this.setState({ isBackToScanScreen: true })
          const arrChainPayment = []

          this.paymentOptions?.options?.forEach(option => {
            const chainId = option?.account?.split(':')?.[1]
            if (chainId) {
              arrChainPayment.push(Number(chainId))
            }
          })
          refreshAccountTokens(this.props.activeAccount.account.address, { chainIds: arrChainPayment }).then(() => {
            isPayment = false
          })
        }
      }
    })
  }

  onCancel = (isBack = false) => {
    const { callback } = this.props?.route?.params || {}

    if (isBack) {
      NavigationActions.goBack()
      callback?.()
    } else {
      NavigationActions.goBack()
      callback?.()
      // NavigationActions.reset(NAME_SCREEN.scanScreen)
    }
  }

  render () {
    const Template = this.view

    return (
      <Template
        middleView={<InfoAccountHeader showAlert={this.showAlert} />}
        leftAction={() => this.onCancel(true)}
        noFooter
        func={this}
        props={this.props}
        state={this.state}
        rightView={<RightHeader _this={this} />}
        _this={this} />
    )
  }
}

const mapStateToProps = (state) => ({
  blockchainListRedux: state.blockchainListRedux,
  accountListRedux: state.accountListRedux,
  activeAccount: state.activeAccount
})

const mapDispatchToProps = (dispatch) => {
  return {
    setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(WalletConnectPayScreen)
