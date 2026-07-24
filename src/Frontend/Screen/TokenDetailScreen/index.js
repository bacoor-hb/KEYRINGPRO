import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import { connect } from 'react-redux'
import Page from './page'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { cloneData, sleep, lowerCase } from 'common/function'
import { getHeightHeader, pixelByHeight, getHeightScreen } from 'common/styles'
import Exchange, { STEP_EXCHANGE } from './Component/Exchange'
import SelectChainOut from './Component/SelectChainOut'
import SelectTokenOut from './Component/SelectTokenOut'
import SendToken, { STEP_SEND } from './Component/SendToken'
import ChangeRegionalCurrency from 'frontend/Screen/Setting/Component/ChangeRegionalCurrency'
import ReduxService from 'common/redux'
import { REDUX_KEY } from 'common/constants/redux'
import { getPrivateKeyByAddress, isAccountFromKeyCard, remove0xFromPrivateKey } from 'common/wallet'
import AllChainServices from 'controller/AllChainServices'
import I18n from 'assets/Lang'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import { createPublicClient, decodeEventLog, erc20Abi, fallback, http, zeroAddress } from 'viem'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { refreshAccountTokens, buildViemChain } from 'src/Services/TokenListV2'
import { isNativeToken } from 'common/tokens'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import BigNumber from 'bignumber.js'
import SwapAndSend from './Component/SwapAndSend'
import { SwapServiceFactory } from 'src/Services/SwapServices'

const INIT_STATE = {
  exchange: {
    tokenIn: null,
    tokenOut: null,
    chainOut: null,
    amountIn: '',
    amountIn2USD: '',
    amountOut: '',
    amountOut2USD: ''
  },
  swapAndSend: {
    tokenIn: null,
    tokenOut: null,
    chainOut: null,
    amountIn: '',
    amountIn2USD: '',
    amountOut: '',
    amountOut2USD: '',
    recipientAddress: ''
  }
}

class TokenDetailScreen extends BaseContainer {
  constructor (props) {
    super(props)
    this.page = Page
    this.state = { ...INIT_STATE }
  }

  onSend = () => {
    // SendToken's root is flex:1, so the drawer needs an anchored height — without
    // one it falls back to content-fit and collapses to the form's height.
    // heightPopupDefault comes from global layout refs that can be 0/stale (opening
    // before Home/TitleScreen has been measured), so guard it with a deterministic
    // fallback (screen − header) to keep the sheet anchored every time.
    this.getHeightLayoutModal()
    const anchoredHeight = this.heightPopupDefault > 0
      ? this.heightPopupDefault
      : getHeightScreen() - getHeightHeader(true) - pixelByHeight(16)
    this.openDrawer({
      heightDrawer: anchoredHeight,
      // Keep the sheet anchored instead of the default 'interactive' (which lifts the whole
      // sheet). 'extend' holds it at its detent; SendToken sets the Android window to
      // ADJUST_NOTHING (nothing moves) and scrolls its own content to reveal the focused input.
      keyboardBehavior: 'extend',
      children: (
        <SendToken _this={this} />
      )
    })
  }

  // Open the Regional Currency picker stacked ON TOP of the Send drawer
  // (addDrawer: true), so the Send form underneath stays mounted. The header back
  // button and currency selection both just lower this drawer to resume sending.
  // `onSelect` makes the picker report the choice back instead of mutating the
  // app-wide currency, so the Send modal can keep its own local currency.
  handleChangeCurrency = ({ selectedCode, onSelect } = {}) => {
    this.openDrawer({
      addDrawer: true,
      children: (
        <ChangeRegionalCurrency
          _this={this}
          selectedCode={selectedCode}
          onSelect={onSelect}
          handleBack={this.closeDrawer}
          onChanged={this.closeDrawer}
        />
      )
    })
  }

  // Sign + broadcast the transfer, then poll the receipt for the final status.
  // Mirrors handleSubmitExchange: drives the SendToken drawer via `callback`.
  handleSubmitSend = async (payload, callback) => {
    try {
      callback(STEP_SEND.sending)

      const chainId = this.state.exchange.tokenIn.chainId
      const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
      const address = activeAccount?.account?.address

      let privateKey = ''
      if (isAccountFromKeyCard(address)) {
        privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address)
      } else {
        privateKey = getPrivateKeyByAddress(address)
      }

      if (!privateKey) {
        callback(STEP_SEND.failed, { error: I18n.t('GlobalError.somethingWrongErr') })
        return
      }
      privateKey = remove0xFromPrivateKey(privateKey)

      // Fires after broadcast → wait for the receipt to resolve success/fail.
      // NOTE: there must always be an `await` before any callback() here. The
      // broadcast layer calls this synchronously and THEN resolves sendEthTokenTxs,
      // which sets STEP_SEND.sent. If we hit callback() with no prior await (e.g.
      // the old custom-network bail-out), `sent` lands AFTER `success` and the UI
      // gets stuck on "Waiting for confirmation". Always await the receipt.
      const callbackAfterSendDone = async (hash) => {
        try {
          // Ordered RPC list (paid linkProvider first for stability). Works for
          // ANY chain via Redux metadata (blockchainListRedux) — including custom
          // networks — so we poll the real RPC instead of bailing to success
          // before the tx is mined.
          const listRpc = ViemWeb3.getListRpc(chainId)
          if (!listRpc.length) {
            callback(STEP_SEND.success)
            return
          }
          const client = createPublicClient({
            chain: buildViemChain(chainId),
            transport: fallback(listRpc.map(url => http(url)), { rank: false, retryCount: 3, retryDelay: 150 })
          })
          const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1, pollingInterval: 1000 })
          callback(receipt.status === 'success' ? STEP_SEND.success : STEP_SEND.failed)
        } catch (error) {
          callback(STEP_SEND.success)
        }
      }

      const hash = await AllChainServices.sendEthTokenTxs(chainId, payload, privateKey, callbackAfterSendDone)
      callback(STEP_SEND.sent, hash)
    } catch (error) {
      callback(STEP_SEND.failed, { error: error?.message || error?.error || I18n.t('GlobalError.somethingWrongErr') })
    }
  }

  handleResetExchange = () => {
    this.setState({
      exchange: {
        ...INIT_STATE.exchange,
        tokenIn: this.state.exchange.tokenIn
      }
    })
  }

  handleSelectTokenOut = (isExchange = true) => {
    const onBack = () => {
      if (isExchange) {
        this.onExchange()
      } else {
        this.onSwapAndSend()
      }
    }
    const handleSelectToken = (token) => {
      this.onChangeValueExchange({ tokenOut: token }, isExchange)
      onBack()
    }

    this.openDrawer({
      addDrawer: true,
      children: (
        <SelectTokenOut isExchange={isExchange} handleSelectToken={handleSelectToken} _this={this} handleBack={onBack} />
      )
    })
  }

  handleSelectChain = (isExchange = true, callback = () => {}) => {
    const onBack = () => {
      if (isExchange) {
        this.onExchange()
      } else {
        this.onSwapAndSend()
      }
    }
    const handleChangeChain = (chainOut) => {
      this.onChangeValueExchange({ tokenOut: null, chainOut, amountOut: '', amountOut2USD: '' }, isExchange)
      onBack()
      callback?.('')
    }
    this.openDrawer({
      addDrawer: true,
      children: (
        <SelectChainOut handleChangeChain={handleChangeChain} _this={this} handleBack={onBack} />
      )
    })
  }

  handleGetAmountTokenRealTime = async (data = [{ chainId: 1, token: zeroAddress }]) => {
    const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
    const { account } = activeAccount
    const address = account.address
    const result = []
    for (let i = 0; i < data.length; i++) {
      const item = data[i]
      const { chainId, token: addressToken } = item
      const amount = await ViemWeb3.getBalanceToken(chainId, address, addressToken)
      result.push({ ...item, amount })
    }
    return result
  }

  // Poll on-chain balances until BOTH watched tokens differ from their pre-swap
  // amounts, then resolve. The swap contract often returns a hash before balances
  // actually update, so `refreshAccountTokens` right after the hash can pull stale
  // values. `data`/`prevBalances` share the same shape/order as
  // handleGetAmountTokenRealTime's input/output. Falls back (returns null) after
  // maxAttempts so a missed update never blocks the flow forever.
  handleWaitBalanceTokenChanged = async (data, prevBalances, { intervalMs = 2000, maxAttempts = 50 } = {}) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const current = await this.handleGetAmountTokenRealTime(data)

      const allChanged = current.every((item, index) => {
        const prevAmount = BigNumber(prevBalances?.[index]?.amount?.toString() || '0')
        const currentAmount = BigNumber(item?.amount?.toString() || '0')
        return !currentAmount.eq(prevAmount)
      })
      if (allChanged) {
        return current
      }
      await sleep(intervalMs)
    }
    return null
  }

  handleSubmitApprove = async (rawTransaction, callback, stateSource = 'exchange') => {
    try {
      callback(STEP_EXCHANGE.approving)

      const sourceState = this.state[stateSource] || this.state.exchange
      const chainId = sourceState.tokenIn.chainId
      const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
      const { account } = activeAccount
      const address = account.address
      let privateKey = ''
      if (isAccountFromKeyCard(address)) {
        privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address)
        if (!privateKey) {
          callback(STEP_EXCHANGE.approveFailed, { error: I18n.t('GlobalError.somethingWrongErr') })
          return
        }
      } else {
        privateKey = getPrivateKeyByAddress(address)
      }
      privateKey = remove0xFromPrivateKey(privateKey)

      // const hash = '0x7164c235d524423f00c2ebd6f4132850abb383fce99633fb9414094991ae7687'
      const hash = await AllChainServices.postBaseSendTxsForSwap(chainId, privateKey, rawTransaction)
      callback(STEP_EXCHANGE.approve, hash)
    } catch (error) {
      callback(STEP_EXCHANGE.failed, { error: error?.details || error?.message || error?.error || error })
    }
  }

  handleSubmitExchange = async (rawTransaction, callback, stateSource = 'exchange') => {
    try {
      const { blockchainListRedux, activeEvmChainIdsRedux } = this.props
      callback(STEP_EXCHANGE.exchanging)
      const currentChainActive = (activeEvmChainIdsRedux || []).map(Number)
      const currentChainInfo = cloneData(blockchainListRedux || {})
      const sourceState = this.state[stateSource] || this.state.exchange
      const { tokenIn, tokenOut, recipientAddress = null } = sourceState
      let chainOut = cloneData(sourceState.chainOut || {})

      const requestId = rawTransaction?.requestId
      const chainIdIn = sourceState.tokenIn.chainId
      const chainIdOut = chainOut?.chainId || chainOut?.id || chainIdIn
      const isCrossChain = Number(chainIdIn?.toString()) !== Number(chainIdOut?.toString())
      const isHasChainActiveInApp = activeEvmChainIdsRedux.includes(chainIdOut) || activeEvmChainIdsRedux.includes(Number(chainIdOut?.toString()))
      const isHasChainInfoInApp = blockchainListRedux[chainIdOut] || blockchainListRedux[Number(chainIdOut?.toString())]
      const isHasChainCommonInApp = LIST_DEFAULT_CHAIN_ID?.includes(Number(chainIdOut?.toString())) || LIST_DEFAULT_CHAIN_ID?.includes(chainIdOut?.toString())
      let addressIn = tokenIn?.contractAddress === 'native' ? zeroAddress : lowerCase(tokenIn?.contractAddress)
      let addressOut = (tokenOut?.address || tokenOut?.contractAddress) === 'native' ? zeroAddress : lowerCase(tokenOut?.address || tokenOut?.contractAddress)
      const swapService = await SwapServiceFactory.getService(chainIdIn, chainIdOut)

      delete rawTransaction?.requestId
      if (isNativeToken(addressIn, chainIdIn)) {
        addressIn = zeroAddress
      }
      if (isNativeToken(addressOut, chainIdOut)) {
        addressOut = zeroAddress
      }

      const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
      const { account } = activeAccount
      const address = account.address
      let privateKey = ''

      if (isAccountFromKeyCard(address)) {
        privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address)
        if (!privateKey) {
          callback(STEP_EXCHANGE.failed, { error: I18n.t('GlobalError.somethingWrongErr') })
          return
        }
      } else {
        privateKey = getPrivateKeyByAddress(address)
      }
      privateKey = remove0xFromPrivateKey(privateKey)

      // check to add chain active in app
      if (!isHasChainActiveInApp) {
        ReduxService.callDispatchAction(StorageReduxAction.setActiveEvmChainIds([...currentChainActive, Number(chainIdOut?.toString())]))
      }

      // check to add chain info to redux
      if (!isHasChainCommonInApp && !isHasChainInfoInApp) {
        const chain = String(chainOut.chain || chainOut?.name || '').toLowerCase()

        chainOut = {
          ...chainOut,
          chainId: Number(chainIdOut?.toString()),
          keyChain: `${chain}${chainIdOut}`,
          isCustomChainData: true,
          isSupportedChain: false
        }
        currentChainInfo[Number(chainIdOut?.toString())] = chainOut
        ReduxService.callDispatchAction(StorageReduxAction.setBlockChainList(currentChainInfo))
      }

      await sleep(1000)

      // const hash = '0xb94bdaff34e8ad3ecc093128245525eca49f484b24fa4db20f3bbe70d608c4b0'
      const hash = await AllChainServices.postBaseSendTxsForSwap(chainIdIn, privateKey, rawTransaction)

      await sleep(1000)

      const infoResult = await swapService.getInfoDetailTx({ requestId, hash })
      if (infoResult?.status === 'FAILED' || !infoResult?.data) {
        throw new Error('Transaction failed')
      }

      await sleep(3000)
      if (isCrossChain) {
        await refreshAccountTokens(address, {
          chainIds: [chainIdIn],
          tokenAddress: [addressIn]
        })
        await sleep(500)
        await refreshAccountTokens(address, { chainIds: [chainIdOut], tokenAddress: [addressOut] })
      } else {
        await refreshAccountTokens(address, {
          chainIds: [chainIdIn],
          tokenAddress: [addressIn, addressOut]
        })
      }

      if (lowerCase(address) !== lowerCase(recipientAddress) && recipientAddress) {
        await refreshAccountTokens(recipientAddress, {
          chainIds: [chainIdOut],
          tokenAddress: [addressOut]
        })
      }
      const amountOutAfterSwap = infoResult?.data?.data?.metadata?.currencyOut?.amountFormatted

      callback(STEP_EXCHANGE.exchange, { hash, amountOut: amountOutAfterSwap })
      await sleep(1000)
      callback(STEP_EXCHANGE.success)

      // callback(STEP_EXCHANGE.failed, { error: 'Error Exchange' })
    } catch (error) {
      callback(STEP_EXCHANGE.failed, { error: error?.details || error?.message || error?.error || error })
    }
  }

  onChangeValueExchange = (data, isExchange = true) => {
    if (isExchange) {
      this.setState({ exchange: { ...this.state.exchange, ...data } })
    } else {
      this.setState({ swapAndSend: { ...this.state.swapAndSend, ...data } })
    }
  }

  onExchange = () => {
    this.openDrawer({
      children: (
        <Exchange _this={this} />
      )
    })
  }

  onSwapAndSend = () => {
    this.openDrawer({
      children: (
        <SwapAndSend _this={this} />
      )
    })
  }

  onBuy = () => { }

  onchangeState = (data) => {
    this.setState(data)
  }

  render () {
    const Template = this.view
    return (
      <Template
        headerBlur
        noFooter
        setState={this.onchangeState}
        func={this}
        props={this.props}
        state={this.state}
        leftAction={this.onCancel}
        middleView={<InfoAccountHeader showAlert={this.showAlert} />}
      />
    )
  }
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  blockchainListRedux: state.blockchainListRedux,
  activeEvmChainIdsRedux: state.activeEvmChainIdsRedux,
  activeAccount: state.activeAccount
})

export default connect(mapStateToProps)(TokenDetailScreen)
