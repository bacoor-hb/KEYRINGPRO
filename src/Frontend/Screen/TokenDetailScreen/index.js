import BaseContainer from 'frontend/Container/BaseContainer'
import React from 'react'
import { connect } from 'react-redux'
import Page from './page'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import { cloneData, sleep, lowerCase, formatWeb3Error } from 'common/function'
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
import { zeroAddress } from 'viem'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { resolveOnchainSymbolFor } from 'src/Services/TokenListV2/symbolOnchain'
import { isNativeToken } from 'common/tokens'
import ViemWeb3, { TX_TRACK_CANCELLED, TX_TRACK_REVERTED } from 'src/Web3/ViemWeb3'
import BigNumber from 'bignumber.js'
import SwapAndSend from './Component/SwapAndSend'
import { SwapServiceFactory } from 'src/Services/SwapServices'

// How long to keep polling for a send's receipt. Long enough for slow L1 blocks,
// short enough that a tx which never lands stops costing RPC calls — the poll is
// also cancelled outright when the drawer closes (see cancelSendTracking).
const SEND_TX_TRACK_TIMEOUT = 90000

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
    // Read by the receipt poll between attempts (see handleSubmitSend). The poll
    // is a bare promise chain with no lifecycle of its own, so this flag is the
    // only thing that can stop it once the UI it reports to is gone.
    this.sendTrackingCancelled = false
  }

  componentWillUnmount () {
    super.componentWillUnmount()
    this.cancelSendTracking()
  }

  // Stop polling for a send's receipt. Called when the Send drawer closes and on
  // unmount: leaving the screen used to leave the poll running against the RPC
  // for its whole timeout, still hitting the network from the Home screen.
  cancelSendTracking = () => {
    this.sendTrackingCancelled = true
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
      // The result timeline lives in this drawer; once it is dismissed there is
      // nothing left to render a receipt into, so stop polling for one.
      onClose: this.cancelSendTracking,
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
      // A previous send in this same screen may have left the flag set (drawer
      // closed mid-confirmation). Clear it so this send's poll is allowed to run.
      this.sendTrackingCancelled = false
      callback(STEP_SEND.sending)

      const chainId = this.state.exchange.tokenIn.chainId
      const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
      const address = activeAccount?.account?.address

      let privateKey = ''
      if (isAccountFromKeyCard(address)) {
        privateKey = await this.nfcProxy.getPrivateKeyFromNFC(address)
        // No key back from the card means the scan never happened or was called
        // off: NFC is off/unsupported, the user cancelled, or the card didn't
        // match. The proxy has ALREADY told the user why (its own alert / the
        // "NFC is not available" sheet), and nothing was signed or broadcast —
        // so rewind to the form instead of reporting a failed transaction, which
        // would blame the network for something that isn't a tx failure at all.
        if (!privateKey) {
          callback(STEP_SEND.aborted)
          return
        }
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
          // trackingTx uses the ordered RPC list (paid linkProvider first) via
          // ViemWeb3.getPublicClient, so it works for ANY chain in Redux metadata
          // (blockchainListRedux) — including custom networks.
          //
          // It replaces viem's waitForTransactionReceipt, which was a bad fit
          // here on two counts: it watches every block with emitMissed and, while
          // the receipt is missing, pulls each FULL block to hunt for a
          // replacement tx (~2 heavy requests per block, hundreds per send); and
          // it cannot be cancelled, so it kept hammering the RPC for its entire
          // 3-minute timeout after the user had closed the drawer and walked away.
          await ViemWeb3.trackingTx(chainId, hash, SEND_TX_TRACK_TIMEOUT, () => this.sendTrackingCancelled)
          callback(STEP_SEND.success)
        } catch (error) {
          // The drawer is gone — nothing left to report to, and callback() would
          // only push state into an unmounted tree.
          if (error?.message === TX_TRACK_CANCELLED) return

          // A revert is a genuine on-chain failure — the default `txFailed` copy
          // says exactly that. Anything else (timeout, no RPC reachable) means we
          // could NOT confirm, so say we could not reach the network instead of
          // claiming the transfer went through: reporting those as success is
          // exactly how a black-hole RPC that accepted txs and never forwarded
          // them stayed invisible. Either way the hash row above stays on screen,
          // so the user can still open the explorer and see what became of it.
          callback(STEP_SEND.failed, {
            error: error?.message === TX_TRACK_REVERTED
              ? I18n.t('v2.sendToken.txFailed')
              : I18n.t('Initial.connectErr')
          })
        }
      }

      const hash = await AllChainServices.sendEthTokenTxs(chainId, payload, privateKey, callbackAfterSendDone)
      callback(STEP_SEND.sent, hash)
    } catch (error) {
      callback(STEP_SEND.failed, { error: formatWeb3Error(error, I18n.t('GlobalError.somethingWrongErr')) })
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

  // Read the chosen token's on-chain `symbol()` and patch it into the selection.
  //
  // The picker list doesn't render a ticker for tokens the user doesn't hold, so
  // its rows are deliberately NOT symbol-resolved — a search can return hundreds
  // and reading `symbol()` for every one would be wasted RPC. The read happens
  // here instead, for the ONE token actually chosen.
  //
  // Fire-and-forget: the selection is committed by the caller first, so picking a
  // token never waits on the network. A failed read leaves the listing symbol in
  // place, which is exactly what the picker row already showed.
  // `chainOut` is passed in rather than read from state: the caller commits it
  // via setState, which hasn't flushed yet when this runs, so state would still
  // hold the PREVIOUS chain and the read would hit the wrong network.
  resolveTokenOutSymbol = (token, isExchange, chainOut) => {
    const branch = isExchange ? 'exchange' : 'swapAndSend'
    const address = token?.address || token?.contractAddress
    if (!address) return

    // Out-chain: the one the user picked, else the token's own, else the
    // in-token's — the same order Exchange uses to derive `chainIdOut`.
    const state = this.state[branch]
    const chainId = (chainOut ?? state?.chainOut)?.chainId || token?.chainId || state?.tokenIn?.chainId

    resolveOnchainSymbolFor(chainId, address, token?.symbolOnchain)
      .then((symbol) => {
        if (!symbol || symbol === token?.symbol) return
        // Re-read from state rather than closing over `token`: the user may have
        // picked a different token while the read was in flight.
        const current = this.state[branch]?.tokenOut
        const currentAddress = current?.address || current?.contractAddress
        if (lowerCase(currentAddress) !== lowerCase(address)) return
        this.onChangeValueExchange({ tokenOut: { ...current, symbol, symbolOnchain: symbol } }, isExchange)
      })
      .catch(() => {})
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
      this.resolveTokenOutSymbol(token, isExchange)
    }

    this.openDrawer({
      addDrawer: true,
      children: (
        <SelectTokenOut isExchange={isExchange} handleSelectToken={handleSelectToken} _this={this} handleBack={onBack} />
      )
    })
  }

  handleSelectChain = (isExchange = true, onDone = () => {}) => {
    const onBack = () => {
      if (isExchange) {
        this.onExchange()
      } else {
        this.onSwapAndSend()
      }
    }
    const handleChangeChain = (chainOut, tokenOut) => {
      this.onChangeValueExchange({ tokenOut, chainOut, amountOut: '', amountOut2USD: '' }, isExchange)
      onBack()
      onDone?.('')
      // Switching chain picks a token off the same unresolved search list, so it
      // needs the same one-token read as choosing directly.
      if (tokenOut) this.resolveTokenOutSymbol(tokenOut, isExchange, chainOut)
    }
    this.openDrawer({
      addDrawer: true,
      children: (
        <SelectChainOut isExchange={isExchange} handleChangeChain={handleChangeChain} _this={this} handleBack={onBack} />
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
      callback(STEP_EXCHANGE.failed, { error: formatWeb3Error(error, I18n.t('GlobalError.somethingWrongErr')) })
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
      const rawTransactionApi = rawTransaction?.rawTransactionApi
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
      delete rawTransaction?.rawTransactionApi

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

      const infoResult = await swapService.getInfoDetailTx({ requestId, hash, chainId: chainIdIn, rawTransactionApi })
      if (infoResult?.status === 'FAILED') {
        throw new Error('Transaction failed')
      }

      await sleep(3000)
      if (isCrossChain) {
        const arrAddressIn = [addressIn, zeroAddress].filter((url, index, arr) => arr.indexOf(url) === index)
        await refreshAccountTokens(address, {
          chainIds: [chainIdIn],
          tokenAddress: arrAddressIn
        })
        await sleep(500)
        await refreshAccountTokens(address, { chainIds: [chainIdOut], tokenAddress: [addressOut] })
      } else {
        const arrAddress = [addressIn, addressOut, zeroAddress].filter((url, index, arr) => arr.indexOf(url) === index)
        await refreshAccountTokens(address, {
          chainIds: [chainIdIn],
          tokenAddress: arrAddress
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
      callback(STEP_EXCHANGE.failed, { error: formatWeb3Error(error, I18n.t('GlobalError.somethingWrongErr')) })
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
