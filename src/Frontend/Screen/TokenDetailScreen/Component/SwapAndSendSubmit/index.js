import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Keyboard, Platform, Dimensions } from 'react-native'
// ScrollView from react-native-gesture-handler: it scrolls inside the gorhom sheet on
// Android (a plain RN ScrollView doesn't) AND, unlike gorhom's BottomSheetScrollView, its
// ref is a normal RN ScrollView with working scrollTo/scrollToEnd (needed for the keyboard
// auto-scroll below).
import { ScrollView } from 'react-native-gesture-handler'

import { useSelector } from 'react-redux'
import { useQuery } from 'react-query'
import BigNumber from 'bignumber.js'
import Clipboard from '@react-native-clipboard/clipboard'
import MyBalance from 'frontend/Components/UI/MyBalance'

import createStyles, { FIELD_VPAD, FIELD_MIN_HEIGHT } from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import MyNumber from 'frontend/Components/UI/MyNumber'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import AddressBookAvatar from 'frontend/Components/Common/AddressBook/Avatar'
import AddressBookManager from '../AddressBookManager'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import useAddressBook from 'frontend/Hooks/useAddressBook'
import useGetTokensLatestTransactions from 'frontend/Hooks/useGetTokensLatestTransactions'
import useCheckMaliciousAddress from 'frontend/Hooks/useCheckMaliciousAddress'
import useGetRawTxExchange from 'frontend/Hooks/useGetRawTxExchange'
import useGetBalanceToken from 'frontend/Hooks/useGetBalanceToken'
import useGasPrice from 'frontend/Hooks/useGasPrice'
import useGetDecimalToken from 'frontend/Hooks/useGetDecimalToken'
import useDebounceValue from 'frontend/Hooks/useDebounceValue'
import { isAddress, serializeTransaction, zeroAddress } from 'viem'
import { KeyboardController, AndroidSoftInputModes } from 'react-native-keyboard-controller'

import images from 'assets/Image'
import I18n from 'assets/Lang'
import { Colors, fontSize, pixelByHeight, pixelByWidth, getFontFamily, getSizeImgSquare } from 'common/styles'
import {
  convertBalanceToWei,
  convertWeiToBalance,
  handleOpenUrl,
  isValidContract,
  isValidEVMAddressFormat as isValidAddress,
  lowerCase
} from 'common/function'
import { getNativeTokenSymbolByChain, getUrlExplorerHash, handleOpenExplorerHash, handleOpenExplorerUserAddress, hasNativeTokenByChain } from 'common/chain'
import { isNativeToken, getAddressNative } from 'common/tokens'
import { NavigationActions } from 'src/navigation/NavigationService'
import InputCustom from 'frontend/Components/UI/InputCustom'
import AutoFitAmountInput from '../Exchange/Components/AutoFitAmountInput'
import { sanitizeAmountText } from '../Exchange/helpers'
import { STEP_EXCHANGE, DEFAULT_GAS_LIMIT, MAX_DECIMAL_2USD, TYPE_VIEW_EXPLORER, MAX_DECIMAL_2USD_GAS_FEE } from '../Exchange'
import { cn, mergeStyle } from 'common/tailwind'
import BtnBack from 'frontend/Components/UI/BtnBack'
import SwapAndSend from '../SwapAndSend'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import { CHAIN_ID_NO_GAS_PRICE_SWAP, PLATFORM_EXCHANGE } from 'common/constants/swap'
import { SWAP_SERVICE_CONFIG, CURRENCY_DATA } from 'common/constants/app'
import useProtocolFee from 'frontend/Hooks/useProtocolFee'
import AllChainServices from 'controller/AllChainServices'

const getAddressFromQR = (raw) => {
  try {
    const parts = (raw || '').split(':')
    const address = parts[1] || parts[0]
    if (address?.startsWith('0x')) {
      const [, queryString] = address.split('?')
      if (queryString) {
        const params = new URLSearchParams(queryString)
        return params.get('address') || params.get('from') || address.slice(0, 42)
      }
      return address.slice(0, 42)
    }
    return address
  } catch (error) {
    return raw
  }
}

const styles = createStyles()

const CircleButton = ({ onPress, icon, label }) => (
  <TouchableOpacity activeOpacity={0.8} disabled={!onPress} style={styles.iconBtn} onPress={onPress}>
    {label
      ? <MyText variant='small' className='text-brand'>{label}</MyText>
      : <MyIcon variant='small' uri={icon} resizeMode='contain' />}
  </TouchableOpacity>
)

const Field = ({ leftIcon, rightButton, children, style }) => (
  <View style={[styles.fieldRow, mergeStyle(style)]}>
    {leftIcon ? <View style={styles.fieldSide}>{leftIcon}</View> : null}
    <View style={styles.fieldLine}>
      <View style={styles.fieldInputPlain}>{children}</View>
      {rightButton ? <View style={styles.fieldSide}>{rightButton}</View> : null}
    </View>
  </View>
)

const HintRow = ({ icon, className, color, text }) => (
  <View style={styles.hintRow}>
    {icon ? <MyIcon uri={icon} style={styles.hintIcon} resizeMode='contain' /> : null}
    <MyText variant='small' className={className} style={color ? { color } : undefined}>{text}</MyText>
  </View>
)

const StatusRow = ({ icon, loading, color, className, text, footer }) => (
  <View style={styles.statusRow}>
    {loading
      ? <View style={styles.statusIcon}><MyDotsLoading source={images.threeDotsWhiteLoading} /></View>
      : (icon ? <MyIcon uri={icon} variant='small' resizeMode='contain' /> : null)}
    <View style={styles.statusTextCol}>
      <MyText variant='small' className={className} style={color ? { color } : undefined}>{text}</MyText>
      {footer}
    </View>
  </View>
)

const SwapAndSendSubmit = ({ _this }) => {
  const {
    state,
    onChangeValueExchange,
    handleSubmitApprove,
    handleSubmitExchange,
    showAlert
  } = _this

  const {
    tokenOut,
    tokenIn,
    chainOut,
    amountIn: amountInDefault,
    amountIn2USD: amountInToUSDDefault,
    recipientAddress: recipientAddressDefault,
    nameAddressBook: nameAddressBookDefault,
    addressBookInfo: addressBookInfoDefault
  } = state.swapAndSend

  const chainIdOut = chainOut?.chainId || tokenIn?.chainId
  const { activeAccount, fiatRateRedux, accountListRedux, blockchainListRedux } = useSelector((s) => s)
  const userAddress = activeAccount?.account?.address

  const locale = useSelector((s) => s.localeRedux)
  const currencyCode = useSelector((s) => s.currencyRedux)
  const [addrTwoLineHeight] = useState(0)
  const fieldHeight = addrTwoLineHeight > 0
    ? Math.max(FIELD_MIN_HEIGHT, Math.ceil(addrTwoLineHeight) + FIELD_VPAD * 2 + 2)
    : null

  useEffect(() => {
    if (Platform.OS !== 'android') return
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING)
    return () => KeyboardController.setDefaultMode()
  }, [])

  const scrollRef = useRef(null)
  const scrollOffsetRef = useRef(0)
  const scrollToY = (y) => scrollRef.current?.scrollTo?.({ y, animated: true })
  const [kbPad, setKbPad] = useState(0)

  useEffect(() => {
    const isIOS = Platform.OS === 'ios'
    const showEvt = isIOS ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvt = isIOS ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvt, (e) => {
      const keyboardTop = e.endCoordinates?.screenY ?? 0
      setKbPad(e.endCoordinates?.height ?? 0)
      const focused = TextInput.State?.currentlyFocusedInput?.()
      if (!focused?.measureInWindow) return
      focused.measureInWindow((_x, y, _w, h) => {
        const overlap = (y + h + pixelByHeight(40)) - keyboardTop
        if (overlap <= 0) return
        setTimeout(() => {
          scrollToY(scrollOffsetRef.current + overlap)
        }, 50)
      })
    })
    const hideSub = Keyboard.addListener(hideEvt, () => setKbPad(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  const [recipientAddress, setRecipientAddress] = useState(recipientAddressDefault)
  const [isAddressErr, setIsAddressErr] = useState(false)
  const [txtAddressBookAlias, setTxtAddressBookAlias] = useState(nameAddressBookDefault)
  const [addressBookInfo, setAddressBookInfo] = useState(addressBookInfoDefault)
  const [isAddressBookNotFound, setIsAddressBookNotFound] = useState(false)
  const [amountIn, setAmountIn] = useState(amountInDefault)
  const [amountInToUSD, setAmountInToUSD] = useState(amountInToUSDDefault)
  const [isFocusAmountInputToUSD, setIsFocusAmountInputToUSD] = useState(false)
  const isFocusAmountInputToUSDRef = useRef(false)
  const [feeL1, setFeeL1] = useState(0)
  // true when the fiat value in the token IN USD field was typed by the user (not derived
  // from a token amount). Keeps the exact number the user entered on blur, instead of the
  // quote's round-tripped value (fiat→token→fiat loses precision, e.g. 1000 -> 999.9592).
  const [isUsdInEdited, setIsUsdInEdited] = useState(false)
  const [amountOut, setAmountOut] = useState('')
  const [isExactInput, setIsExactInput] = useState(true)
  const [error, setError] = useState('')
  const [errorStep, setErrorStep] = useState('')
  const [slippage, setSlippage] = useState(1)
  const [hash, setHash] = useState()
  const [step, setStep] = useState(null)
  const [hasStartedExecute, setHasStartedExecute] = useState(false)
  const [tableView, setTableView] = useState('enter')
  const [amountOutAfterSwap, setAmountOutAfterSwap] = useState('')
  const [requestId, setRequestId] = useState(null)

  const chainId = tokenIn?.chainId
  const isNative = tokenIn?.isNative || isNativeToken(tokenIn?.contractAddress)
  const tokenAddress = isNative ? null : tokenIn?.contractAddress
  const symbol = tokenIn?.symbol || ''
  const nativeSymbol = isNative ? symbol : getNativeTokenSymbolByChain(chainId)

  const { resolveByAddressAsync, resolveByAliasAsync } = useAddressBook()

  const isOwnAccount = useMemo(
    () => !!recipientAddress && (accountListRedux || []).some((a) => a?.address?.toLowerCase() === recipientAddress.toLowerCase()),
    [accountListRedux, recipientAddress]
  )

  const { data: isContractAddr, isLoading: isLoadingContract } = useQuery(
    ['isRecipientContract', recipientAddress, chainId],
    () => isValidContract(chainId, recipientAddress),
    { enabled: !isOwnAccount && isValidAddress(recipientAddress) && !!chainId }
  )

  const { statusAddressTo, typeStatusAddressTo, isLoading: isLoadingHistory } = useGetTokensLatestTransactions(
    userAddress, recipientAddress, isAddressErr, I18n.t('Content.invalidAddr'), chainId, isContractAddr
  )
  const { data: isMaliciousAddress, isLoading: isLoadingMalicious } = useCheckMaliciousAddress(isOwnAccount ? '' : recipientAddress, chainId)

  const isCheckingRecipient = !!recipientAddress && !isAddressErr && !isOwnAccount && (isLoadingHistory || isLoadingContract || isLoadingMalicious)

  const isValidAddressRecipient = useMemo(() => {
    return isAddress(recipientAddress)
  }, [recipientAddress])

  const addressTokenIn = useMemo(() => {
    let addressIn = tokenIn?.contractAddress === 'native' ? zeroAddress : lowerCase(tokenIn?.contractAddress)
    if (isNativeToken(addressIn, tokenIn?.chainId)) {
      addressIn = getAddressNative(tokenIn?.chainId, addressIn)
    }
    return addressIn
  }, [tokenIn])

  const addressTokenOut = useMemo(() => {
    if (!tokenOut) return 'nodata'
    let addressOut = (tokenOut?.address || tokenOut?.contractAddress) === 'native' ? zeroAddress : lowerCase(tokenOut?.address || tokenOut?.contractAddress)
    if (isNativeToken(addressOut, chainIdOut)) {
      addressOut = getAddressNative(chainIdOut, addressOut)
    }
    return addressOut
  }, [tokenOut, chainIdOut])

  const { data: decimalTokenIn, isLoading: loadingDecimalTokenIn } = useGetDecimalToken(tokenIn?.chainId, addressTokenIn)
  const { data: decimalTokenOut, isLoading: loadingDecimalTokenOut } = useGetDecimalToken(chainIdOut, addressTokenOut)
  const { data: gasWeiPriceDefault, isLoading: loadingGasPriceDefault } = useGasPrice(tokenIn?.chainId)
  const { data: balanceTokenIn } = useGetBalanceToken(tokenIn?.chainId, userAddress, addressTokenIn)
  const { data: balanceNative, isLoading: loadingBalanceNative } = useGetBalanceToken(tokenIn?.chainId, userAddress, zeroAddress)

  const isNativeTokenInput = isNativeToken(tokenIn?.contractAddress)
  const chainIn = blockchainListRedux[tokenIn?.chainId]

  const { data: priceTokenInByAPI } = useGetTokenPrice(tokenIn?.chainId, tokenIn?.contractAddress, { refetchInterval: 10000 })
  const { data: priceTokenOutByAPI } = useGetTokenPrice(chainIdOut, tokenOut?.contractAddress || tokenOut?.address, { refetchInterval: 10000 })

  const priceTokenOut = useMemo(() => {
    return priceTokenOutByAPI || tokenOut?.price || tokenOut?.priceUSD || null
  }, [tokenOut, priceTokenOutByAPI])

  const priceTokenIn = useMemo(() => {
    return priceTokenInByAPI || tokenIn?.price || tokenIn?.priceUSD || null
  }, [tokenIn, priceTokenInByAPI])

  const { data: livePriceData } = useGetTokenPrice(chainId, isNative ? zeroAddress : tokenAddress, { cacheTime: 0, staleTime: 0 })
  const livePriceUSD = Number(livePriceData)
  const priceUSD = livePriceUSD > 0 ? livePriceUSD : Number(tokenIn?.priceUSD || 0)

  const { data: nativePriceData } = useGetTokenPrice(chainId, zeroAddress)
  const nativePriceUSD = isNative ? priceUSD : Number(nativePriceData || 0)

  const isCrossChain = useMemo(() => {
    return tokenIn?.chainId?.toString() !== chainIdOut?.toString()
  }, [tokenIn, chainIdOut])

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

  // Convert a plain-USD value to the fiat amount shown in the editable token IN field,
  // rounding IDENTICALLY to FiatBalance: multiply by the fiat rate, then toFixed at
  // MAX_DECIMAL_2USD (toFixed = half-up, same as MyNumber's toLocaleString). Returns a plain
  // number string (no separators/symbol) for a TextInput value. Accepts a BigNumber or
  // anything Number() understands.
  const toFiatAmount = useCallback((usd) => {
    const rate = fiatRateRedux > 0 ? fiatRateRedux : 1
    const fiatValue = Number(usd?.toString?.() ?? usd) * rate
    if (!Number.isFinite(fiatValue)) {
      return ''
    }
    return BigNumber(fiatValue.toFixed(MAX_DECIMAL_2USD)).toFixed()
  }, [fiatRateRedux])

  // Plain-USD value for the token IN row. When the user typed the fiat value directly
  // (isUsdInEdited), keep it verbatim by converting that fiat back to USD (÷ rate) instead of
  // round-tripping through price × amount (which loses precision, e.g. 1000 -> 999.9592).
  // Full precision; getFormattedValue re-applies the rate, so this is plain USD.
  const amountInUsdForDisplay = useMemo(() => {
    if (isUsdInEdited && amountInToUSD != null && amountInToUSD !== '' && !isNaN(Number(amountInToUSD))) {
      return BigNumber(amountInToUSD).div(fiatRateRedux > 0 ? fiatRateRedux : 1).toString()
    }
    return amountInUsd
  }, [isUsdInEdited, amountInToUSD, amountInUsd, fiatRateRedux])

  const scrollToFocusedInput = () => {
    setTimeout(() => {
      const focused = TextInput.State?.currentlyFocusedInput?.()
      if (!focused?.measureInWindow) return
      focused.measureInWindow((_x, y, _w, h) => {
        const kbHeight = kbPad || 300
        const keyboardTop = Dimensions.get('window').height - kbHeight
        const overlap = (y + h + pixelByHeight(40)) - keyboardTop
        if (overlap <= 0) return
        scrollToY(scrollOffsetRef.current + overlap)
      })
    }, 100)
  }

  const onInputAddress = async (newAddress, isFromScan = false) => {
    const address = isFromScan ? getAddressFromQR(newAddress) : newAddress
    setRecipientAddress(address)
    setTxtAddressBookAlias('')
    onChangeValueExchange(
      {
        recipientAddress: address,
        nameAddressBook: '',
        addressBookInfo: null
      },
      false
    )
    setAddressBookInfo(null)
    setIsAddressBookNotFound(false)
    const valid = address.length > 0 && isValidAddress(address)
    setIsAddressErr(address.length > 0 && !valid)
    if (valid) {
      const info = await resolveByAddressAsync(address)
      if (info?.info) {
        setAddressBookInfo(info)
        setTxtAddressBookAlias(info.info.nickname || info.info.email || '')
        onChangeValueExchange(
          {
            addressBookInfo: info,
            nameAddressBook: info.info.nickname || info.info.email || ''
          },
          false
        )
      }
    }
  }

  const onInputAddressBookAlias = (text) => {
    setTxtAddressBookAlias(text)
    onChangeValueExchange({
      nameAddressBook: text,
      recipientAddress: '',
      addressBookInfo: null
    }, false)
    setRecipientAddress('')
    setAddressBookInfo(null)
    setIsAddressBookNotFound(false)
    setIsAddressErr(false)
  }

  const handleResolveAddressBookByAlias = async () => {
    if (!txtAddressBookAlias) return
    const info = await resolveByAliasAsync(txtAddressBookAlias)
    if (info?.info?.address && isValidAddress(info.info.address)) {
      setAddressBookInfo(info)
      setIsAddressBookNotFound(false)
      setRecipientAddress(info.info.address)
      setIsAddressErr(false)
      onChangeValueExchange(
        {
          recipientAddress: info.info.address,
          nameAddressBook: info.info.nickname || info.info.email || '',
          addressBookInfo: info
        },
        false
      )
    } else {
      setAddressBookInfo(null)
      setIsAddressBookNotFound(true)
      setRecipientAddress('')
      setIsAddressErr(false)
      onChangeValueExchange(
        {
          recipientAddress: '',
          nameAddressBook: '',
          addressBookInfo: null
        },
        false
      )
    }
  }

  const onSelectEntry = (entry) => {
    setTxtAddressBookAlias(entry?.info?.nickname || entry?.info?.email || '')
    setAddressBookInfo(entry)
    setIsAddressBookNotFound(false)
    setIsAddressErr(false)
    const entryAddress = isValidAddress(entry?.info?.address) ? entry.info.address : ''
    setRecipientAddress(entryAddress)
    onChangeValueExchange({
      recipientAddress: entryAddress,
      addressBookInfo: entry,
      nameAddressBook: entry?.info?.nickname || entry?.info?.email || ''
    }, false)
  }

  const openAddressBookManager = () => {
    Keyboard.dismiss()
    _this.openDrawer({
      addDrawer: true,
      children: (
        <AddressBookManager
          _this={_this}
          onSelectAccount={(address) => { onInputAddress(address); _this.closeDrawer() }}
          onSelectEntry={(entry) => { onSelectEntry(entry); _this.closeDrawer() }}
        />
      )
    })
  }

  const isValidRecipient = !!recipientAddress && isValidAddress(recipientAddress) && !isAddressErr

  const amountInDebounce = useDebounceValue(isExactInput ? amountIn : '', 500)
  const amountOutDebounce = useDebounceValue(isExactInput ? '' : amountOut, 500)

  const queryGetRawTxExchange = useMemo(() => {
    if (tokenOut && !loadingDecimalTokenIn && !loadingDecimalTokenOut && isValidRecipient) {
      if (lowerCase(addressTokenIn) === lowerCase(addressTokenOut) && tokenIn?.chainId?.toString() === chainIdOut?.toString()) {
        return null
      }
      if (amountInDebounce && isExactInput) {
        if (!BigNumber(amountInDebounce).gt(0)) return null
        return {
          srcChainId: tokenIn?.chainId,
          srcTokenAddress: addressTokenIn,
          srcTokenAmount: convertBalanceToWei(amountInDebounce, decimalTokenIn),
          dstChainId: chainIdOut,
          dstTokenAddress: addressTokenOut,
          recipientAddress,
          slippage,
          senderAddress: userAddress,
          tradeType: 'EXACT_INPUT'
        }
      }
      if (amountOutDebounce && !isExactInput) {
        if (!BigNumber(amountOutDebounce).gt(0)) return null
        return {
          srcChainId: tokenIn?.chainId,
          srcTokenAddress: addressTokenIn,
          srcTokenAmount: convertBalanceToWei(amountOutDebounce, decimalTokenOut),
          dstChainId: chainIdOut,
          dstTokenAddress: addressTokenOut,
          recipientAddress,
          slippage,
          senderAddress: userAddress,
          tradeType: 'EXPECTED_OUTPUT'
        }
      }
    }
    return null
  }, [loadingDecimalTokenOut, loadingDecimalTokenIn, addressTokenIn, addressTokenOut, decimalTokenIn, decimalTokenOut, tokenIn, tokenOut, isExactInput, amountInDebounce, amountOutDebounce, chainIdOut, slippage, recipientAddress, isValidRecipient, userAddress])

  const isExecuting = hasStartedExecute || step != null || !!hash?.approve || !!hash?.exchange
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

  const isHasApprove = useMemo(() => rawTransaction?.approveStep?.id === 'approve', [rawTransaction])

  const feeGas = useMemo(() => {
    let totalFee = '0.00000001'
    if (gasWeiPriceDefault && !loadingGasPriceDefault) {
      const gasPrice = convertWeiToBalance(gasWeiPriceDefault)
      totalFee = new BigNumber(gasPrice).multipliedBy(gasLimitRawTx || DEFAULT_GAS_LIMIT).toString()

      totalFee = BigNumber(totalFee).plus(feeProtocol || '0').toFixed()
      totalFee = BigNumber(totalFee).plus(feeL1 || '0').toFixed()

      // if the user has not approved the token, add fee of approve transaction
      // add 0.5x gasLimit fee for approve transaction
      // the approve is a separate transaction, so its own L1 data fee is added as well
      if (isHasApprove) {
        const feeApprove = BigNumber(gasPrice).multipliedBy(BigNumber(DEFAULT_GAS_LIMIT).multipliedBy(0.5)).toFixed()
        totalFee = BigNumber(totalFee).plus(feeApprove).toFixed()
        totalFee = BigNumber(totalFee).plus(feeL1).toFixed()
      }
    }
    return totalFee
  }, [gasWeiPriceDefault, feeL1, isHasApprove, gasLimitRawTx, feeProtocol, loadingGasPriceDefault])

  const minBalanceAddToSwap = useMemo(() => {
    const amount = BigNumber(feeGas).minus(balanceNative || '0').decimalPlaces(8)
    if (amount.lte(0)) return '0'
    return amount.toFixed()
  }, [feeGas, balanceNative])

  useEffect(() => {
    // The L1 data fee every OP-Stack rollup charges on top of L2 execution — NOT
    // an Optimism-only cost. It used to be gated to chainId 10 AND read off
    // Optimism's own oracle, so Base, Ink, Katana and every other rollup priced
    // their transactions with the L1 half missing. hasL1DataFee decides by looking
    // for the predeploy, so a rollup added later is covered without touching this
    // file. Its weight varies by chain: post-blob it is 0.3–2% of the fee on
    // OP-Stack, but on Scroll it is nearly the whole fee and grows with the
    // byte size of the serialized transaction passed in.
    const getGasFeeLayer1 = async () => {
      try {
        const chainId = tokenIn?.chainId
        const isRollup = await AllChainServices.hasL1DataFee(chainId)

        if (isRollup) {
          let data
          if (rawTransaction?.tx) {
            data = serializeTransaction({
              ...rawTransaction?.tx,
              gasLimit: gasLimitRawTx

            })
          }
          const feeWei = await AllChainServices.estimateL1DataFee(false, chainId, userAddress, addressTokenIn, data)
          const feeEther = BigNumber(convertWeiToBalance(feeWei, 18)).multipliedBy(1.1).decimalPlaces(18).toFixed()

          if (BigNumber(feeL1).lt(feeEther)) {
            setFeeL1(feeEther)
          }
        }
      } catch {
        // do something
      }
    }
    getGasFeeLayer1()
  }, [tokenIn, userAddress, addressTokenIn, gasLimitRawTx, rawTransaction])

  useEffect(() => {
    if (!rawTransaction?.estimation) return
    if (isExactInput) {
      const tokenOutEst = rawTransaction?.estimation?.dstChainTokenOut
      if (tokenOutEst) {
        const balanceWei = tokenOutEst?.amount || '0'
        const decimal = tokenOutEst?.decimals || 18
        setAmountOut(convertWeiToBalance(balanceWei, decimal))
      }
    } else {
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
      }
    }
  }, [rawTransaction, isExactInput, tokenIn, priceTokenIn, toFiatAmount])

  useEffect(() => {
    if (tokenIn && tokenOut && isValidRecipient) {
      if (lowerCase(addressTokenIn) === lowerCase(addressTokenOut) && !isCrossChain) {
        setError(I18n.t('ExchangeScreen.sameTokenError'))
      } else if (rawTransaction?.errorMessage) {
        setError(rawTransaction?.errorMessage)
      } else {
        let balanceUserAfterFeeGas = balanceTokenIn
        if (isNativeTokenInput) {
          balanceUserAfterFeeGas = BigNumber(balanceUserAfterFeeGas).minus(feeGas)
        } else {
          if (BigNumber(balanceNative).lte(feeGas)) {
            setError(I18n.t('Initial.feeTokenNeedSwap', {
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
    if (feeGas && balanceNative && !loadingGasPriceDefault && !loadingBalanceNative) {
      if (BigNumber(feeGas).gte(balanceNative)) {
        setError(I18n.t('Initial.feeTokenNeedSwap', {
          amount: minBalanceAddToSwap,
          item: isNativeTokenInput ? tokenIn?.symbol : chainIn?.nativeCurrency?.symbol
        }))
      }
    }
  }, [addressTokenOut, addressTokenIn, isCrossChain, chainIn, minBalanceAddToSwap, loadingBalanceNative, loadingGasPriceDefault, feeGas, balanceNative, tokenIn, tokenOut, rawTransaction, isNativeTokenInput, amountIn, balanceTokenIn, isValidRecipient])

  useEffect(() => {
    if (scrollRef.current && step) {
      scrollRef.current.scrollToEnd({ animated: true })
    }
  }, [step])

  useEffect(() => {
    onChangeValueExchange({ recipientAddress }, false)
  }, [recipientAddress])

  const onChangeAmountIn = (value) => {
    setIsExactInput(true)
    setIsUsdInEdited(false)
    const valueSanitize = sanitizeAmountText(value, decimalTokenIn)
    setAmountIn(valueSanitize)

    if (!priceTokenIn) {
      return
    }

    const price = BigNumber(priceTokenIn || 0)
    const amountInRaw = BigNumber(value || 0)

    // amountInToUSD is the editable fiat field's value — round it exactly like FiatBalance
    // (toFiatAmount); the full-precision USD used for calculations lives in amountInUsd.
    const fiatBalance = toFiatAmount(amountInRaw.multipliedBy(price))
    setAmountInToUSD(fiatBalance)
  }

  const onChangeAmountOut = (value) => {
    setIsExactInput(false)
    setIsUsdInEdited(false)
    const valueSanitize = sanitizeAmountText(value, decimalTokenOut)
    setAmountOut(valueSanitize)
  }

  const handleMax = () => {
    if (!isValidAddressRecipient) {
      return
    }
    const feeTx = feeGas
    let balanceUser = BigNumber(balanceTokenIn || 0).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    if (isNativeTokenInput) {
      balanceUser = BigNumber(balanceUser).minus(feeTx).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    }
    if (BigNumber(balanceUser).lte(0)) return
    setIsExactInput(true)
    setIsUsdInEdited(false)
    setAmountIn(balanceUser)

    const price = BigNumber(priceTokenIn || 0)
    const amountInFinal = BigNumber(balanceUser || 0)

    // amountInToUSD is the editable fiat field's value — round it exactly like FiatBalance
    // (toFiatAmount); the full-precision USD used for calculations lives in amountInUsd.
    const fiatBalance = toFiatAmount(amountInFinal.multipliedBy(price))
    setAmountInToUSD(fiatBalance)
  }

  // On blur the editable fiat field must show exactly what FiatBalance renders (same math as
  // toFiatAmount), then adds thousands separators + trims trailing zeros exactly like
  // MyNumber — so blur, focus, and the Confirm screen all render the identical number.
  const getFormattedValue = () => {
    if (amountInUsdForDisplay == null) {
      return ''
    }
    const fiatValue = Number(amountInUsdForDisplay) * (fiatRateRedux > 0 ? fiatRateRedux : 1)
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

  // User types a fiat amount for the INPUT (token OUT USD is read-only). Convert
  // fiat → USD → token amount using the token's USD price.
  const onChangeAmountToUsd = (value, decimal) => {
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
    const usd = BigNumber(valueSanitize || 0).div(fiatRateRedux > 0 ? fiatRateRedux : 1)

    let amountIn = usd.dividedBy(price).decimalPlaces(decimalTokenIn, BigNumber.ROUND_DOWN).toFixed()
    if (isNaN(amountIn) || amountIn === 'NaN' || amountIn?.includes('e-') || amountIn?.includes('-e')) {
      amountIn = '0'
    }

    setIsExactInput(true)
    setAmountIn(amountIn)
  }

  // Token IN USD row: editable. User can type a fiat amount and we back-compute the token.
  // `amountInToUSD` holds the fiat-side value (already × rate), kept to MAX_DECIMAL_2USD so it
  // reads like a currency amount. While focused we show that raw value so typing stays smooth
  // (no reformatting mid-keystroke); on blur getFormattedValue() renders the same 2-decimal
  // number — so tapping in shows exactly what was displayed, not a long decimal.
  const renderTokenInUSD = () => {
    const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
    const isSuffixSymbol = cur.position === 'suffix'
    const textValue = isFocusAmountInputToUSD ? amountInToUSD : getFormattedValue()

    // The currency symbol renders INSIDE the input value (prefix before the number,
    // suffix after it) — never as a sibling <Text>. A separate Text can't share the
    // TextInput's line-box on every device, so its glyph drifts off the digits'
    // baseline. Inside the value, alignment comes free.
    const prefixSymbol = cur.position !== 'suffix' ? cur.symbol : ''
    const suffixSymbol = cur.position === 'suffix' ? ` ${cur.symbol}` : ''

    const displayValue = isFocusAmountInputToUSD
      ? `${prefixSymbol}${textValue || ''}${suffixSymbol}`
      : textValue ? `${prefixSymbol}${textValue}${suffixSymbol}` : ''

    // Suffix: pin the caret to the END OF THE NUMBER (before the symbol) while
    // editing, so Backspace removes a digit — never the symbol — and new digits
    // insert before it. Prefix needs no pinning: the symbol leads, so it is
    // unreachable from the string's end.
    const selection = isSuffixSymbol && isFocusAmountInputToUSD
      ? { start: displayValue.length - suffixSymbol.length, end: displayValue.length - suffixSymbol.length }
      : undefined

    const onBlur = () => {
      isFocusAmountInputToUSDRef.current = false
      setIsFocusAmountInputToUSD(false)
    }
    const onFocus = () => {
      isFocusAmountInputToUSDRef.current = true
      setIsFocusAmountInputToUSD(true)
    }

    return (
      <View style={{ flexDirection: 'row', display: 'flex', alignItems: 'center' }}>
        <View style={{ width: '100%', position: 'relative' }}>
          <InputCustom
            variant='empty'
            useNativePlaceholder
            isDisable={!isValidAddressRecipient}
            onBlur={onBlur}
            onFocus={onFocus}
            value={displayValue}
            selection={selection}
            onChangeText={value => {
              value = value.toString()?.replace?.(cur.symbol, '')?.trim?.()
              onChangeAmountToUsd(value, MAX_DECIMAL_2USD)
            }}
            height={0}
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

  const feeFiat = useMemo(() => {
    return BigNumber(feeGas).multipliedBy(nativePriceUSD || 1).multipliedBy(fiatRateRedux || 1).toNumber()
  }, [feeGas, nativePriceUSD, fiatRateRedux])

  const timeDuration = tokenIn?.chainId?.toString() === '1' ? I18n.t('v2.exchange.timeOneMin') : I18n.t('v2.exchange.timeFewSeconds')

  const canSend = (
    isValidRecipient &&
    !!amountIn &&
    BigNumber(amountIn).gt(0) &&
    !!tokenOut &&
    !loadingGetQuote &&
    !!rawTransaction?.tx && !error

  )

  const getAmountToUSD = (isTokenOut = false) => {
    if (isTokenOut && amountOut && priceTokenOut) {
      return BigNumber(amountOut).multipliedBy(priceTokenOut).toFixed()
    }
    if (!isTokenOut && amountIn && priceTokenIn) {
      return BigNumber(amountIn).multipliedBy(priceTokenIn).toFixed()
    }
    return 0
  }

  const callbackStep = (nextStep, data) => {
    setStep(nextStep)
    if (nextStep <= STEP_EXCHANGE.approving) {
      // approving
    }
    if (nextStep === STEP_EXCHANGE.approve) {
      setHash(pre => ({ ...pre, approve: data }))
    }
    if (nextStep === STEP_EXCHANGE.exchange) {
      setHash(pre => ({ ...pre, exchange: data?.hash }))
      if (data?.requestId) {
        setRequestId(data?.requestId)
      }
      if (BigNumber(data?.amountOut || '0').gt(0)) {
        setAmountOutAfterSwap(data?.amountOut)
      }
    }
    if (data?.error) {
      setErrorStep(typeof data.error === 'string' ? data.error : I18n.t('GlobalError.somethingWrongErr'))
    }
  }

  const handleExecute = async () => {
    setHasStartedExecute(true)
    if (isHasApprove && !hash?.approve) {
      const rawApprove = rawTransaction?.approveStep?.items[0]?.data
      const raw = {
        data: rawApprove.data,
        to: rawApprove.to,
        from: rawApprove.from,
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
      await handleSubmitApprove(raw, callbackStep, 'swapAndSend')
    } else {
      const raw = {
        data: rawTransaction?.tx.data,
        to: rawTransaction?.tx.to,
        from: rawTransaction?.tx.from || userAddress,
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

      await handleSubmitExchange(raw, rawTransaction.provider, callbackStep, 'swapAndSend')
    }
  }

  const handleCopy = () => {
    if (!hash?.exchange) return
    const linkScanHash = getUrlExplorerHash(hash?.exchange, Number(tokenIn?.chainId?.toString()))
    Clipboard.setString(linkScanHash)
    showAlert && showAlert(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), null, { type: 'toast' })
  }

  const handleGoBack = () => {
    _this.openDrawer({
      children: (
        <SwapAndSend _this={_this} />
      )
    })
  }

  const handleExplorer = (type) => {
    if (type === TYPE_VIEW_EXPLORER.hashApprove) {
      handleOpenExplorerHash(hash?.approve, Number(tokenIn.chainId?.toString()))
      return
    }
    if (type === TYPE_VIEW_EXPLORER.hashExchange) {
      handleOpenExplorerHash(hash?.exchange, Number(tokenIn.chainId?.toString()))
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
    }
  }

  const onSend = () => {
    Keyboard.dismiss()
    setTableView('submit')
    handleExecute()
  }

  const getImpactPercent = () => {
    let impactPercent = 0

    if (amountInUsd && amountOutUsd) {
      impactPercent = BigNumber(amountInUsd || 0).gt(0)
        ? BigNumber(amountOutUsd || 0)
          .minus(amountInUsd)
          .dividedBy(amountInUsd)
          .multipliedBy(100)
          .toNumber()
        : 0
    }

    return impactPercent
  }

  const renderAddressStatus = () => {
    if (isAddressErr) return <StatusRow className='text-red' text={I18n.t('Content.invalidAddr')} />
    if (!recipientAddress) return null
    if (isOwnAccount) return <StatusRow icon={images.UIV2.icons.informationWhite} className='text-white' text={I18n.t('v2.sendToken.inThisWallet')} />
    if (isCheckingRecipient) return <StatusRow loading className='text-medium' text={I18n.t('v2.sendToken.checkingHistory')} />
    if (isMaliciousAddress) {
      return (
        <StatusRow
          icon={images.UIV2.icons.warning}
          color={Colors.YELLOW}
          text={I18n.t('Content.thisIsASuspiciousAddress')}
          footer={(
            <View style={styles.goPlusRow}>
              <MyText variant='small' className='text-medium'>{I18n.t('v2.sendToken.poweredByGoPlus')}</MyText>
              <ImageRender uri={images.iconGoPlus} style={styles.goPlusLogo} resizeMode='contain' />
            </View>
          )}
        />
      )
    }
    if (isContractAddr) return <StatusRow icon={images.UIV2.icons.contract} className='text-white' text={I18n.t('Content.thisisthesmartcontractaddress')} />
    if (statusAddressTo === typeStatusAddressTo.availableMoreThanOne || statusAddressTo === typeStatusAddressTo.available) {
      return <StatusRow icon={images.UIV2.icons.success} className='text-green' text={I18n.t('v2.sendToken.hasTransferRecord')} />
    }
    if (statusAddressTo === typeStatusAddressTo.warning) {
      return <StatusRow icon={images.UIV2.icons.informationWhite} className='text-white' text={I18n.t('v2.sendToken.firstTransfer')} />
    }
    return null
  }

  const renderButton = () => {
    if (isHasApprove && !hash?.approve) {
      return (
        <MyButton
          variant='default'
          disableLiquidGlass
          isLoading={loadingGetQuote || loadingFeeProtocol}
          isDisable={!canSend || step === STEP_EXCHANGE.approving || step === STEP_EXCHANGE.approve}
          label={I18n.t('Initial.ExchangeApprove')}
          onPress={onSend}
        />
      )
    }
    return (
      <MyButton
        variant='primary'
        isLoading={loadingGetQuote || loadingFeeProtocol}
        isDisable={!canSend || (step >= STEP_EXCHANGE.exchanging && step !== STEP_EXCHANGE.failed)}
        label={I18n.t('Initial.send')}
        onPress={onSend}
      />
    )
  }

  const isSubmitting = tableView === 'submit'

  const renderEnter = () => (
    <>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('Initial.send')}
        leftIcon={(
          <View>
            <BtnBack onPress={handleGoBack} />
          </View>
        )}
        rightElement={
          (recipientAddress || amountIn) ? renderButton() : null
        }
      />
      <View style={{ paddingTop: pixelByHeight(8) }}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent?.contentOffset?.y ?? 0 }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.content, kbPad ? { paddingBottom: kbPad } : null]}
        >
          <View style={isSubmitting ? styles.dimmedForm : null} pointerEvents={isSubmitting ? 'none' : 'auto'}>
            <Text
              key={locale}
              style={{ position: 'absolute', left: 0, top: 0, opacity: 0, padding: 0, fontFamily: getFontFamily(), fontSize: 16 }}
              // onLayout={(e) => {
              //   const h = e.nativeEvent?.layout?.height || 0
              //   if (h && Math.abs(h - addrTwoLineHeight) > 0.5) setAddrTwoLineHeight(h)
              // }}
            >
              {'0\n0'}
            </Text>

            <MyText variant='subTitle' className='text-medium' fontWeight={700}>{I18n.t('v2.sendToken.destinationAddress')}</MyText>
            <InputCustom
              noErrorSpace
              typeInput='area'
              containerConfig={{ style: styles.inputTopGap }}
              inputWrapperConfig={{ style: [styles.addressAreaWrapper, fieldHeight && { height: fieldHeight }] }}
              inputConfig={{ style: [styles.addressAreaInput, { fontSize: fontSize(18, false, true) }] }}
              value={recipientAddress}
              onChangeText={(text) => onInputAddress(text)}
              onFocus={scrollToFocusedInput}
              placeholder={isAddressBookNotFound ? I18n.t('addressBook.noRegistration') : I18n.t('v2.sendToken.receiveAddress')}
              placeholderTextColor={isAddressBookNotFound ? Colors.RED_TEXT : Colors.TEXT_LOW}
              placeholderConfig={{ style: { fontSize: fontSize(18, false, true) } }}
              rightIconOutside
              rightIcon={(
                <CircleButton
                  icon={images.UIV2.icons.qrScan}
                  onPress={() => {
                    Keyboard.dismiss()
                    NavigationActions.navigate('qrCodeScreen', { setQrCode: (address) => onInputAddress(address, true) })
                  }}
                />
              )}
            />

            <InputCustom
              noErrorSpace
              inputConfig={{ style: { fontSize: fontSize(18, false, true) } }}
              inputWrapperConfig={{ style: [styles.addressInputWrapper, fieldHeight && { minHeight: fieldHeight }] }}
              containerConfig={{ style: [{ gap: 0 }, styles.inputTopGap] }}
              value={txtAddressBookAlias}
              onChangeText={onInputAddressBookAlias}
              onSubmitEditing={handleResolveAddressBookByAlias}
              onBlur={handleResolveAddressBookByAlias}
              onFocus={scrollToFocusedInput}
              returnKeyType='search'
              placeholder={I18n.t('v2.sendToken.searchByAddressBook')}
              placeholderConfig={{ style: { fontSize: fontSize(18, false, true) } }}
              leftIconInside
              leftIcon={addressBookInfo?.info?.avatar
                ? (
                  <AddressBookAvatar
                    base64Data={addressBookInfo?.info?.avatar}
                    customAvatar={addressBookInfo?.info?.customAvatar}
                    style={styles.abAvatar}
                    avatarStyle={styles.abAvatarImg} />
                )
                : undefined}
              rightIconOutside
              rightIcon={<CircleButton icon={images.UIV2.icons.addressBook} onPress={openAddressBookManager} />}
            />
            <View style={styles.addressStatusSpace}>
              {!!addressBookInfo?.info?.freeText && (
                <MyText variant='small' className='text-medium' style={styles.addressBookFreeText}>
                  {addressBookInfo.info.freeText}
                </MyText>
              )}
              {renderAddressStatus()}
            </View>

            <MyText
              variant='subTitle'
              className='text-medium'
              fontWeight={700}
              style={styles.quantityWithNote}
            >
              {I18n.t('v2.sendToken.quantityToSend')}
            </MyText>
            <Field
              style={{ minHeight: pixelByHeight(62), opacity: !isValidAddressRecipient ? 0.5 : 1 }}
              leftIcon={<TokenIconWithChain tokenIconUri={tokenIn?.iconUrl} chainId={chainId} style={styles.tokenIcon} />}
              rightButton={<CircleButton label={I18n.t('v2.common.max')} onPress={handleMax} />}
            >
              <AutoFitAmountInput
                disabled={!isValidAddressRecipient}
                value={amountIn}
                onChangeText={onChangeAmountIn}
                keyboardType='numeric'
                minScale={0}
                placeholder={I18n.t('v2.sendToken.amountToSend')}
                placeholderStyle={styles.amountPlaceholder}
                textStyle={styles.amountInput}
                onFocus={scrollToFocusedInput}
              />
            </Field>

            {tokenOut && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12) }}>
                  <View style={{ width: getSizeImgSquare('large'), alignItems: 'center' }}>
                    <MyIcon uri={images.UIV2.icons.goArrowDownMedium} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {renderTokenInUSD()}
                  </View>
                </View>
                <Field
                  style={{ minHeight: pixelByHeight(62), opacity: !isValidAddressRecipient ? 0.5 : 1 }}
                  leftIcon={(
                    <TokenIconWithChain
                      chainId={chainIdOut}
                      chainIconUrl={chainOut?.iconUrl}
                      tokenIconUri={tokenOut?.icon_image || tokenOut?.logoURI || tokenOut?.metadata?.logoURI || tokenOut?.iconUrl || images.UIV2.icons.noTokenOutExchange}
                      style={styles.tokenIcon}
                    />
                  )}
                >
                  <AutoFitAmountInput
                    disabled={!isValidAddressRecipient}
                    value={amountOut}
                    onChangeText={onChangeAmountOut}
                    keyboardType='numeric'
                    minScale={0}
                    placeholder={I18n.t('v2.sendToken.amountToBeReceived')}
                    placeholderStyle={styles.amountPlaceholder}
                    textStyle={styles.amountInput}
                    onFocus={scrollToFocusedInput}
                  />
                </Field>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12) }}>
                    <View style={{ width: getSizeImgSquare('large'), alignItems: 'center' }} />
                    <View style={{ opacity: getAmountToUSD(true) ? 1 : 0 }}>
                      <MyTextTicker>
                        <FiatBalance fractionDigits={MAX_DECIMAL_2USD} className='text-medium' valueUSD={getAmountToUSD(true)} />
                        {
                          !!getImpactPercent() && (
                            <MyBalance
                              variant='small'
                              className='text-medium'
                              style={{ position: 'relative' }}
                              value={getImpactPercent()}
                              fractionDigits={2}
                              fixedDecimals
                              signed
                              prefix=' ('
                              suffix='%)'
                            />
                          )
                        }

                      </MyTextTicker>
                    </View>

                  </View>
                  <View style={styles.amountErrorSpace}>
                    {!!error && (
                      <HintRow className='text-red' text={error} />
                    )}
                  </View>
                </View>
              </>
            )}

            <View style={styles.footer}>
              {/* Chains with no native coin (Tempo) answer eth_getBalance with a
              sentinel, not a balance — there is nothing real to show here. The
              fee row below is unaffected: its `|| 1` fallback already prices the
              USD-denominated gas unit correctly. */}
              {hasNativeTokenByChain(chainId) && (
                <View style={styles.footerRow}>
                  <MyText className='text-medium'>{I18n.t('v2.sendToken.nativeBalance', { symbol: nativeSymbol })}</MyText>
                  <MyNumber className='text-white' value={balanceNative} fractionDigits={8} suffix={` ${nativeSymbol}`} />
                </View>
              )}
              <View style={styles.footerRow}>
                <MyText className='text-medium'>{I18n.t('v2.sendToken.transactionFee')}</MyText>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <MyTextTicker className='text-medium' variant='small'>

                    <FiatBalance className='text-white' fractionDigits={MAX_DECIMAL_2USD_GAS_FEE} valueUSD={feeFiat} />
                  </MyTextTicker>
                </View>

              </View>
            </View>

            <View style={styles.slippageRow}>
              <MyText className='text-medium'>{I18n.t('v2.exchange.slippageTolerance')}</MyText>
              <View className='flex flex-row justify-end' style={{ opacity: isExecuting ? 0.4 : 1 }}>
                {[0.5, 1, 2, 3].map((itemSlippage) => {
                  const isSelected = slippage === itemSlippage
                  return (
                    <TouchableOpacity
                      style={{ minWidth: pixelByWidth(40), paddingHorizontal: pixelByWidth(6), justifyContent: 'center', alignItems: 'center' }}
                      activeOpacity={1}
                      disabled={isExecuting}
                      onPress={() => { if (!isSelected) setSlippage(itemSlippage) }}
                      key={`slippage-${itemSlippage}`}
                    >
                      <MyText numberOfLines={1} fontWeight={700} className={cn('text-nowrap', isSelected ? '' : 'text-low')}>
                        {itemSlippage}
                      </MyText>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </View>
          </View>

          {isSubmitting && renderSteps()}
        </ScrollView>
      </View>
    </>
  )

  const renderSteps = () => (
    <View style={styles.stepWrap}>
      {step >= STEP_EXCHANGE.approving && isHasApprove && (
        <View style={styles.stepRow}>
          <TxStepIcon uri={images.UIV2.icons.approve} />
          <View style={{ flex: 1 }}>
            <View style={styles.sendingTitleRow}>
              <MyText fontWeight={700}>{I18n.t('Initial.ExchangeApprove')}</MyText>
              {step === STEP_EXCHANGE.approving && <MyDotsLoading source={images.threeDotsWhiteLoading} />}
            </View>
            <MyText className='text-medium'>{I18n.t('v2.exchange.approxTime', { value: timeDuration })}</MyText>
          </View>
        </View>
      )}

      {hash?.approve && (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12) }}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity activeOpacity={1} onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.hashApprove)}>
                  <MyText className='text-brand'>{hash.approve}</MyText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      )}

      {
        (
          (step >= STEP_EXCHANGE.exchanging && !isHasApprove) ||
        (step >= STEP_EXCHANGE.exchanging && isHasApprove && hash?.approve)
        ) && (
          <View style={styles.stepRow}>
            <TxStepIcon uri={images.UIV2.icons.icon_send_outline} />
            <View style={{ flex: 1 }}>
              <View style={styles.sendingTitleRow}>
                <MyText fontWeight={700}>{I18n.t('Initial.sending')}</MyText>
                {step === STEP_EXCHANGE.exchanging && <MyDotsLoading source={images.threeDotsWhiteLoading} />}
              </View>
              <MyText className='text-medium'>{I18n.t('v2.exchange.approxTime', { value: timeDuration })}</MyText>
            </View>
          </View>
        )
      }

      {step >= STEP_EXCHANGE.exchange && hash?.exchange && (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12) }}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity activeOpacity={1} onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.hashExchange)}>
                  <MyText className='text-brand'>{hash.exchange}</MyText>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
                <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
              </TouchableOpacity>
            </View>
            {
              bridgeProvider === PLATFORM_EXCHANGE.relay && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(4), marginTop: pixelByHeight(4) }}>
                  <MyIcon uri={images.UIV2.icons.relayIcon} />
                  <TouchableOpacity onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.relayLink)} activeOpacity={1}>
                    <MyText className='text-brand'>{I18n.t('v2.exchange.viewRelayExplorer')}</MyText>
                  </TouchableOpacity>
                </View>
              )
            }

            {
              requestId && bridgeProvider === PLATFORM_EXCHANGE.deBridge && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(4), marginTop: pixelByHeight(4) }}>
                  <MyIcon uri={images.UIV2.icons.deBridgeExplorer} />
                  <TouchableOpacity onPress={() => handleExplorer(TYPE_VIEW_EXPLORER.relayLink)} activeOpacity={1}>
                    <MyText className='text-brand'>{I18n.t('v2.exchange.viewDeBridgeExplorer')}</MyText>
                  </TouchableOpacity>
                </View>
              )
            }

          </View>
        </View>
      )}

      {!hash?.approve && step === STEP_EXCHANGE.approving && (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <View style={{ flex: 1 }}>
            <MyText className='text-medium'>{I18n.t('v2.sendToken.checkExplorerHint')}</MyText>
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleOpenExplorerUserAddress(userAddress, chainId)}>
              <MyText className='text-brand'>{I18n.t('Initial.checkingExplorer')}</MyText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === STEP_EXCHANGE.success && (
        <StatusMessage
          variant='success'
          title={I18n.t('Initial.success')}
          titleConfig={{ className: 'text-green', variant: 'subTitle' }}
          style={styles.statusResult}
          message={amountOutAfterSwap ? I18n.t('v2.exchange.receivedAmountOut', {
            amount: BigNumber(amountOutAfterSwap).decimalPlaces(6).toFormat(),
            symbol: tokenOut?.symbol
          }) : ''}
        />
      )}

      {(step === STEP_EXCHANGE.failed || step === STEP_EXCHANGE.approveFailed) && (
        <>
          <View style={styles.stepRow}>
            <View style={styles.stepLineCol}>
              <View style={styles.stepLine} />
            </View>
            <View style={{ flex: 1, height: getSizeImgSquare('large') }} />

          </View>
          <StatusMessage
            variant='error'
            title={I18n.t('v2.common.fail')}
            titleConfig={{ className: 'text-red', variant: 'subTitle' }}
            message={errorStep || I18n.t('GlobalError.somethingWrongErr')}
            style={styles.statusResult}
          />
        </>
      )}
    </View>
  )

  return (
    <MyViewPage style={styles.container}>
      {renderEnter()}
    </MyViewPage>
  )
}

export default SwapAndSendSubmit
