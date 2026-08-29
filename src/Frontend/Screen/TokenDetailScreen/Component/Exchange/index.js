import { View, TouchableOpacity, Keyboard } from 'react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import { ScrollView } from 'react-native-gesture-handler'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { useSelector } from 'react-redux'
import { Colors, fontSize, getSafeAreaValues, getSizeImgSquare, PADDING_TOP_CONTAINER_DRAWER, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import useGetRawTxExchange from 'frontend/Hooks/useGetRawTxExchange'
import { zeroAddress } from 'viem'
import { convertBalanceToWei, convertWeiToBalance, handleOpenUrl, lowerCase } from 'common/function'
import BigNumber from 'bignumber.js'
import useGetBalanceToken from 'frontend/Hooks/useGetBalanceToken'
import { cn } from 'common/tailwind'
import MyButton from 'frontend/Components/UI/MyButton'
import BtnBack from 'frontend/Components/UI/BtnBack'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n from 'assets/Lang'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import ReduxService from 'common/redux'
import { getUrlExplorerHash, handleOpenExplorerHash } from 'common/chain'
import { getAddressNative, isNativeToken } from 'common/tokens'
import useDebounceValue from 'frontend/Hooks/useDebounceValue'
import useGasPrice from 'frontend/Hooks/useGasPrice'
import { KeyboardAwareScrollView } from '@codler/react-native-keyboard-aware-scroll-view'
import { CURRENCY_DATA, SWAP_SERVICE_CONFIG } from 'common/constants/app'
import { CHAIN_ID_NO_GAS_PRICE_SWAP, PLATFORM_EXCHANGE } from 'common/constants/swap'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import AutoFitAmountInput from './Components/AutoFitAmountInput'
import { getNumberParts } from 'frontend/Components/UI/MyNumber'
import { sanitizeAmountText } from './helpers'
import InputCustom from 'frontend/Components/UI/InputCustom'
import I18nWithLinks from 'frontend/Components/UI/I18nWithLinks'
import useGetDecimalToken from 'frontend/Hooks/useGetDecimalToken'
import useProtocolFee from 'frontend/Hooks/useProtocolFee'

export const STEP_EXCHANGE = {
  approving: 1,
  approve: 2,
  approveFailed: 2.5,
  exchanging: 3,
  exchange: 4,
  success: 5,
  failed: 6
}

export const MAX_DECIMAL_2USD = 2
export const MAX_DECIMAL_2USD_GAS_FEE = 6
export const DEFAULT_GAS_LIMIT = 1000000

export const TYPE_VIEW_EXPLORER = {
  termsOfService: 'termsOfService',
  privacyPolicy: 'privacyPolicy',
  hashApprove: 'hashApprove',
  hashExchange: 'hashExchange',
  relayLink: 'relayLink'
}

const OPTION_DEFAULT_BALANCE = {
  '50%': '50',
  '100%': '100'
}

const InputAmount = ({ ...props }) => {
  const styles = createStyles()
  const [isShow, setIsShow] = useState(false)

  useEffect(() => {
    if (ISIOS) {
      setIsShow(true)
    } else {
      setTimeout(() => {
        setIsShow(true)
      }, 10)
    }
  }, [])

  return (
    <AutoFitAmountInput
      {...props}
      textStyle={{ ...styles.input, opacity: isShow ? 1 : 0 }}
    />
  )
}

const Exchange = ({ _this }) => {
  const {
    onChangeValueExchange,
    state,
    handleResetExchange,
    closeDrawer,
    handleSelectTokenOut,
    showAlert,
    handleSelectChain,
    handleSubmitApprove,
    handleSubmitExchange
  } = _this
  const {
    tokenOut,
    tokenIn,
    chainOut,
    amountIn: amountInDefault,
    amountIn2USD: amountIn2USDDefault
  } = state.exchange
  const chainIdOut = chainOut?.chainId || tokenIn?.chainId

  const [amountIn, setAmountIn] = useState(amountInDefault)
  const [amountInToUSD, setAmountInToUSD] = useState(amountIn2USDDefault)
  const [amountOut, setAmountOut] = useState('')
  const [amountOutAfterSwap, setAmountOutAfterSwap] = useState('')
  const [requestId, setRequestId] = useState(null)
  const [isFocusAmountInputToUSD, setIsFocusAmountInputToUSD] = useState(false)
  const isFocusAmountInputToUSDRef = useRef(false)
  // true when the fiat value in the token IN USD field was typed by the user (not derived
  // from a token amount). Keeps the exact number the user entered on blur, instead of the
  // quote's round-tripped value (fiat→token→fiat loses precision, e.g. 1000 -> 999.9592).
  const [isUsdInEdited, setIsUsdInEdited] = useState(false)
  // Same editable fiat field for the token OUT row (shown only once an outToken exists).
  const [amountOutToUSD, setAmountOutToUSD] = useState('')
  // eslint-disable-next-line no-unused-vars -- fiat input for the output token, not wired into the UI yet
  const [isFocusAmountInputToUSDOut, setIsFocusAmountInputToUSDOut] = useState(false)
  const isFocusAmountInputToUSDOutRef = useRef(false)
  const [isUsdOutEdited, setIsUsdOutEdited] = useState(false)

  // true  -> user is editing the INPUT field  (tradeType EXACT_INPUT, output is computed)
  // false -> user is editing the OUTPUT field (tradeType EXPECTED_OUTPUT, input is computed)
  const [isExactInput, setIsExactInput] = useState(true)
  const [error, setError] = useState('')
  const [slippage, setSlippage] = useState(1)
  const [hash, setHash] = useState()
  const [tableView, setTableView] = useState('enterExchange')
  const [step, setStep] = useState(null)
  const [loadingApprove, setLoadingApprove] = useState(false)
  const [loadingExchange, setLoadingExchange] = useState(false)
  const [optionDefaultBalance, setOptionDefaultBalance] = useState(null)
  // Set synchronously the instant the user taps Approve/Execute — before the async
  // submit resolves and callbackStep sets `step`/loading — so the quote is frozen with
  // no window where it could refetch mid-submit.
  const [hasStartedExecute, setHasStartedExecute] = useState(false)

  // Only the field the user is actively typing in drives the query.
  // Debounce that field so the quote API isn't hammered on every keystroke.
  const amountInDebounce = useDebounceValue(isExactInput ? amountIn : '', 500)
  const amountOutDebounce = useDebounceValue(isExactInput ? '' : amountOut, 500)
  // const decimalTokenIn = Number(tokenIn?.decimals || '18')
  // const decimalTokenOut = Number(tokenOut?.decimals || '18')
  const currencyCode = useSelector((s) => s.currencyRedux)
  const fiatRate = useSelector((s) => s.fiatRateRedux)

  // Convert a plain-USD value to the fiat amount shown in the editable token IN field,
  // rounding IDENTICALLY to FiatBalance: multiply by the fiat rate, then toFixed at
  // MAX_DECIMAL_2USD (toFixed = half-up, same as MyNumber's toLocaleString). Returns a plain
  // number string (no separators/symbol) for a TextInput value. Accepts a BigNumber or
  // anything Number() understands.
  const toFiatAmount = useCallback((usd) => {
    const rate = fiatRate > 0 ? fiatRate : 1
    const fiatValue = Number(usd?.toString?.() ?? usd) * rate
    if (!Number.isFinite(fiatValue)) {
      return ''
    }
    return BigNumber(fiatValue.toFixed(MAX_DECIMAL_2USD)).toFixed()
  }, [fiatRate])

  const styles = createStyles()
  const containerConfirmRef = useRef(null)

  const addressTokenIn = useMemo(() => {
    let addressIn = tokenIn?.contractAddress === 'native' ? zeroAddress : lowerCase(tokenIn?.contractAddress)

    if (isNativeToken(addressIn, tokenIn?.chainId)) {
      addressIn = getAddressNative(tokenIn?.chainId, addressIn)
    }
    return addressIn
  }, [tokenIn])

  const addressTokenOut = useMemo(() => {
    if (!tokenOut) {
      return 'nodata'
    }
    let addressOut = (tokenOut?.address || tokenOut?.contractAddress) === 'native' ? zeroAddress : lowerCase(tokenOut?.address || tokenOut?.contractAddress)

    if (isNativeToken(addressOut, chainIdOut)) {
      addressOut = getAddressNative(chainIdOut, addressOut)
    }

    return addressOut
  }, [tokenOut, chainIdOut])

  // Poll prices every 10s (matching the raw-tx quote refetch) so the USD values
  // and the price-impact derived from them stay fresh while the swap is open.
  const { data: priceTokenOutByAPI } = useGetTokenPrice(chainIdOut, tokenOut?.address || tokenOut?.contractAddress, { refetchInterval: 10000 })
  const { data: priceTokenInByAPI } = useGetTokenPrice(tokenIn?.chainId, tokenIn?.contractAddress, { refetchInterval: 10000 })
  const { activeAccount, blockchainListRedux } = useSelector(s => s)
  const { account } = activeAccount

  const { data: decimalTokenIn, isLoading: loadingDecimalTokenIn } = useGetDecimalToken(tokenIn?.chainId, addressTokenIn)
  const { data: decimalTokenOut, isLoading: loadingDecimalTokenOut } = useGetDecimalToken(chainIdOut, addressTokenOut)
  const { data: gasWeiPriceDefault, isLoading: loadingGasPriceDefault } = useGasPrice(tokenIn?.chainId)
  const { data: balanceTokenIn, isLoading: loadingBalanceTokenIn } = useGetBalanceToken(tokenIn?.chainId, account?.address, tokenIn?.contractAddress)
  const { data: balanceNative, isLoading: loadingBalanceNative } = useGetBalanceToken(tokenIn?.chainId, account?.address, zeroAddress)

  const isNativeTokenInput = isNativeToken(tokenIn?.contractAddress)
  const chainIn = blockchainListRedux[tokenIn?.chainId]
  const shortNameChainIn = chainIn?.shortName || chainIn?.name || chainIn?.chain || ''
  const shortNameChainOut = chainOut?.shortName || chainOut?.name || chainOut?.chain || shortNameChainIn

  const isCrossChain = useMemo(() => {
    return tokenIn?.chainId?.toString() !== chainIdOut?.toString()
  }, [tokenIn, chainIdOut])

  // Ethereum mainnet settles slower; everything else is quick.
  const timeDuration = tokenIn?.chainId?.toString() === '1' ? I18n.t('v2.exchange.timeOneMin') : I18n.t('v2.exchange.timeFewSeconds')

  const queryGetRawTxExchange = useMemo(() => {
    if (tokenOut && !loadingDecimalTokenIn && !loadingDecimalTokenOut) {
      if (lowerCase(addressTokenIn) === lowerCase(addressTokenOut) && !isCrossChain) {
        return null
      }

      if (amountInDebounce && isExactInput) {
        if (!BigNumber(amountInDebounce).gt(0)) {
          return null
        }
        return {
          srcChainId: tokenIn?.chainId,
          srcTokenAddress: addressTokenIn,
          srcTokenAmount: convertBalanceToWei(amountInDebounce, decimalTokenIn),
          dstChainId: chainIdOut,
          dstTokenAddress: addressTokenOut,
          recipientAddress: account?.address,
          slippage: slippage,
          senderAddress: account?.address,
          tradeType: 'EXACT_INPUT'
        }
      }

      if (amountOutDebounce && !isExactInput) {
        if (!BigNumber(amountOutDebounce).gt(0)) {
          return null
        }
        return {
          srcChainId: tokenIn?.chainId,
          srcTokenAddress: addressTokenIn,
          // amount here is the desired OUTPUT amount -> use the OUT token decimals
          srcTokenAmount: convertBalanceToWei(amountOutDebounce, decimalTokenOut),
          dstChainId: chainIdOut,
          dstTokenAddress: addressTokenOut,
          recipientAddress: account?.address,
          slippage: slippage,
          senderAddress: account?.address,
          tradeType: 'EXPECTED_OUTPUT'
        }
      }
    }

    return null
  }, [loadingDecimalTokenOut, loadingDecimalTokenIn, addressTokenIn, addressTokenOut, decimalTokenIn, decimalTokenOut, isCrossChain, tokenIn, tokenOut, isExactInput, amountInDebounce, amountOutDebounce, chainIdOut, account, slippage])

  // Once the user has tapped Approve/Execute, freeze the quote so it's not re-fetched/
  // replaced while the transaction is in flight. `hasStartedExecute` flips synchronously on
  // tap (before the async submit resolves); `step`/`loading*`/`hash` cover the later stages
  // (and the approve→back→execute flow where a hash exists but step may be reset).
  const isExecuting =
    hasStartedExecute ||
    loadingApprove ||
    loadingExchange ||
    step != null ||
    !!hash?.approve ||
    !!hash?.exchange
  const { getBridgeProvider, data: rawTransaction, isLoading: loadingGetQuote } = useGetRawTxExchange(queryGetRawTxExchange, { freeze: isExecuting })
  const bridgeProvider = getBridgeProvider(tokenIn?.chainId, chainIdOut)
  const { data: feeProtocol, isLoading: loadingFeeProtocol } = useProtocolFee(tokenIn?.chainId, chainIdOut, bridgeProvider)

  const gasLimitRawTx = useMemo(() => {
    if (rawTransaction?.tx?.gas || rawTransaction?.estimatedTransactionFee?.details?.gasLimit) {
      const gas = rawTransaction?.tx?.gas ?? rawTransaction?.estimatedTransactionFee?.details?.gasLimit
      if (BigNumber(gas).lt(DEFAULT_GAS_LIMIT)) {
        return DEFAULT_GAS_LIMIT
      }
      return gas?.toString()
    }
    return null
  }, [rawTransaction])

  const feeGas = useMemo(() => {
    let totalFee = '0.00000001'
    if (gasWeiPriceDefault && !loadingGasPriceDefault) {
      const gasPrice = convertWeiToBalance(gasWeiPriceDefault)
      totalFee = new BigNumber(gasPrice).multipliedBy(gasLimitRawTx || DEFAULT_GAS_LIMIT).toString()

      totalFee = BigNumber(totalFee).plus(feeProtocol || '0').toFixed()
    }
    return totalFee
  }, [gasWeiPriceDefault, gasLimitRawTx, feeProtocol, loadingGasPriceDefault])

  const isHasApprove = useMemo(() => {
    return rawTransaction?.approveStep?.id === 'approve'
  }, [rawTransaction])

  const priceTokenOut = useMemo(() => {
    return priceTokenOutByAPI || tokenOut?.price || tokenOut?.priceUSD || null
  }, [tokenOut, priceTokenOutByAPI])

  const priceTokenIn = useMemo(() => {
    return priceTokenInByAPI || tokenIn?.price || tokenIn?.priceUSD || null
  }, [tokenIn, priceTokenInByAPI])

  // Plain-USD values computed from OUR price API (amount × price) — NOT the Relay quote's
  // amountUsd. Kept at FULL precision (no rounding); FiatBalance applies the fiat rate +
  // symbol and formats it for display, so pass plain USD here — never a pre-rounded value.
  const amountInUsd = useMemo(() => {
    if (!priceTokenIn || !BigNumber(amountIn || 0).gt(0)) {
      return null
    }
    return BigNumber(amountIn).multipliedBy(priceTokenIn).toString()
  }, [amountIn, priceTokenIn])

  const amountOutUsd = useMemo(() => {
    if (!priceTokenOut || !BigNumber(amountOut || 0).gt(0)) {
      return null
    }
    return BigNumber(amountOut).multipliedBy(priceTokenOut).toString()
  }, [amountOut, priceTokenOut])

  // Plain-USD value for the token IN row, shared by Enter and Confirm so both render the
  // exact same number. When the user typed the fiat value directly (isUsdInEdited), keep it
  // verbatim by converting that fiat back to USD (÷ rate) instead of round-tripping through
  // price × amount (which loses precision, e.g. 1000 -> 999.9592). Full precision; FiatBalance
  // formats it for display. FiatBalance re-applies the rate on top, so this is plain USD.
  const amountInUsdForDisplay = useMemo(() => {
    if (isUsdInEdited && amountInToUSD != null && amountInToUSD !== '' && !isNaN(Number(amountInToUSD))) {
      return BigNumber(amountInToUSD).div(fiatRate > 0 ? fiatRate : 1).toString()
    }
    return amountInUsd
  }, [isUsdInEdited, amountInToUSD, amountInUsd, fiatRate])

  // Same as amountInUsdForDisplay but for the editable token OUT USD row.
  // eslint-disable-next-line no-unused-vars -- fiat input for the output token, not wired into the UI yet
  const amountOutUsdForDisplay = useMemo(() => {
    if (isUsdOutEdited && amountOutToUSD != null && amountOutToUSD !== '' && !isNaN(Number(amountOutToUSD))) {
      return BigNumber(amountOutToUSD).div(fiatRate > 0 ? fiatRate : 1).toString()
    }
    return amountOutUsd
  }, [isUsdOutEdited, amountOutToUSD, amountOutUsd, fiatRate])

  const minBalanceAddToSwap = useMemo(() => {
    const amount = BigNumber(feeGas).minus(balanceNative || '0').decimalPlaces(8)
    if (amount.lte(0)) {
      return '0'
    }
    return amount.toFixed()
  }, [feeGas, balanceNative])

  useEffect(() => {
    if (!rawTransaction?.estimation) {
      return
    }
    if (isExactInput) {
      // user typed the INPUT amount -> fill the computed OUTPUT token amount.
      // The OUT USD value is derived from our price API (amountOut × priceTokenOut) in render.
      const tokenOutEst = rawTransaction?.estimation?.dstChainTokenOut
      if (tokenOutEst) {
        const balanceWei = tokenOutEst?.amount || tokenOutEst?.amount || '0'
        const decimal = tokenOutEst?.decimals || 18
        const value = convertWeiToBalance(balanceWei, decimal)
        setAmountOut(value)
        onChangeValueExchange({ amountOut: value })

        if (priceTokenOut) {
          setAmountOutToUSD(toFiatAmount(BigNumber(value || 0).multipliedBy(priceTokenOut)))
        }
        setIsUsdOutEdited(false)
      }
    } else {
      // user typed the OUTPUT amount -> fill the required INPUT
      const tokenInEst = rawTransaction?.estimation?.srcChainTokenIn
      if (tokenInEst) {
        const balanceWei = tokenInEst?.amount || '0'
        const decimal = tokenInEst?.decimals || tokenIn?.decimals || 18
        const value = convertWeiToBalance(balanceWei, decimal)
        setAmountIn(value)
        // USD from OUR price API (price × amount) — not the quote's amountUsd. amountInToUSD is
        // what the editable fiat field shows/edits, so round it exactly like FiatBalance does
        // (× rate, then toFixed(MAX_DECIMAL_2USD)) — the full-precision USD lives in amountInUsd.
        const usd = BigNumber(value || 0).multipliedBy(BigNumber(priceTokenIn || 0))
        const fiatBalance = toFiatAmount(usd)

        setAmountInToUSD(fiatBalance)
        setIsUsdInEdited(false)
        onChangeValueExchange({ amountIn2USD: fiatBalance, amountIn: value })
      }
    }
  }, [fiatRate, priceTokenOut, rawTransaction, isExactInput, tokenIn, priceTokenIn])

  useEffect(() => {
    if (tokenIn && tokenOut) {
      if (lowerCase(addressTokenIn) === lowerCase(addressTokenOut) && !isCrossChain) {
        setError(I18n.t('ExchangeScreen.sameTokenError'))
      } else {
        if (rawTransaction?.errorMessage) {
          setError(rawTransaction?.errorMessage)
        } else {
          let balanceUserAfterFeeGas = balanceTokenIn
          if (isNativeTokenInput) {
            balanceUserAfterFeeGas = BigNumber(balanceUserAfterFeeGas).minus(feeGas)
          } else {
            if (BigNumber(balanceNative).lte(feeGas)) {
              setError(
                I18n.t('Initial.feeTokenNeedSwap', {
                  amount: minBalanceAddToSwap,
                  item: isNativeTokenInput ? tokenIn?.symbol : chainIn?.nativeCurrency?.symbol
                }))
              return
            }
          }

          if (BigNumber(balanceUserAfterFeeGas).lte(0) && BigNumber(feeGas).lt(0)) {
            balanceUserAfterFeeGas = '0'
          }

          if (BigNumber(amountIn).gt(balanceUserAfterFeeGas?.toString()) && BigNumber(feeGas).gt(0)) {
            setError(I18n.t('Content.notEnoughBalance'))
          } else {
            setError('')
          }
        }
      }
    }

    if (feeGas && balanceNative && !loadingGasPriceDefault && !loadingBalanceNative) {
      if (BigNumber(feeGas).gte(balanceNative)) {
        setError(
          I18n.t('Initial.feeTokenNeedSwap', {
            amount: minBalanceAddToSwap,
            item: isNativeTokenInput ? tokenIn?.symbol : chainIn?.nativeCurrency?.symbol
          }))
      }
    }
  }, [addressTokenOut, addressTokenIn, chainIn, minBalanceAddToSwap, isCrossChain, loadingBalanceNative, loadingGasPriceDefault, feeGas, balanceNative, tokenIn, tokenOut, rawTransaction, isNativeTokenInput, amountIn, balanceTokenIn])

  useEffect(() => {
    if (containerConfirmRef.current) {
      containerConfirmRef.current.scrollToEnd({
        animated: true
      })
    }
  }, [step])

  const handleExplorer = (type = TYPE_VIEW_EXPLORER.termsOfService) => {
    if (type === TYPE_VIEW_EXPLORER.termsOfService) {
      const url = ReduxService.getSettingOther('keyring_url_terms_of_service')
      handleOpenUrl(url)
      return
    }
    if (type === TYPE_VIEW_EXPLORER.privacyPolicy) {
      const url = ReduxService.getSettingOther('keyring_url_policy')
      handleOpenUrl(url)
      return
    }
    if (type === TYPE_VIEW_EXPLORER.hashApprove) {
      handleOpenExplorerHash(hash?.approve, Number(tokenIn.chainId?.toString()))
      return
    }

    if (type === TYPE_VIEW_EXPLORER.relayLink) {
      let url
      const baseUrlExplorer = SWAP_SERVICE_CONFIG.providers[bridgeProvider].linkExplorer
      switch (bridgeProvider) {
        case PLATFORM_EXCHANGE.relay:
          url = `${baseUrlExplorer}/transaction/${hash?.exchange}`
          break
        case PLATFORM_EXCHANGE.deBridge:
          if (isCrossChain) {
            url = `${baseUrlExplorer}/order?orderId=${requestId}`
          } else {
            url = `${baseUrlExplorer}/same-chain-order?orderId=${requestId}&txHash=${hash?.exchange}&chainId=${tokenIn?.chainId}`
          }
          break
      }
      handleOpenUrl(url)

      return
    }
    if (type === TYPE_VIEW_EXPLORER.hashExchange) {
      handleOpenExplorerHash(hash?.exchange, Number(tokenIn.chainId?.toString()))
    }
  }

  const callbackStep = (step, data) => {
    setStep(step)
    if (step <= STEP_EXCHANGE.approving) {
      setLoadingApprove(true)
    } else {
      setLoadingApprove(false)
    }

    if (step === STEP_EXCHANGE.exchanging) {
      setLoadingExchange(true)
    } else {
      setLoadingExchange(false)
    }
    if (step === STEP_EXCHANGE.approve) {
      setHash(pre => ({
        ...pre,
        approve: data
      }))
    }
    if (step === STEP_EXCHANGE.exchange) {
      setHash(pre => ({
        ...pre,
        exchange: data?.hash
      }))
      if (data?.requestId) {
        setRequestId(data?.requestId)
      }
      if (BigNumber(data?.amountOut || '0').gt(0)) {
        setAmountOutAfterSwap(data?.amountOut)
      }
    }
    if (data?.error) {
      setError(data.error)
    }
  }

  const handleExecute = async () => {
    Keyboard.dismiss()
    // Freeze the quote the moment the user commits, before the async submit resolves.
    setHasStartedExecute(true)
    if (isHasApprove && !hash?.approve) {
      const rawApprove = rawTransaction?.approveStep?.items[0]?.data
      const raw = {
        data: rawApprove.data,
        to: rawApprove.to,
        from: rawApprove.from || account.address,
        noGasPrice: !!CHAIN_ID_NO_GAS_PRICE_SWAP[tokenIn.chainId]
      }

      if (rawApprove?.gas) {
        raw.gasLimit = rawApprove.gas
      } else {
        raw.gasLimit = DEFAULT_GAS_LIMIT
      }

      if (rawApprove.value && BigNumber(rawApprove.value.toString()).gt(0)) {
        raw.value = rawApprove.value
        raw.valueNoConvert = rawApprove.value
      }
      await handleSubmitApprove(raw, callbackStep, true)
    } else {
      const raw = {
        data: rawTransaction?.tx.data,
        to: rawTransaction?.tx.to,
        from: rawTransaction?.tx.from || account.address,
        rawTransactionApi: rawTransaction?.tx,
        noGasPrice: !!CHAIN_ID_NO_GAS_PRICE_SWAP[tokenIn.chainId]
      }

      if (rawTransaction?.tx.value && BigNumber(rawTransaction?.tx.value.toString()).gt(0)) {
        raw.value = rawTransaction?.tx.value
        raw.valueNoConvert = rawTransaction?.tx.value
      }

      if (rawTransaction?.rawResponse?.requestId) {
        raw.requestId = rawTransaction?.rawResponse?.requestId
      }

      if (gasLimitRawTx) {
        raw.noEstimateGas = true
        raw.gasLimit = gasLimitRawTx
      }

      await handleSubmitExchange(raw, rawTransaction.provider, callbackStep)
    }
  }

  const handleCopy = () => {
    if (!hash?.exchange) return
    const linkScanHash = getUrlExplorerHash(hash?.exchange, Number(tokenIn?.chainId?.toString()))

    Clipboard.setString(linkScanHash)
    showAlert && showAlert(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), null, {
      type: 'toast'
    })
  }

  const handleBack = () => {
    if (tableView === 'confirmExchange') {
      if (!step) {
        setTableView('enterExchange')
        return
      }
      if (step === STEP_EXCHANGE.success || step === STEP_EXCHANGE.failed || step === STEP_EXCHANGE.approveFailed) {
        handleResetExchange()
        closeDrawer()
        return
      }
      if (hash?.approve) {
        setTableView('enterExchange')
        return
      }

      if (hash?.exchange) {
        handleResetExchange()
        closeDrawer()
      }
    }
  }

  // user types the INPUT amount -> EXACT_INPUT, output gets computed
  const onChangeAmountIn = (value, decimal) => {
    setOptionDefaultBalance(null)
    setIsExactInput(true)
    setIsUsdInEdited(false)
    const valueSanitize = sanitizeAmountText(value, decimal)
    setAmountIn(valueSanitize)

    if (!priceTokenIn) {
      return
    }

    const price = BigNumber(priceTokenIn || 0)
    const amountIn = BigNumber(value || 0)

    // amountInToUSD is the editable fiat field's value — round it exactly like FiatBalance
    // (toFiatAmount); the full-precision USD used for calculations lives in amountInUsd.
    const fiatBalance = toFiatAmount(amountIn.multipliedBy(price))
    setAmountInToUSD(fiatBalance)
    onChangeValueExchange({ amountIn2USD: fiatBalance, amountIn: valueSanitize })
  }

  // User types a fiat amount for the INPUT (token OUT USD is read-only). Convert
  // fiat → USD → token amount using the token's USD price.
  const onChangeAmountToUsd = (value, decimal) => {
    setOptionDefaultBalance(null)
    const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
    value = value.replace(`${cur.symbol}`, '').trim()

    if (!priceTokenIn || !isFocusAmountInputToUSDRef.current) {
      return
    }
    const valueSanitize = sanitizeAmountText(value, decimal)
    setAmountInToUSD(valueSanitize)
    setIsUsdInEdited(true)

    const price = BigNumber(priceTokenIn || 0)
    // USD = typed fiat ÷ rate, kept at full precision so the back-computed token amount stays
    // accurate; only the token amount is rounded (to its own decimals) at the end.
    const usd = BigNumber(valueSanitize || 0).div(fiatRate > 0 ? fiatRate : 1)

    let amountIn = usd.dividedBy(price).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    if (isNaN(amountIn) || amountIn === 'NaN' || amountIn?.includes('e-') || amountIn?.includes('-e')) {
      amountIn = '0'
    }

    setIsExactInput(true)
    setAmountIn(amountIn)
    onChangeValueExchange({ amountIn2USD: valueSanitize, amountIn })
  }

  // user types the OUTPUT amount -> EXPECTED_OUTPUT, input gets computed by the quote.
  const onChangeAmountOut = (value, decimal) => {
    setIsExactInput(false)
    setIsUsdInEdited(false)
    setIsUsdOutEdited(false)
    const valueSanitize = sanitizeAmountText(value, decimal)
    setAmountOut(valueSanitize)
    onChangeValueExchange({ amountOut: valueSanitize })

    if (priceTokenOut) {
      // amountOutToUSD is the editable fiat field's value — round it exactly like FiatBalance
      // (toFiatAmount); the full-precision USD used for calculations lives in amountOutUsd.
      setAmountOutToUSD(toFiatAmount(BigNumber(valueSanitize || 0).multipliedBy(priceTokenOut)))
    }
  }

  // User types a fiat amount for the OUTPUT (mirror of onChangeAmountToUsd). Convert
  // fiat → USD → token amount using the token's USD price, then EXPECTED_OUTPUT so the
  // quote back-computes the INPUT amount.
  // eslint-disable-next-line no-unused-vars -- fiat input for the output token, not wired into the UI yet
  const onChangeAmountOutToUsd = (value, decimal) => {
    setOptionDefaultBalance(null)
    const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
    value = value.replace(`${cur.symbol}`, '').trim()

    if (!priceTokenOut || !isFocusAmountInputToUSDOutRef.current) {
      return
    }
    const valueSanitize = sanitizeAmountText(value, decimal)
    setAmountOutToUSD(valueSanitize)
    setIsUsdOutEdited(true)

    const price = BigNumber(priceTokenOut || 0)
    // USD = typed fiat ÷ rate, kept at full precision so the back-computed token amount stays
    // accurate; only the token amount is rounded (to its own decimals) at the end.
    const usd = BigNumber(valueSanitize || 0).div(fiatRate > 0 ? fiatRate : 1)

    let amountOut = usd.dividedBy(price).decimalPlaces(decimalTokenOut, BigNumber.ROUND_DOWN).toFixed()
    if (isNaN(amountOut) || amountOut === 'NaN' || amountOut?.includes('e-') || amountOut?.includes('-e')) {
      amountOut = '0'
    }

    setIsExactInput(false)
    setAmountOut(amountOut)
    onChangeValueExchange({ amountOut })
  }

  const handleMax = (type = 'max') => {
    Keyboard.dismiss()
    if (loadingGetQuote) {
      return
    }

    const feeTx = feeGas
    let balanceUser = BigNumber(balanceTokenIn).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    if (isNativeTokenInput) {
      balanceUser = BigNumber(balanceUser).minus(feeTx).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    }

    if (BigNumber(balanceUser).lte(0)) {
      return
    }

    if (type === '50%') {
      setOptionDefaultBalance(OPTION_DEFAULT_BALANCE['50%'])
      balanceUser = BigNumber(balanceUser).times(0.5).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    } else {
      setOptionDefaultBalance(OPTION_DEFAULT_BALANCE['100%'])
    }

    if (BigNumber(balanceUser).isEqualTo(amountIn) && !!error) {
      return
    }

    setError('')
    setIsExactInput(true)
    setIsUsdInEdited(false)
    setAmountIn(balanceUser)

    const price = BigNumber(priceTokenIn || 0)
    const amountInFinal = BigNumber(balanceUser || 0)

    // amountInToUSD is the editable fiat field's value — round it exactly like FiatBalance
    // (toFiatAmount); the full-precision USD used for calculations lives in amountInUsd.
    const fiatBalance = toFiatAmount(amountInFinal.multipliedBy(price))

    setAmountInToUSD(fiatBalance)
    onChangeValueExchange({ amountIn2USD: fiatBalance, amountIn: amountInFinal.toFixed() })
  }

  const renderButton = () => {
    if (isHasApprove && !hash?.approve) {
      return (
        <MyButton
          variant='default'
          disableLiquidGlass
          isLoading={loadingGetQuote || loadingApprove || loadingFeeProtocol}
          isDisable={loadingGetQuote}
          label={I18n.t('Initial.ExchangeApprove')}
          onPress={handleExecute}
        />
      )
    }
    return (
      <MyButton
        variant='primary'
        isLoading={loadingGetQuote || loadingExchange || loadingFeeProtocol}
        isDisable={loadingGetQuote || !!hash?.exchange}
        label={I18n.t('v2.exchange.execute')}
        onPress={handleExecute}
      />
    )
  }

  // Formatted fiat value shown in a USD field when NOT being edited. Rounds the shared USD
  // value the SAME way FiatBalance does (× rate, half-up at MAX_DECIMAL_2USD — same math as
  // toFiatAmount), then adds thousands separators + trims trailing zeros exactly like
  // MyNumber — so blur, focus, and the Confirm screen all render the identical number.
  const getFormattedValue = (usdValue) => {
    if (usdValue == null) {
      return ''
    }
    const fiatValue = Number(usdValue) * (fiatRate > 0 ? fiatRate : 1)
    if (!Number.isFinite(fiatValue)) {
      return ''
    }
    const formatted = fiatValue.toLocaleString('en-US', {
      minimumFractionDigits: MAX_DECIMAL_2USD,
      maximumFractionDigits: MAX_DECIMAL_2USD
    })
    // Trim trailing zeros the same way MyNumber does, so this matches FiatBalance on
    // Confirm exactly (e.g. '17.5000' -> '17.5', '17.0000' -> '17').
    const dot = formatted.indexOf('.')
    if (dot < 0) {
      return formatted
    }
    const frac = formatted.slice(dot + 1).replace(/0+$/, '')
    return frac.length > 0 ? `${formatted.slice(0, dot)}.${frac}` : formatted.slice(0, dot)
  }

  // Shared bits for an editable fiat USD input (token IN and token OUT rows). The currency
  // symbol renders INSIDE the input value (prefix before the number, suffix after it) —
  // never as a sibling <Text>. A separate Text can't share the TextInput's line-box on every
  // device, so its glyph drifts off the digits' baseline. Inside the value, alignment comes free.
  const getUsdInputConfig = (isFocus, value, usdForDisplay) => {
    const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
    const isSuffixSymbol = cur.position === 'suffix'
    const textValue = isFocus ? value?.toString() : getFormattedValue(usdForDisplay)

    const prefixSymbol = cur.position !== 'suffix' ? cur.symbol : ''
    const suffixSymbol = cur.position === 'suffix' ? ` ${cur.symbol}` : ''

    const displayValue = isFocus
      ? `${prefixSymbol}${textValue || ''}${suffixSymbol}`
      : textValue ? `${prefixSymbol}${textValue}${suffixSymbol}` : ''

    // Suffix: pin the caret to the END OF THE NUMBER (before the symbol) while editing, so
    // Backspace removes a digit — never the symbol — and new digits insert before it. Prefix
    // needs no pinning: the symbol leads, so it is unreachable from the string's end.
    const selection = isSuffixSymbol && isFocus
      ? { start: displayValue.length - suffixSymbol.length, end: displayValue.length - suffixSymbol.length }
      : undefined

    return { cur, prefixSymbol, suffixSymbol, displayValue, selection }
  }

  // Editable fiat USD input, shared by the token IN and token OUT rows. User types a fiat
  // amount and `onChange` back-computes the token amount. `value` holds the fiat-side value
  // (already × rate), kept to MAX_DECIMAL_2USD so it reads like a currency amount. While
  // focused we show that raw value so typing stays smooth (no reformatting mid-keystroke);
  // on blur getFormattedValue() renders the same 2-decimal number — so tapping in shows
  // exactly what was displayed, not a long decimal.
  const renderTokenUsdInput = ({ isFocus, setFocus, isFocusRef, value, usdForDisplay, onChange }) => {
    const { cur, prefixSymbol, suffixSymbol, displayValue, selection } = getUsdInputConfig(isFocus, value, usdForDisplay)

    const onBlur = () => {
      isFocusRef.current = false
      setFocus(false)
    }
    const onFocus = () => {
      isFocusRef.current = true
      setFocus(true)
    }

    return (
      <View style={{ height: getSizeImgSquare('large'), flexDirection: 'row', display: 'flex', alignItems: 'center' }}>
        <View style={{ width: '100%', position: 'relative' }}>
          <InputCustom
            variant='empty'
            useNativePlaceholder
            onBlur={onBlur}
            onFocus={onFocus}
            value={displayValue}
            selection={selection}
            onChangeText={value => {
              value = value.toString()?.replace?.(cur.symbol, '')?.trim?.()
              onChange(value, MAX_DECIMAL_2USD)
            }}
            keyboardType='decimal-pad'
            placeholderTextColor={Colors.TEXT_MEDIUM}
            placeholder={`${prefixSymbol}0${suffixSymbol}`}
            inputConfig={{
              style: { color: Colors.TEXT_MEDIUM }
            }}
          />
        </View>
      </View>
    )
  }

  // Token OUT USD row: read-only for now. When the customer wants it editable again,
  // swap this back to renderTokenUsdInput({ ... }) — all the state/handler code is still here.
  const renderTokenOutUSD = () => (
    <View style={{ height: getSizeImgSquare('large'), opacity: amountOutUsd != null ? 1 : 0 }} className='flex flex-row items-center'>
      <FiatBalance className='text-medium' valueUSD={amountOutUsd || '0'} fractionDigits={MAX_DECIMAL_2USD} />
    </View>
  )

  const renderTokenInUSD = () => renderTokenUsdInput({
    isFocus: isFocusAmountInputToUSD,
    setFocus: setIsFocusAmountInputToUSD,
    isFocusRef: isFocusAmountInputToUSDRef,
    value: amountInToUSD,
    usdForDisplay: amountInUsdForDisplay,
    onChange: onChangeAmountToUsd
  })

  const renderStepSubmit = () => {
    return (
      <View style={{ gap: pixelByHeight(14), marginTop: pixelByHeight(29) }}>
        {
          step >= STEP_EXCHANGE.approving && isHasApprove && (
            <View style={styles.containerItemStep}>
              <TxStepIcon uri={images.UIV2.icons.approve} />
              <View>
                <View className='flex flex-row items-center gap-1'>
                  <MyText fontWeight={700}>
                    {I18n.t('Initial.ExchangeApprove')}
                  </MyText>
                  {step === STEP_EXCHANGE.approving && <MyDotsLoading variant='default' source={images.threeDotsWhiteLoading} />}
                </View>

                <MyText className='text-medium'>
                  {I18n.t('v2.exchange.approxTime', { value: timeDuration })}
                </MyText>
              </View>
            </View>
          )

        }
        {
          hash?.approve && (
            <View style={styles.containerItemStep}>
              <View style={styles.containerLineStep}>
                <View style={styles.lineStep} />
              </View>
              <View style={{ flex: 1, gap: pixelByHeight(12) }}>
                <View style={{ gap: pixelByWidth(12) }} className='flex w-full flex-row items-center'>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity className='w-full' activeOpacity={1} onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.hashApprove)}>
                      <MyText className='text-brand'>
                        {hash.approve}
                      </MyText>
                    </TouchableOpacity>
                  </View>
                  <View style={{ opacity: 0 }}>
                    <TouchableOpacity style={styles.containerCopy}>
                      <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )
        }

        {
          ((step >= STEP_EXCHANGE.exchanging && !isHasApprove) || (step >= STEP_EXCHANGE.exchanging && isHasApprove && hash?.approve)) && (
            <View style={styles.containerItemStep}>
              <TxStepIcon uri={images.UIV2.icons.icon_send_outline} />
              <View>
                <View className='flex flex-row items-center gap-1'>
                  <MyText fontWeight={700}>
                    {I18n.t('Initial.sending')}
                  </MyText>
                  {
                    step === STEP_EXCHANGE.exchanging && (
                      <MyDotsLoading source={images.threeDotsWhiteLoading} />
                    )
                  }
                </View>
                <MyText className='text-medium'>
                  {I18n.t('v2.exchange.approxTime', { value: timeDuration })}
                </MyText>
              </View>
            </View>
          )
        }
        {
          step >= STEP_EXCHANGE.exchange && hash?.exchange && (
            <View style={styles.containerItemStep}>
              <View style={styles.containerLineStep}>
                <View style={styles.lineStep} />
              </View>
              <View style={{ flex: 1, gap: pixelByHeight(12) }}>
                <View style={{ gap: pixelByWidth(12) }} className='flex w-full flex-row items-center'>
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity className='w-full' activeOpacity={1} onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.hashExchange)}>
                      <MyText className='text-brand'>
                        {hash.exchange}
                      </MyText>
                    </TouchableOpacity>
                  </View>
                  <View>
                    <TouchableOpacity onPress={handleCopy} style={styles.containerCopy}>
                      <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
                    </TouchableOpacity>
                  </View>
                </View>
                {
                  bridgeProvider === PLATFORM_EXCHANGE.relay && (
                    <View className='flex flex-row items-center gap-1'>
                      <MyIcon uri={images.UIV2.icons.relayIcon} />
                      <TouchableOpacity onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.relayLink)} activeOpacity={1}>
                        <MyText className='text-brand'>
                          {I18n.t('v2.exchange.viewRelayExplorer')}
                        </MyText>
                      </TouchableOpacity>
                    </View>
                  )
                }

                {
                  requestId && bridgeProvider === PLATFORM_EXCHANGE.deBridge && (
                    <View className='flex flex-row items-center gap-1'>
                      <MyIcon uri={images.UIV2.icons.deBridgeExplorer} />
                      <TouchableOpacity onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.relayLink)} activeOpacity={1}>
                        <MyText className='text-brand'>
                          {I18n.t('v2.exchange.viewDeBridgeExplorer')}
                        </MyText>
                      </TouchableOpacity>
                    </View>
                  )
                }

              </View>
            </View>
          )
        }

        {
          step === STEP_EXCHANGE.success && (
            <View style={{ marginTop: pixelByWidth(3) }}>
              <StatusMessage
                variant='success'
                title={I18n.t('Initial.success')}
                message={amountOutAfterSwap ? I18n.t('v2.exchange.receivedAmountOut', {
                  amount: BigNumber(amountOutAfterSwap).decimalPlaces(6).toFormat(),
                  symbol: tokenOut?.symbol
                }) : ''}
                titleConfig={{
                  className: 'text-green'
                }}
                messageConfig={{
                  className: 'text-white'
                }}
                contentStyle={{ gap: 0 }}
                style={{ alignItems: 'center', justifyContent: 'center' }}
              />
            </View>
          )
        }

        {
          (step === STEP_EXCHANGE.failed || step === STEP_EXCHANGE.approveFailed) && (
            <>
              <View style={styles.containerItemStep}>
                <View style={styles.containerLineStep}>
                  <View style={styles.lineStep} />
                </View>
                <View style={{ flex: 1, height: getSizeImgSquare('large') }} />
              </View>
              <StatusMessage
                variant='error'
                title={I18n.t('Content.failed')}
                message={error || ''}
                titleConfig={{
                  className: 'text-red'
                }}
                style={{ alignItems: 'center', justifyContent: 'center' }}
              />
            </>
          )
        }

      </View>
    )
  }

  const renderConfirm = () => {
    // Price impact computed from our own USD values (amountOutUsd vs amountInUsd)
    // instead of relay's details.totalImpact.percent, to stay consistent with the
    // USD figures shown on this screen. impact% = (out − in) / in × 100.
    const impactPercent = BigNumber(amountInUsd || 0).gt(0)
      ? BigNumber(amountOutUsd || 0)
        .minus(amountInUsd)
        .dividedBy(amountInUsd)
        .multipliedBy(100)
        .toNumber()
      : 0

    // Returns a plain USD value at full precision — FiatBalance (valueUSD) applies the fiat
    // rate + symbol and formats it for display.
    // Uses priceTokenIn (our price API) to stay consistent with the rest of the screen.
    const convert2USDFeeGas = () => {
      return BigNumber(feeGas).multipliedBy(priceTokenIn || '1').toFixed()
    }

    return (
      <>
        <TitleDrawer
          absolute
          hasBlur
          title={I18n.t('Initial.confirmTransfer')}
          leftIcon={<BtnBack interactive={false} onPress={handleBack} />}
          rightElement={renderButton()}
        />

        <View style={{ flex: 1, paddingTop: PADDING_TOP_CONTAINER_DRAWER }}>

          <ScrollView ref={containerConfirmRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.containerConfirm}>
            {/* information */}
            <View style={styles.containerInfoConfirm}>
              <View style={styles.containerRowItem}>
                <TokenIconWithChain
                  chainId={tokenIn.chainId}
                  tokenIconUri={tokenIn?.iconUrl}
                />
                <InputAmount
                  value={(() => {
                    const { intPart, fracPart } = getNumberParts(amountIn, decimalTokenIn)
                    return fracPart ? `${intPart}.${fracPart}` : intPart
                  })()}
                  disabled
                  textStyle={styles.input}
                />

              </View>

              <View style={[styles.containerRowItem2]}>
                <View style={{ width: getSizeImgSquare('large') }} className='flex items-center justify-center'>
                  <MyIcon uri={images.UIV2.icons.goArrowDownMedium} />
                </View>
                <View style={{ flex: 1 }}>
                  <MyTextTicker>
                    <FiatBalance className='text-medium' valueUSD={amountInUsdForDisplay || '0'} fractionDigits={MAX_DECIMAL_2USD} />
                  </MyTextTicker>
                </View>

              </View>

              <View style={styles.containerRowItem}>
                <TokenIconWithChain
                  chainId={chainIdOut}
                  chainIconUrl={chainOut?.iconUrl}
                  tokenIconUri={
                    tokenOut?.icon_image ||
                    tokenOut?.logoURI ||
                    tokenOut?.metadata?.logoURI ||
                    tokenOut?.iconUrl ||
                    images.UIV2.icons.noTokenOutExchange
                  }
                />
                <InputAmount
                  value={(() => {
                    const { intPart, fracPart } = getNumberParts(amountOut, decimalTokenOut)
                    return fracPart ? `${intPart}.${fracPart}` : intPart
                  })()}
                  disabled
                  textStyle={styles.input}
                />

              </View>

              <View style={[styles.containerRowItem2]}>
                <View style={{ width: getSizeImgSquare('large') }} className='flex opacity-0 items-center justify-center' />
                <View className='flex flex-row items-center '>
                  <View
                    className='overflow-hidden flex flex-row items-start'
                  >
                    {/* USD amount keeps the ticker (marquee). flex-shrink (not flex-1) so it only
                      takes its content width — leaving impact right next to it — but still
                      shrinks + scrolls if the number is too long for the row. */}
                    <View
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                      <MyTextTicker
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <FiatBalance className='text-medium' valueUSD={amountOutUsd || '0'} fractionDigits={MAX_DECIMAL_2USD} />
                        <MyBalance
                          variant='small'
                          className='text-medium'
                          style={{ position: 'relative' }}
                          value={impactPercent}
                          fractionDigits={2}
                          fixedDecimals
                          signed
                          prefix=' ('
                          suffix='%)'
                        />
                      </MyTextTicker>
                    </View>
                    {

                    }
                  </View>

                </View>
              </View>

              {/* percent price tken out by token in */}
              {
                priceTokenOut && (
                  <View style={{ flex: 1, paddingTop: pixelByHeight(6) }} className='flex flex-row items-baseline '>
                    <MyTextTicker>
                      <MyText variant='small' className='text-medium'>
                        1{' '}{tokenOut?.symbol}{' '}on{' '}{shortNameChainOut}{' '}={' '}
                      </MyText>
                      <MyBalance fractionDigits={6} value={BigNumber(priceTokenOut).div(priceTokenIn).decimalPlaces(decimalTokenIn).toString()} variant='small' className='text-medium' />
                      <MyText variant='small' className='text-medium'>
                        {' '}{tokenIn.symbol || tokenIn?.name}{' '}on{' '}{shortNameChainIn}{' '}
                      </MyText>
                      <FiatBalance variant='small' className='text-medium' fractionDigits={2} valueUSD={priceTokenOut} />

                    </MyTextTicker>
                  </View>
                )
              }

              {/* percent price tken out by token in */}
              <MyTextTicker>
                <View style={{ alignItems: 'baseline', alignContent: 'stretch', alignSelf: 'baseline' }} className='flex flex-row items-baseline '>

                  <MyText variant='small' className='text-medium'>
                    {I18n.t('v2.exchange.duration')}{timeDuration} |{' '}
                  </MyText>
                  <View className='relative' style={{ top: fontSize(4) }}>
                    <MyIcon variant='small' uri={images.UIV2.icons.gas} />
                  </View>
                  <MyText variant='small' className='text-medium'>
                    {' '}{'<'}{' '}
                    <FiatBalance variant='small' className='text-medium' fractionDigits={MAX_DECIMAL_2USD_GAS_FEE} valueUSD={convert2USDFeeGas()} />

                  </MyText>
                </View>
              </MyTextTicker>
            </View>

            <View className='flex flex-row justify-between items-baseline '>
              <MyTextTicker>
                {I18n.t('v2.exchange.slippageTolerance')}
              </MyTextTicker>
              {/* opacity lives on this wrapper (not the TouchableOpacity) — TouchableOpacity
                manages its own node opacity via activeOpacity, so an inline opacity there
                gets clobbered and never shows. */}
              <View className='flex flex-row justify-end' style={{ opacity: isExecuting ? 0.4 : 1 }}>
                {
                  [0.5, 1, 2, 3].map((itemSlippage) => {
                    const isSelected = slippage === itemSlippage
                    return (
                      <TouchableOpacity
                        style={{ minWidth: pixelByWidth(40), paddingHorizontal: pixelByWidth(6), justifyContent: 'center', alignItems: 'center' }}
                        activeOpacity={1}
                        // While executing the quote is frozen, so changing slippage would do
                        // nothing — disable the buttons to avoid a misleading tap.
                        disabled={isExecuting}
                        onPress={() => {
                          if (!isSelected) {
                            setSlippage(itemSlippage)
                          }
                        }}
                        key={`slippage-${itemSlippage}`}>
                        <MyText numberOfLines={1} fontWeight={700} className={cn('text-nowrap', isSelected ? '' : 'text-low')}>
                          {itemSlippage}
                        </MyText>
                      </TouchableOpacity>
                    )
                  })
                }
              </View>
            </View>

            {renderStepSubmit()}

          </ScrollView>
        </View>

      </>
    )
  }

  const renderEnterExchange = () => {
    return (
      <>
        <TitleDrawer
          absolute
          hasBlur
          title={I18n.t('Initial.exchange')}
          leftIcon={images.UIV2.icons.exchange}
          rightElement={(
            tokenOut ? (
              <MyButton
                interactive={false}
                isDisable={
                  BigNumber(amountIn || '0').lte(0) ||
                  !!error ||
                  !rawTransaction?.tx ||
                  loadingGetQuote ||
                  !tokenOut
                }
                onPress={() => setTableView('confirmExchange')}
                label={I18n.t('Initial.confirm')}
                variant='default'
                disableLiquidGlass
                size='small'
                isLoading={
                  loadingGetQuote ||
                  loadingDecimalTokenOut || loadingDecimalTokenIn

                }
              />
            ) : null

          )}
        />
        <View style={{ flex: 1, paddingTop: PADDING_TOP_CONTAINER_DRAWER }}>
          <KeyboardAwareScrollView
            // style={{ flex: 1 }}
            enableOnAndroid
            extraScrollHeight={20}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps='handled'
            contentContainerStyle={styles.containerContent}
          >
            <View
              style={{
                gap: pixelByHeight(2)
              }}>
              <View style={styles.containerItem}>
                <View style={{ gap: pixelByWidth(12), height: getSizeImgSquare('large') }} className='flex items-center justify-between flex-row w-full'>
                  <MyText fontWeight={700} className='text-medium  ' variant='subTitle'>
                    {I18n.t('v2.exchange.sell')}
                  </MyText>

                  <View style={{ gap: pixelByWidth(12), height: getSizeImgSquare('large') }} className='flex items-center flex-row '>
                    {
                      !loadingBalanceTokenIn && !loadingGasPriceDefault && (
                        <TouchableOpacity activeOpacity={1} style={[styles.btnOption, optionDefaultBalance === OPTION_DEFAULT_BALANCE['50%'] && styles.btnOptionSelected]} onPress={() => handleMax('50%')}>
                          <MyText variant='small' className='text-brand'>50%</MyText>
                        </TouchableOpacity>
                      )
                    }
                    {
                      !loadingBalanceTokenIn && !loadingGasPriceDefault && (
                        <TouchableOpacity activeOpacity={1} style={[styles.btnOption, optionDefaultBalance === OPTION_DEFAULT_BALANCE['100%'] && styles.btnOptionSelected]} onPress={handleMax}>
                          <MyText variant='small' className='text-brand'>{I18n.t('v2.common.max')}</MyText>
                        </TouchableOpacity>
                      )
                    }
                  </View>
                </View>

                <View style={{ gap: pixelByWidth(12) }} className='flex items-center flex-row w-full'>
                  <View>
                    <TokenIconWithChain
                      chainId={tokenIn.chainId}
                      tokenIconUri={tokenIn?.iconUrl}
                    />
                  </View>
                  <View className='flex-1'>
                    <InputAmount
                      value={amountIn?.toString()}
                      onChangeText={value => onChangeAmountIn(value, decimalTokenIn)}
                      keyboardType='decimal-pad'
                      placeholderTextColor={Colors.WHITE}
                      textStyle={styles.input}
                      placeholder='0'
                    />
                  </View>
                </View>
                {renderTokenInUSD()}

              </View>

              <View className='flex flex-row items-center justify-center'>
                <View style={{ width: sizeImageSquare(10), height: sizeImageSquare(10) }} className='relative'>
                  <View style={styles.containerIconDown}>
                    <MyIcon style={styles.iconDown} variant='title' uri={images.UIV2.icons.goArrowDownMedium} />
                  </View>
                </View>
              </View>

              <View style={styles.containerItem}>
                <View style={{ gap: pixelByWidth(12), height: getSizeImgSquare('large') }} className='flex items-center justify-between flex-row w-full'>
                  <MyText fontWeight={700} className='text-medium  ' variant='subTitle'>
                    {I18n.t('v2.common.buy')}
                  </MyText>

                  <View style={{ gap: pixelByWidth(12) }} className='flex items-center flex-row '>
                    {
                      !loadingBalanceTokenIn && !loadingGasPriceDefault && (
                        <TouchableOpacity
                          activeOpacity={1}
                          style={styles.btnOption}
                          onPress={() => {
                            Keyboard.dismiss()
                            setError('')
                            handleSelectChain(true, () => {
                              setAmountOut('')
                              setAmountInToUSD('')
                              setAmountOutToUSD('')
                              setIsUsdOutEdited(false)
                            })
                          }}>
                          <MyIcon uri={images.UIV2.icons.network} variant='small' />
                        </TouchableOpacity>
                      )
                    }
                    {
                      !loadingBalanceTokenIn && !loadingGasPriceDefault && (
                        <TouchableOpacity
                          activeOpacity={1}
                          style={styles.btnOption}
                          onPress={() => {
                            Keyboard.dismiss()
                            setError('')
                            handleSelectTokenOut()
                          }}>
                          <MyIcon uri={images.UIV2.icons.home.token} variant='small' />
                        </TouchableOpacity>
                      )
                    }
                  </View>
                </View>

                <View style={{ gap: pixelByWidth(12) }} className='flex items-center flex-row w-full'>
                  <TokenIconWithChain
                    chainId={chainIdOut}
                    chainIconUrl={chainOut?.iconUrl}
                    tokenIconUri={
                      tokenOut?.icon_image ||
                    tokenOut?.logoURI ||
                    tokenOut?.metadata?.logoURI ||
                    tokenOut?.iconUrl ||
                    images.UIV2.icons.noTokenOutExchange
                    }
                  />
                  <View className='flex-1'>
                    <InputAmount
                      value={amountOut?.toString()}
                      onChangeText={value => onChangeAmountOut(value, decimalTokenOut)}
                      keyboardType='decimal-pad'
                      placeholderTextColor={Colors.WHITE}
                      textStyle={styles.input}
                      placeholder={tokenOut ? '0' : ''}
                    />
                  </View>

                </View>

                {renderTokenOutUSD()}

              </View>
            </View>

            <View style={{ paddingLeft: pixelByWidth(12) }}>
              <MyText variant='small' className={cn('text-red', error ? '' : 'opacity-0')}>
                {error || I18n.t('Content.notEnoughBalance')}
              </MyText>
            </View>

          </KeyboardAwareScrollView>
          <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: getSafeAreaValues().bottom }}>
            <View>
              <I18nWithLinks
                variant='small'
                text={I18n.t('v2.exchange.agreeDescription')}
                links={{
                  termsOfUse: { label: I18n.t('v2.common.termsOfUse'), onPress: () => handleExplorer(TYPE_VIEW_EXPLORER.termsOfService) },
                  privacyPolicy: { label: I18n.t('v2.common.privacyPolicy'), onPress: () => handleExplorer(TYPE_VIEW_EXPLORER.privacyPolicy) }
                }}
              />
            </View>
          </View>
        </View>

      </>
    )
  }

  return (

    // <TouchableNativeFeedback onPress={Keyboard.dismiss}>
    <MyViewPage style={styles.container}>

      {
        tableView === 'enterExchange' && renderEnterExchange()
      }
      {
        tableView === 'confirmExchange' && renderConfirm()
      }

    </MyViewPage>

  // </TouchableNativeFeedback>

  )
}

export default Exchange
