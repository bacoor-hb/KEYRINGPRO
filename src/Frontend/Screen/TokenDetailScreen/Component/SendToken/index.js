import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Keyboard, Platform } from 'react-native'
// ScrollView from react-native-gesture-handler: it scrolls inside the gorhom sheet on
// Android (a plain RN ScrollView doesn't) AND, unlike gorhom's BottomSheetScrollView, its
// ref is a normal RN ScrollView with working scrollTo/scrollToEnd (needed for the keyboard
// auto-scroll below).
import { ScrollView } from 'react-native-gesture-handler'
import { useSelector } from 'react-redux'
import { useQuery } from 'react-query'
import BigNumber from 'bignumber.js'
import Clipboard from '@react-native-clipboard/clipboard'

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
import GasSlider from 'frontend/Screen/WalletConnect/Component/GasSlider'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import AddressBookAvatar from 'frontend/Components/Common/AddressBook/Avatar'
import AddressBookManager from '../AddressBookManager'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import useAddressBook from 'frontend/Hooks/useAddressBook'
import useGetTokensLatestTransactions from 'frontend/Hooks/useGetTokensLatestTransactions'
import useCheckMaliciousAddress from 'frontend/Hooks/useCheckMaliciousAddress'
import { zeroAddress } from 'viem'

import images from 'assets/Image'
import I18n from 'assets/Lang'
import { Colors, getFontFamily, fontSize, pixelByHeight } from 'common/styles'
import {
  convertWeiToBalance,
  formatInputNumberDecimal,
  formatNumberBro,
  inpreciseRound,
  isObject,
  isValidContract,
  lowerCase
} from 'common/function'
import ReduxService from 'common/redux'
import { KeyboardController, AndroidSoftInputModes } from 'react-native-keyboard-controller'
import BaseAPI from 'controller/API/BaseAPI'
import queryClient from 'common/queryClient'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { removeDecimalsFromNumber } from 'common/web3'
import { getNativeTokenSymbolByChain, getUrlExplorerHash, handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import { isNativeToken } from 'common/tokens'
import { chainType } from 'common/constants/chain'
import { CURRENCY_DATA } from 'common/constants/app'
import AllChainServices from 'controller/AllChainServices'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { NavigationActions } from 'src/navigation/NavigationService'
import InputCustom from 'frontend/Components/UI/InputCustom'
import AutoFitAmountInput from '../Exchange/Components/AutoFitAmountInput'
import ViemWeb3 from 'src/Web3/ViemWeb3'

// Single drawer for the whole send flow: enter form -> submit/result steps.
export const STEP_SEND = {
  sending: 1, // broadcasting the tx
  sent: 2, // got the hash, waiting for confirmation
  success: 3,
  failed: 4
}

// EVM chains whose fee is dominated by an L1 data component; use a finer slider.
const LAYER_2_CHAIN_IDS = [10, 8453, 42161, 59144, 130]

// Fiat amount input limit: the integer part is unrestricted; only the fraction
// part is capped at 6 digits.
const USD_MAX_FRACTION_DIGITS = 6

// Clamp a raw fiat-amount string: normalize ',' -> '.', keep only the FIRST dot,
// and trim the fraction to 6 digits. The integer part is left as-is (no length
// limit). A just-typed trailing dot is preserved ("12." stays editable). Returns
// a string.
const sanitizeUsdAmount = (raw) => {
  const s = String(raw == null ? '' : raw).replace(/,/g, '.')
  const firstDot = s.indexOf('.')
  if (firstDot === -1) {
    return s
  }
  const intPart = s.slice(0, firstDot)
  const fractionPart = s.slice(firstDot + 1).replace(/\./g, '').slice(0, USD_MAX_FRACTION_DIGITS)
  return `${intPart}.${fractionPart}`
}

// Fetch the USD -> `currency` fiat rate through react-query so repeat picks of the
// same currency come from cache instead of hitting the API again. Fresh for 5 min
// (staleTime); cached for the client's default (1 day). Returns a number (0 on error).
const fetchFiatRate = (currency) => queryClient.fetchQuery(
  ['fiatRate', currency],
  () => BaseAPI.convertUSD2NewCurrency(currency === 'RMB' ? 'CNY' : currency),
  { staleTime: 1000 * 60 * 5 }
)

// Extract a plain address from a raw QR payload (handles EIP-681 `ethereum:` URIs).
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

// Dark-mode-only: styles don't depend on the instance, so build once at module
// scope. The presentational components below are ALSO module-scope on purpose —
// defining them inside SendToken would give them a new identity every render and
// remount their subtree, making the TextInputs lose focus on each keystroke.
const styles = createStyles()

// Fixed 40px round button (scan / coins / Max). flexShrink:0 keeps it circular
// even when the row is tight.
const CircleButton = ({ onPress, icon, label }) => (
  <TouchableOpacity activeOpacity={0.8} disabled={!onPress} style={styles.iconBtn} onPress={onPress}>
    {label
      ? <MyText variant='small' className='text-brand'>{label}</MyText>
      : <MyIcon variant='small' uri={icon} resizeMode='contain' />}
  </TouchableOpacity>
)

// Amount field row: [left token icon] + underlined section ([input] + [right
// button]). The underline runs through the input and right button but excludes
// the left icon (which sits outside the bordered section). Address fields use
// MyInput instead.
const Field = ({ leftIcon, rightButton, children, style }) => (
  <View style={[styles.fieldRow, style]}>
    {leftIcon ? <View style={styles.fieldSide}>{leftIcon}</View> : null}
    <View style={styles.fieldLine}>
      <View style={styles.fieldInputPlain}>{children}</View>
      {rightButton ? <View style={styles.fieldSide}>{rightButton}</View> : null}
    </View>
  </View>
)

// Inline hint (icon + colored text) used for errors / recipient status.
const HintRow = ({ icon, className, color, text }) => (
  <View style={styles.hintRow}>
    {icon ? <MyIcon uri={icon} style={styles.hintIcon} resizeMode='contain' /> : null}
    <MyText variant='small' className={className} style={color ? { color } : undefined}>{text}</MyText>
  </View>
)

// Recipient-status row in the reserved area below the address field: an 18px icon
// (or loading dots) + a 13px message, with an optional footer (e.g. GoPlus credit).
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

// Fiat icon: a bordered circle showing the selected currency's symbol (e.g. $, €,
// ¥). The symbol follows the selected regional currency (`currencyCode`); falls
// back to USD.
const UsdIcon = ({ currencyCode }) => {
  const symbol = (CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD).symbol
  return (
    <View style={styles.usdIconWrap}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={styles.usdSymbol}
      >{symbol}</Text>
      <View style={styles.usdBadgeWrap}>
        <ImageRender uri={images[currencyCode] || images.USD} style={styles.usdBadge} resizeMode='cover' />
      </View>
    </View>
  )
}

const SendToken = ({ _this }) => {
  const { state, handleSubmitSend, handleChangeCurrency } = _this
  const token = state?.exchange?.tokenIn || {}

  const { activeAccount, fiatRateRedux, currencyRedux, accountListRedux, addressBookHistory } = useSelector((s) => s)
  const userAddress = activeAccount?.account?.address

  // Locale drives the input font (getFontFamily): Geist vs the taller LINE_SEED
  // faces. We can't hardcode the two-line address box height because each font
  // renders a line at a different pixel height — so we MEASURE one line of the
  // current font and size every input box to fit two of them + padding. Re-measures
  // when the locale (hence font) changes. Until measured, the styles fallback height
  // is used (first paint only).
  const locale = useSelector((s) => s.localeRedux)
  // Measured height of a real TWO-LINE block in the current font (via onLayout on a
  // "x\nx" Text) — NOT one line × 2, which under-measures because it misses the
  // inter-line leading and clipped the 2nd line on paste.
  const [addrTwoLineHeight, setAddrTwoLineHeight] = useState(0)
  // Two-line block + top/bottom padding, plus a 2px slack so the TextInput's own line
  // box (a hair taller than the <Text> measurer's) still fits both lines. Floored at
  // FIELD_MIN_HEIGHT so a small measured height still matches the 74px design.
  const fieldHeight = addrTwoLineHeight > 0
    ? Math.max(FIELD_MIN_HEIGHT, Math.ceil(addrTwoLineHeight) + FIELD_VPAD * 2 + 2)
    : null

  // Regional currency is kept LOCAL to this Send modal: it only changes the fiat
  // conversion/symbol shown here, never the app-wide setting. Seeded from redux on
  // mount, so reopening the modal resets back to the app's currency (no persistence).
  const [localCurrency, setLocalCurrency] = useState(currencyRedux)
  const [localFiatRate, setLocalFiatRate] = useState(fiatRateRedux)

  const chainId = token?.chainId
  const isNative = token?.isNative || isNativeToken(token?.contractAddress)
  const tokenAddress = isNative ? null : token?.contractAddress
  const decimals = Number(token?.decimals ?? 18)
  const symbol = token?.symbol || ''
  const nativeSymbol = isNative ? symbol : getNativeTokenSymbolByChain(chainId)
  // Live price for the token being sent — fetched fresh on every open (no query
  // cache) so the USD amount field uses the current price, not the cached
  // token-list snapshot. Native → look up by zeroAddress.
  const { data: livePriceData } = useGetTokenPrice(
    chainId,
    isNative ? zeroAddress : tokenAddress,
    { cacheTime: 0, staleTime: 0 }
  )
  const livePriceUSD = Number(livePriceData)
  const priceUSD = livePriceUSD > 0 ? livePriceUSD : Number(token?.priceUSD || 0)
  const rateValue = priceUSD ? priceUSD * localFiatRate : 0
  const isLayer2 = LAYER_2_CHAIN_IDS.includes(Number(chainId))

  // Native token price → used to show the transaction fee in fiat.
  const { data: nativePriceData } = useGetTokenPrice(chainId, zeroAddress)
  const nativePriceUSD = isNative ? priceUSD : Number(nativePriceData || 0)

  // Selected regional currency → drives the fee symbol's prefix/suffix placement.
  const currencyInfo = CURRENCY_DATA[localCurrency] || CURRENCY_DATA.USD
  const feePrefix = currencyInfo.position === 'prefix' ? currencyInfo.symbol : undefined
  const feeSuffix = currencyInfo.position === 'suffix' ? ` ${currencyInfo.symbol}` : undefined

  // Android: while this drawer is mounted, tell the window to leave itself alone when the
  // keyboard opens (ADJUST_NOTHING) — the sheet stays perfectly put and OUR content scroll
  // below is the only thing that moves the focused input into view. setDefaultMode() hands
  // the window back to the app default (adjustPan) on unmount. Uses react-native-keyboard-
  // controller (same pattern as AISearch); its restore is reliable, and even if the mode
  // briefly outlived the drawer, ADJUST_NOTHING never pushes another screen's UI (unlike
  // adjustResize) — which is exactly what broke the UnlockScreen before. No-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING)
    return () => KeyboardController.setDefaultMode()
  }, [])

  const scrollRef = useRef(null)
  // Live scroll offset, tracked via onScroll — the keyboard effect scrolls by a delta.
  const scrollOffsetRef = useRef(0)
  // Scroll the gesture-handler ScrollView to an absolute y (normal RN ScrollView ref).
  const scrollToY = (y) => scrollRef.current?.scrollTo?.({ y, animated: true })
  // Keyboard handling: nothing auto-scrolls the focused input above the keyboard inside the
  // sheet, so we do it — reserve paddingBottom = keyboard height for room, then scroll the
  // focused input up ONLY when it is actually covered. The sheet itself never moves
  // (keyboardBehavior 'extend' + Android ADJUST_NOTHING); only the content scrolls.
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
      focused.measureInWindow((x, y, w, h) => {
        // Generous margin: measureInWindow (window coords) can sit below endCoordinates
        // .screenY (screen coords) by the status-bar height, so a small margin could
        // under-scroll and leave the input at the keyboard edge.
        const overlap = (y + h + pixelByHeight(40)) - keyboardTop
        if (overlap <= 0) return // input already above the keyboard (e.g. address fields)
        // Defer so the reserved padding (setKbPad above) has grown the content first —
        // both platforms need the room before scrollTo, otherwise it clamps at the old
        // (shorter) max offset. iOS overlays the keyboard (no resize), so the padding is
        // its only source of scroll room.
        setTimeout(() => {
          scrollToY(scrollOffsetRef.current + overlap)
        }, 50)
      })
    })
    const hideSub = Keyboard.addListener(hideEvt, () => setKbPad(0))
    return () => { showSub.remove(); hideSub.remove() }
  }, [])

  // Form state
  const [txtAddress, setTxtAddress] = useState('')
  const [isAddressErr, setIsAddressErr] = useState(false)
  const [txtAddressBookAlias, setTxtAddressBookAlias] = useState('')
  const [addressBookInfo, setAddressBookInfo] = useState(null)
  const [isAddressBookNotFound, setIsAddressBookNotFound] = useState(false)
  const [txtAmount, setTxtAmount] = useState('')
  const [txtAmountUSD, setTxtAmountUSD] = useState('')
  // While a new regional currency's fiat rate is being fetched, the fiat amount
  // field shows a loader instead of the STALE value; it flips off once the new
  // rate lands and the recompute effect has refreshed the number.
  const [isConvertingFiat, setIsConvertingFiat] = useState(false)
  const [isBalanceErr, setIsBalanceErr] = useState(false)
  const [isFeeError, setIsFeeError] = useState(false)
  const [missingFee, setMissingFee] = useState('0')

  // Fee / gas state
  const [sliderValue, setSliderValue] = useState([1])
  // Mirror of the current slider multiplier for loadFee's setInterval, whose closure
  // would otherwise capture the initial [1] and re-validate the fee at ×1 every 30s —
  // wiping a fee error that the slider position legitimately triggered.
  const sliderMultiplierRef = useRef(1)
  const [sliderW, setSliderW] = useState(0)
  const [gasPrice, setGasPrice] = useState(0)
  const [gasPriceL1, setGasPriceL1] = useState(0)
  const [gasLimit, setGasLimit] = useState(0)
  const [nativeBalance, setNativeBalance] = useState(0)
  const [spendable, setSpendable] = useState(0)
  const [isLoadInit, setIsLoadInit] = useState(true)

  // Submit / result state
  const [tableView, setTableView] = useState('enter')
  const [step, setStep] = useState(null)
  const [hash, setHash] = useState('')
  const [error, setError] = useState('')

  // Address book + recipient safety checks
  const { resolveByAddressAsync, resolveByAliasAsync } = useAddressBook()

  // Is the recipient one of the wallet's own accounts? Local-only check (no network),
  // so it resolves instantly. Defined before the on-chain queries below so it can gate
  // them: sending to your own account needs no contract/history/malicious lookup, which
  // is what made the "address in this wallet" status wait behind the slow history load.
  const isOwnAccount = useMemo(
    () => !!txtAddress && (accountListRedux || []).some((a) => a?.address?.toLowerCase() === txtAddress.toLowerCase()),
    [accountListRedux, txtAddress]
  )

  // Is the recipient a contract? (extra on-chain getCode call, cached per address+chain).
  const { data: isContractAddr, isLoading: isLoadingContract } = useQuery(
    ['isRecipientContract', txtAddress, chainId],
    () => isValidContract(chainId, txtAddress),
    { enabled: !isOwnAccount && !!txtAddress && txtAddress.startsWith('0x') && txtAddress.length === 42 && !!chainId }
  )

  // "Sent before" history status. Moralis is keyed by numeric chainId (NOT chainType),
  // so we must pass chainId here. isContractAddr suppresses the history status for contracts.
  const { statusAddressTo, typeStatusAddressTo, isLoading: isLoadingHistory } = useGetTokensLatestTransactions(
    userAddress, txtAddress, isAddressErr, I18n.t('Content.invalidAddr'), chainId, isContractAddr
  )
  // Skip the GoPlus malicious lookup for our own accounts (empty address disables the query).
  const { data: isMaliciousAddress, isLoading: isLoadingMalicious } = useCheckMaliciousAddress(isOwnAccount ? '' : txtAddress, chainId)

  // Recipient checks still resolving (only meaningful once the address is valid, and never
  // for our own accounts — those are settled locally and shown immediately).
  const isCheckingRecipient = !!txtAddress && !isAddressErr && !isOwnAccount && (isLoadingHistory || isLoadingContract || isLoadingMalicious)

  // -> Fee helpers ------------------------------------------------------------
  // Transaction fee (in native token), including the L1 data fee where present.
  const calcFee = (multiplier = sliderValue[0], gasLimitInit = gasLimit) => {
    // toFixed(0): a fractional slider multiplier (e.g. 2.9000000000000004) makes the
    // wei product non-integer, which ethers.formatUnits rejects (→ fee silently 0).
    // Round to integer wei so the fee is correct at every slider position.
    let fee = convertWeiToBalance(BigNumber(gasPrice).multipliedBy(multiplier).multipliedBy(gasLimitInit).toFixed(0))
    fee = Number(fee) + Number(gasPriceL1 || 0)
    return new BigNumber(fee * 1.1).toString()
  }

  // Spendable balance for the current slider position.
  const getAvailable = (multiplier = sliderValue[0]) => {
    if (!isNative) return new BigNumber(spendable)
    const avail = new BigNumber(nativeBalance).minus(calcFee(multiplier))
    return avail.isLessThan(0) ? new BigNumber(0) : avail
  }
  // <- Fee helpers ------------------------------------------------------------

  const estimateGasLimit = async () => {
    try {
      let rawTx
      if (isNative) {
        rawTx = { to: userAddress, from: userAddress, data: '0x' }
      } else {
        const data = await AllChainServices.generateDataTx(chainId, tokenAddress, userAddress)
        rawTx = { to: tokenAddress, from: userAddress, data }
      }
      return await AllChainServices.estimateGasTxs(chainId, rawTx)
    } catch (e) {
      return isNative ? 50000 : 300000
    }
  }

  const getGasFeeLayer1 = async () => {
    // Only Optimism exposes a measurable L1 data fee through this helper.
    if (Number(chainId) !== 10) return 0
    try {
      const feeWei = await AllChainServices.estimateL1DataFee(isNative, chainType.optimism, userAddress, tokenAddress)
      return convertWeiToBalance(feeWei, 18)
    } catch (e) {
      return 0
    }
  }

  const loadFee = async () => {
    const limit = await estimateGasLimit()
    const price = await AllChainServices.getGasPrice(chainId)
    const feeL1 = await getGasFeeLayer1()
    const nativeBal = await AllChainServices.getBalanceByChain(chainId, userAddress)

    // Validate against the CURRENT slider position (not a fixed ×1), so the periodic
    // refresh stays consistent with validateGas and doesn't wipe a fee error that the
    // raised gas legitimately triggered.
    const multiplier = sliderMultiplierRef.current
    const txFee = (() => {
      // toFixed(0): integer wei — a fractional multiplier otherwise makes formatUnits
      // reject the value and the fee collapses to 0 (see calcFee).
      let fee = convertWeiToBalance(BigNumber(price).multipliedBy(multiplier).multipliedBy(limit).toFixed(0))
      fee = Number(fee) + Number(feeL1 || 0)
      return new BigNumber(fee * 1.1).toString()
    })()

    let spendableBal = 0
    let feeErr = false
    if (isNative) {
      spendableBal = Number(nativeBal) - Number(txFee)
      if (spendableBal < 0) {
        feeErr = true
        spendableBal = 0
      }
    } else {
      spendableBal = await AllChainServices.getTokenBalanceByChain(chainId, tokenAddress, userAddress, decimals)
      feeErr = Number(nativeBal) - Number(txFee) < 0
    }

    setGasLimit(limit)
    setGasPrice(price)
    setGasPriceL1(feeL1)
    setNativeBalance(inpreciseRound(nativeBal, 8))
    setSpendable(spendableBal)
    setIsFeeError(feeErr)
    setMissingFee(feeErr ? formatNumberBro(Number(txFee) - Number(nativeBal), 8) : '0')
    setIsLoadInit(false)
  }

  useEffect(() => {
    loadFee()
    const timer = setInterval(loadFee, 30000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Scroll to the bottom (submit timeline) — large y clamps to content end.
    if (step) scrollToY(999999)
  }, [step])

  // When the local currency changes (or the live token price lands a tick after
  // mount), the fiat rate updates asynchronously, so depend on the rate itself:
  // recompute the fiat amount from the entered token amount once the new rate
  // arrives, keeping the inputs in sync.
  useEffect(() => {
    if (txtAmount && rateValue) {
      // Same BigNumber conversion as onChangeAmount (token × rate, down to 6
      // decimals). Runs whenever the rate changes — both when a new currency's
      // rate lands (clearing the loader in handleLocalCurrencyChange) and when the
      // live token price arrives a tick after mount — keeping the fiat field synced.
      setTxtAmountUSD(BigNumber(txtAmount).multipliedBy(rateValue).decimalPlaces(USD_MAX_FRACTION_DIGITS, BigNumber.ROUND_DOWN).toFixed())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localFiatRate, rateValue])

  // -> Address ----------------------------------------------------------------
  const isValidAddress = (address) => {
    try {
      return address.startsWith('0x') && address.length === 42 && !!address.match(/^[0-9a-zA-Z]+$/)
    } catch (e) {
      return false
    }
  }

  const onInputAddress = async (newAddress, isFromScan = false) => {
    const address = isFromScan ? getAddressFromQR(newAddress) : newAddress
    setTxtAddress(address)
    setTxtAddressBookAlias('')
    setAddressBookInfo(null)
    setIsAddressBookNotFound(false)
    const valid = address.length > 0 && isValidAddress(address)
    setIsAddressErr(address.length > 0 && !valid)
    // If this address is registered in the address book, surface its alias.
    if (valid) {
      const info = await resolveByAddressAsync(address)
      if (info?.info) {
        setAddressBookInfo(info)
        setTxtAddressBookAlias(info.info.nickname || info.info.email || '')
      }
    }
  }

  const onInputAddressBookAlias = (text) => {
    setTxtAddressBookAlias(text)
    setTxtAddress('')
    setAddressBookInfo(null)
    setIsAddressBookNotFound(false)
    setIsAddressErr(false)
  }

  // Resolve an address-book alias (nickname/email) to its address on submit/blur.
  const handleResolveAddressBookByAlias = async () => {
    if (!txtAddressBookAlias) return
    const info = await resolveByAliasAsync(txtAddressBookAlias)
    if (info?.info?.address && isValidAddress(info.info.address)) {
      setAddressBookInfo(info)
      setIsAddressBookNotFound(false)
      setTxtAddress(info.info.address)
      setIsAddressErr(false)
    } else {
      setAddressBookInfo(null)
      setIsAddressBookNotFound(true)
      setTxtAddress('')
      setIsAddressErr(false)
    }
  }
  // Fill the form from a saved address-book entry. The entry was already resolved
  // when saved, so set its address/alias/info directly (no re-resolve needed) — this
  // also surfaces its freeText note in the status area below the fields.
  const onSelectEntry = (entry) => {
    setTxtAddressBookAlias(entry?.info?.nickname || entry?.info?.email || '')
    setAddressBookInfo(entry)
    setIsAddressBookNotFound(false)
    setIsAddressErr(false)
    const entryAddress = isValidAddress(entry?.info?.address) ? entry.info.address : ''
    setTxtAddress(entryAddress)
  }

  // Open the Address book manager stacked on top of the Send drawer; selecting a row
  // fills the form (via the handlers above) and lowers the manager back to the form.
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
  // <- Address ----------------------------------------------------------------

  // -> Amount -----------------------------------------------------------------
  const syncBalanceErr = (amount) => {
    setIsBalanceErr(BigNumber(amount || 0).isGreaterThan(getAvailable()))
  }

  const onChangeAmount = (value) => {
    // Some keyboards / locales emit a comma as the decimal separator; the app
    // only supports '.', so normalize before parsing (matches onChangeUSDAmount).
    const formatted = formatInputNumberDecimal(value.replace(/,/g, '.'), decimals)
    setTxtAmount(formatted)
    // Guard: a partial value like "." isn't a number (BigNumber -> NaN) — clear the
    // fiat field rather than write "NaN".
    const amount = BigNumber(formatted)
    if (amount.isNaN()) {
      setTxtAmountUSD('')
      setIsBalanceErr(false)
      return
    }
    // No price (e.g. testnet / unpriced custom chain): show 0 in the fiat field
    // instead of leaving it blank. Convert with BigNumber (not JS float math) so
    // token × rate doesn't accrue floating-point error; round DOWN to 6 decimals
    // to match the fiat field's fraction limit and onGetMax.
    setTxtAmountUSD(rateValue
      ? amount.multipliedBy(rateValue).decimalPlaces(USD_MAX_FRACTION_DIGITS, BigNumber.ROUND_DOWN).toFixed()
      : '0')
    syncBalanceErr(formatted)
  }

  const onChangeUSDAmount = (value) => {
    // Fraction part capped at 6 digits (integer part unrestricted).
    const sanitized = sanitizeUsdAmount(value)
    setTxtAmountUSD(sanitized)
    // Guard: a partial value like "." or "" isn't a number (BigNumber -> NaN), and
    // no rate means no conversion — clear the token field rather than write "NaN".
    const usd = BigNumber(sanitized)
    if (usd.isNaN() || !rateValue) {
      setTxtAmount('')
      setIsBalanceErr(false)
      return
    }
    // Convert fiat -> token with BigNumber (not JS float division) so the result
    // doesn't accrue floating-point error; round DOWN to the token's decimals.
    const amount = usd.dividedBy(rateValue).decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
    setTxtAmount(amount)
    syncBalanceErr(amount)
  }

  const onGetMax = () => {
    // Round to the TOKEN's own decimals
    const max = getAvailable().decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFixed()
    setTxtAmount(max)
    setTxtAmountUSD(rateValue ? BigNumber(max).multipliedBy(rateValue).decimalPlaces(USD_MAX_FRACTION_DIGITS, BigNumber.ROUND_DOWN).toFixed() : '0')
    setIsBalanceErr(false)
  }

  // GasSlider drives the thumb on the UI thread (reanimated); it reports the
  // stepped multiplier live while dragging (onChanging) and the final value on
  // release (onGasChange). It also yields to the sheet's vertical pan so the modal
  // doesn't shift while dragging.
  // Recompute the balance/fee validation for a slider position. Kept OUT of the live
  // drag path on purpose: the stepped value jitters across the error threshold while
  // dragging, which would flip the error rows on/off (and swap between the two
  // messages) ~16x/sec and look like flicker. So validation is settled on release.
  const validateGas = (value) => {
    if (txtAmount) setIsBalanceErr(BigNumber(txtAmount).isGreaterThan(getAvailable(value)))
    const fee = calcFee(value)
    const feeErr = BigNumber(nativeBalance).minus(fee).isLessThan(0)
    setIsFeeError(feeErr)
    setMissingFee(feeErr ? formatNumberBro(Number(fee) - Number(nativeBalance), 8) : '0')
  }
  // Release: commit the final value AND its validation.
  const onGasChange = (value) => {
    sliderMultiplierRef.current = value
    setSliderValue([value])
    validateGas(value)
  }

  // Live updates as the thumb moves, throttled (~60ms): only drives the gwei/fee
  // DISPLAY (via sliderValue) so it follows the drag smoothly. Error validation is
  // intentionally NOT run here — onGasChange settles it on release. The exact final
  // value is always committed by onGasChange on release.
  const lastGasUpdateRef = useRef(0)
  const onGasChanging = (value) => {
    const now = Date.now()
    if (now - lastGasUpdateRef.current < 60) return
    lastGasUpdateRef.current = now
    sliderMultiplierRef.current = value
    setSliderValue([value])
  }
  // <- Amount -----------------------------------------------------------------

  // -> Currency (local-only) --------------------------------------------------
  // Open the regional-currency picker for THIS modal only: it reports the choice
  // back via onSelect instead of dispatching to redux, so the app-wide setting is
  // untouched. The fiat rate is fetched here (USD → 1) and applied locally.
  const openCurrencyPicker = () => {
    Keyboard.dismiss()
    handleChangeCurrency({ selectedCode: localCurrency, onSelect: handleLocalCurrencyChange })
  }

  const handleLocalCurrencyChange = async (newCode) => {
    // Same currency picked again — nothing to refetch or reconvert.
    if (newCode === localCurrency) return
    setLocalCurrency(newCode)
    // Show a loader in the fiat field (only when there's an amount to reconvert)
    // while the new rate is being fetched; the recompute effect refreshes the
    // number once localFiatRate lands. finally guarantees the loader clears even
    // if the API fails, so it can never get stuck.
    const shouldLoad = !!txtAmount && newCode !== 'USD'
    if (shouldLoad) setIsConvertingFiat(true)
    try {
      let rate = 1
      if (newCode !== 'USD') {
        rate = await fetchFiatRate(newCode)
      }
      if (rate > 0) setLocalFiatRate(rate)
    } finally {
      setIsConvertingFiat(false)
    }
  }
  // <- Currency ---------------------------------------------------------------

  const gweiDisplay = useMemo(() => {
    if (isLoadInit) return '...'
    const gwei = convertWeiToBalance(removeDecimalsFromNumber(gasPrice * sliderValue[0]), 9)
    return inpreciseRound(gwei, gwei >= 1 ? 2 : 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadInit, gasPrice, sliderValue])

  // Transaction fee converted to the user's fiat currency (footer "Transaction fee").
  const feeFiat = useMemo(() => {
    return BigNumber(calcFee()).multipliedBy(nativePriceUSD).multipliedBy(localFiatRate).toNumber()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gasPrice, gasPriceL1, gasLimit, sliderValue, nativePriceUSD, localFiatRate])

  const canSend = (
    !isLoadInit &&
    !!txtAddress &&
    !isAddressErr &&
    !!txtAmount &&
    Number(txtAmount) > 0 &&
    !isBalanceErr &&
    !isFeeError &&
    !!Number(spendable)
  )

  // Persist the resolved address-book recipient into history so it shows up in the
  // Address book manager next time. Upsert by alias (skip the pinned donate entry).
  const saveAddressBookHistory = () => {
    if (!isObject(addressBookInfo?.info, true)) return
    const alias = lowerCase(addressBookInfo.info.nickname || addressBookInfo.info.email || '')
    if (!alias || alias === 'donate_keyringpro') return

    const list = addressBookHistory || []
    const idx = list.findIndex((h) => lowerCase(h?.info?.nickname || h?.info?.email || '') === alias)
    const next = idx === -1
      ? [...list, addressBookInfo]
      : list.map((h, i) => (i === idx ? addressBookInfo : h))
    ReduxService.callDispatchAction(StorageReduxAction.setAddressBookHistory(next))
  }

  // -> Submit -----------------------------------------------------------------
  const callbackStep = (nextStep, data) => {
    setStep(nextStep)
    if (nextStep === STEP_SEND.sent) setHash(data)
    // Broadcast went out (got a hash) → remember the address-book recipient.
    if (nextStep === STEP_SEND.sent || nextStep === STEP_SEND.success) saveAddressBookHistory()
    if (nextStep === STEP_SEND.success) {
      // Refresh the V2 token list — drives BOTH this token-detail screen's live
      // balance and HomeScreen's totals (both read accountTokenListRedux reactively).
      setTimeout(() => refreshAccountTokens(userAddress, { chainIds: [chainId], tokenAddress: token?.contractAddress }), 1500)
    }
    if (data?.error) setError(typeof data.error === 'string' ? data.error : I18n.t('GlobalError.somethingWrongErr'))
  }

  const onSend = () => {
    Keyboard.dismiss()
    setTableView('submit')
    handleSubmitSend(
      {
        toAddress: txtAddress,
        amount: txtAmount,
        gasPrice,
        contractAddress: isNative ? null : tokenAddress,
        tokenDecimal: decimals,
        percentGas: sliderValue[0] * 100,
        rpcUrl: ViemWeb3.getListRpc(chainId)
      },
      callbackStep
    )
  }

  const onCopyHash = () => {
    if (!hash) return
    Clipboard.setString(getUrlExplorerHash(hash, chainId) || hash)
    _this.showAlert?.(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), '', { type: 'toast' })
  }
  // <- Submit -----------------------------------------------------------------

  // Recipient status shown in the reserved area below the address-book input.
  // Priority: invalid → own account → loading → suspicious → contract → sent before → first time.
  // Own-account is a local check (no network), so it's shown immediately instead of
  // waiting behind the loading state for the on-chain checks to resolve.
  const renderAddressStatus = () => {
    if (isAddressErr) {
      return <StatusRow className='text-red' text={I18n.t('Content.invalidAddr')} />
    }
    if (!txtAddress) return null
    if (isOwnAccount) {
      return <StatusRow icon={images.UIV2.icons.informationWhite} className='text-white' text={I18n.t('v2.sendToken.inThisWallet')} />
    }
    if (isCheckingRecipient) {
      return <StatusRow loading className='text-medium' text={I18n.t('v2.sendToken.checkingHistory')} />
    }
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
    if (isContractAddr) {
      return <StatusRow icon={images.UIV2.icons.contract} className='text-white' text={I18n.t('Content.thisisthesmartcontractaddress')} />
    }
    if (statusAddressTo === typeStatusAddressTo.availableMoreThanOne || statusAddressTo === typeStatusAddressTo.available) {
      return <StatusRow icon={images.UIV2.icons.success} className='text-green' text={I18n.t('v2.sendToken.hasTransferRecord')} />
    }
    if (statusAddressTo === typeStatusAddressTo.warning) {
      return <StatusRow icon={images.UIV2.icons.informationWhite} className='text-white' text={I18n.t('v2.sendToken.firstTransfer')} />
    }
    return null
  }

  const isSubmitting = tableView === 'submit'

  const renderEnter = () => (
    <>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('Initial.send')}
        leftIcon={images.UIV2.icons.home.send}
        rightElement={(
          (txtAddress || txtAmount) ? (
            <MyButton
              label={I18n.t('Initial.send')}
              variant='primary'
              size='small'
              isDisable={isSubmitting || !canSend}
              onPress={onSend}
            />
          ) : null
        )}
      />
      <View
        style={{
          paddingTop: pixelByHeight(8)
        }}
      >
        {/* gesture-handler ScrollView: scrolls inside the gorhom sheet on Android and has
          a normal ref (scrollTo) for the keyboard auto-scroll. The sheet stays anchored
          (keyboardBehavior 'extend' + Android ADJUST_NOTHING); the keyboard effect above
          scrolls the focused input above the keyboard. */}
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
          onScroll={(e) => { scrollOffsetRef.current = e.nativeEvent?.contentOffset?.y ?? 0 }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.content, kbPad ? { paddingBottom: kbPad } : null]}
        >
          {/* While sending, the whole form dims + stops responding; the submit
            timeline below the gas slider stays bright. */}
          <View style={isSubmitting ? styles.dimmedForm : null} pointerEvents={isSubmitting ? 'none' : 'auto'}>
            {/* Off-screen TWO-LINE measurer in the CURRENT locale font: its real block
              height + padding becomes every input box's height, so two wrapped address
              lines fit exactly without clipping regardless of the locale font (Geist
              vs the taller LINE_SEED faces). Measured as an actual 2-line block (not
              one line × 2) so inter-line leading is included. Re-runs on locale change. */}
            <Text
              key={locale}
              style={{ position: 'absolute', left: 0, top: 0, opacity: 0, padding: 0, fontFamily: getFontFamily(), fontSize: 16 }}
              onLayout={(e) => {
                const h = e.nativeEvent?.layout?.height || 0
                if (h && Math.abs(h - addrTwoLineHeight) > 0.5) setAddrTwoLineHeight(h)
              }}
            >
              {'0\n0'}
            </Text>
            {/* Destination address. When an address-book alias can't be resolved, the
              receive-address field shows a red "No registration" placeholder. */}
            <MyText variant='subTitle' className='text-medium' fontWeight={700}>{I18n.t('v2.sendToken.destinationAddress')}</MyText>
            <InputCustom
              noErrorSpace
              typeInput='area'
              containerConfig={{ style: styles.inputTopGap }}
              inputWrapperConfig={{ style: [styles.addressAreaWrapper, fieldHeight && { height: fieldHeight }] }}
              inputConfig={{ style: [styles.addressAreaInput, { fontSize: fontSize(18, false, true) }] }}
              value={txtAddress}
              onChangeText={(text) => onInputAddress(text)}
              placeholder={isAddressBookNotFound ? I18n.t('addressBook.noRegistration') : I18n.t('v2.sendToken.receiveAddress')}
              placeholderTextColor={isAddressBookNotFound ? Colors.RED_TEXT : Colors.TEXT_LOW}
              placeholderConfig={{
                style: { fontSize: fontSize(18, false, true) }
              }}
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

            {/* Address book NFT. The reserved status area below shows EITHER the
            invalid-format error for the receive-address field OR the recipient
            safety/history status (sent before, contract, suspicious, etc.). */}
            <InputCustom
              noErrorSpace
              inputConfig={{ style: { fontSize: fontSize(18, false, true) } }}
              inputWrapperConfig={{ style: [styles.addressInputWrapper, fieldHeight && { minHeight: fieldHeight }] }}
              containerConfig={{ style: [{ gap: 0 }, styles.inputTopGap] }}
              value={txtAddressBookAlias}
              onChangeText={onInputAddressBookAlias}
              onSubmitEditing={handleResolveAddressBookByAlias}
              onBlur={handleResolveAddressBookByAlias}
              returnKeyType='search'
              placeholder={I18n.t('v2.sendToken.searchByAddressBook')}
              placeholderConfig={{
                style: { fontSize: fontSize(18, false, true) }
              }}
              leftIconInside
              leftIcon={addressBookInfo?.info?.avatar
                ? (
                  <AddressBookAvatar
                    base64Data={addressBookInfo?.info?.avatar}
                    customAvatar={addressBookInfo?.info?.customAvatar}
                    style={styles.abAvatar}
                    avatarStyle={styles.abAvatarImg} />
                ) : undefined}
              rightIconOutside
              rightIcon={<CircleButton icon={images.UIV2.icons.addressBook} onPress={openAddressBookManager} />}
            />
            {/* Reserved status area: the resolved address-book note (freeText) shows
            first, then the recipient status, separated by a 14px gap. */}
            <View style={styles.addressStatusSpace}>
              {!!addressBookInfo?.info?.freeText && (
                <MyText variant='small' className='text-medium' style={styles.addressBookFreeText}>
                  {addressBookInfo.info.freeText}
                </MyText>
              )}
              {renderAddressStatus()}
            </View>

            {/* Quantity to send */}
            <MyText
              variant='subTitle'
              className='text-medium'
              fontWeight={700}
              style={addressBookInfo?.info?.freeText ? styles.quantityWithNote : undefined}
            >{I18n.t('v2.sendToken.quantityToSend')}</MyText>
            <Field
              style={fieldHeight && { minHeight: fieldHeight }}
              leftIcon={<TokenIconWithChain tokenIconUri={token?.iconUrl} chainId={chainId} style={styles.tokenIcon} />}
              rightButton={<CircleButton label={I18n.t('v2.common.max')} onPress={onGetMax} />}
            >
              <AutoFitAmountInput
                value={txtAmount}
                onChangeText={onChangeAmount}
                keyboardType='numeric'
                minScale={0}
                placeholder={I18n.t('Initial.amount')}
                placeholderStyle={styles.amountPlaceholder}
                textStyle={styles.amountInput}
              />
            </Field>

            <Field
              style={fieldHeight && { minHeight: fieldHeight }}
              leftIcon={<UsdIcon currencyCode={localCurrency} />}
              rightButton={<CircleButton icon={images.UIV2.icons.changeCurrency} onPress={openCurrencyPicker} />}
            >
              {/* While the new currency's rate is being fetched, the stale amount is
                hidden and a loader shows in its place; it swaps to the new number
                the moment the rate lands. */}
              {isConvertingFiat
                ? (
                  <View style={styles.fiatLoadingWrap}>
                    <MyDotsLoading variant='small' source={images.threeDotsWhiteLoading} />
                  </View>
                )
                : (
                  <AutoFitAmountInput
                    value={txtAmountUSD}
                    onChangeText={onChangeUSDAmount}
                    keyboardType='numeric'
                    minScale={0}
                    placeholder={I18n.t('Initial.amount')}
                    placeholderStyle={styles.amountPlaceholder}
                    textStyle={styles.amountInput}
                  />
                )}
            </Field>

            {/* Amount errors render in a fixed-height reserved area (49px) right below
            the 2nd amount input, so showing/hiding them never shifts the footer.
            Native: amount and fee are the SAME token, so any shortfall (whether the
            amount or the gas drives it) is one consistent "Insufficient balance".
            ERC20: the token balance and the native gas balance are distinct, so keep
            them separate — "need X native for fee" vs "insufficient token balance". */}
            <View style={styles.amountErrorSpace}>
              {isNative
                ? (isBalanceErr || isFeeError) && (
                  <HintRow className='text-red' text={I18n.t('Content.notEnoughBalance')} />
                )
                : (
                  <>
                    {isBalanceErr && !isFeeError && (
                      <HintRow className='text-red' text={I18n.t('Content.notEnoughBalance')} />
                    )}
                    {isFeeError && (
                      <HintRow
                        icon={images.warningOutlineRedIcon}
                        className='text-red'
                        text={I18n.t('Content.feeTokenNeed', { amount: missingFee, item: nativeSymbol })}
                      />
                    )}
                  </>
                )}
            </View>

            {/* Balance + transaction fee */}
            <View style={styles.footer}>
              <View style={styles.footerRow}>
                <MyText className='text-medium'>{I18n.t('v2.sendToken.nativeBalance', { symbol: nativeSymbol })}</MyText>
                <MyNumber className='text-white' value={nativeBalance} fractionDigits={8} suffix={` ${nativeSymbol}`} />
              </View>
              <View style={styles.footerRow}>
                <MyText className='text-medium'>{I18n.t('v2.sendToken.transactionFee')}</MyText>
                {isLoadInit
                  ? <MyText className='text-white'>...</MyText>
                  : <MyNumber className='text-white' value={feeFiat} fractionDigits={8} prefix={feePrefix} suffix={feeSuffix} />}
              </View>
            </View>

            {/* Gas slider — padded so the round thumb isn't clipped at the extremes;
            the inner view is measured so trackWidth excludes that padding. */}
            <View style={styles.sliderRow}>
              <View style={styles.sliderWrap}>
                <View style={styles.sliderMeasure} onLayout={(e) => setSliderW(e.nativeEvent.layout.width)}>
                  <GasSlider
                    value={sliderValue[0]}
                    min={1}
                    max={3}
                    step={isLayer2 ? 0.1 : 0.01}
                    trackWidth={sliderW}
                    onChange={onGasChanging}
                    onChangeEnd={onGasChange}
                  />
                </View>
              </View>
              <View style={styles.gweiBox}>
                {/* Auto-shrink (down to 70%) so a long gwei value stays on one line
                  inside the fixed-width box instead of clipping or reflowing. */}
                <MyText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  className='text-brand'
                >{gweiDisplay} Gwei</MyText>
              </View>
            </View>
          </View>

          {/* Submit timeline — bright, below the gas slider (32px gap). */}
          {isSubmitting && renderSteps()}
        </ScrollView>
      </View>

    </>
  )

  const renderSteps = () => (
    <View style={styles.stepWrap}>
      {/* Sending */}
      <View style={styles.stepRow}>
        <TxStepIcon uri={images.UIV2.icons.icon_send_outline} />
        <View style={{ flex: 1 }}>
          <View style={styles.sendingTitleRow}>
            <MyText fontWeight={700}>{I18n.t('Initial.sending')}</MyText>
            {!hash && step === STEP_SEND.sending && <MyDotsLoading source={images.threeDotsWhiteLoading} />}
          </View>
          <MyText className='text-medium'>
            {I18n.t('v2.sendToken.approxTime')}
          </MyText>
        </View>
      </View>

      {/* Hash */}
      {!!hash && (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => handleOpenExplorerHash(hash, chainId)}
          >
            <MyText className='text-brand'>
              {hash}
            </MyText>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCopyHash} style={styles.copyBtn}>
            <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
          </TouchableOpacity>
        </View>
      )}

      {/* No hash yet → "Checking explorer" fallback (opens explorer at our address). */}
      {!hash && step === STEP_SEND.sending && (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <View style={{ flex: 1 }}>
            <MyText className='text-medium'>
              {I18n.t('v2.sendToken.checkExplorerHint')}
            </MyText>
            <TouchableOpacity activeOpacity={0.8} onPress={() => handleOpenExplorerUserAddress(userAddress, chainId)}>
              <MyText className='text-brand'>{I18n.t('Initial.checkingExplorer')}</MyText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Waiting for confirmation */}
      {!!hash && step === STEP_SEND.sent && (
        <View style={styles.stepRow}>
          <TxStepIcon uri={images.UIV2.icons.icon_waiting_for_confirm_outline} />
          <MyText fontWeight={700}>{I18n.t('Initial.waitingCofirmation')}</MyText>
          <MyDotsLoading source={images.threeDotsWhiteLoading} />
        </View>
      )}

      {/* Connector down to the result when no hash/fallback row carried the line. */}
      {!hash && (step === STEP_SEND.success || step === STEP_SEND.failed) && (
        <View style={styles.stepConnectorCol}>
          <View style={styles.stepLine} />
        </View>
      )}

      {/* Success */}
      {step === STEP_SEND.success && (
        <StatusMessage
          variant='success'
          title={I18n.t('Initial.success')}
          titleConfig={{ className: 'text-green', variant: 'subTitle' }}
          style={styles.statusResult}
        />
      )}

      {/* Fail */}
      {step === STEP_SEND.failed && (
        <StatusMessage
          variant='error'
          title={I18n.t('v2.common.fail')}
          titleConfig={{ className: 'text-red', variant: 'subTitle' }}
          message={error || I18n.t('v2.sendToken.txFailed')}
          style={styles.statusResult}
        />
      )}

    </View>
  )

  return (
    <MyViewPage style={styles.container}>
      {renderEnter()}
    </MyViewPage>
  )
}

export default SendToken
