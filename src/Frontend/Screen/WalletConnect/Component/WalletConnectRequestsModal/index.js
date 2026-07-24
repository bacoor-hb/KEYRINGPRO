import React, { useState, useEffect, useRef } from 'react'
import { View } from 'react-native'
// ScrollView from react-native-gesture-handler so the body scroll cooperates with the
// drawer's pan gesture — plain RN ScrollView won't scroll inside the drawer on Android.
import { ScrollView } from 'react-native-gesture-handler'
import { useSelector } from 'react-redux'
import GasSlider from '../GasSlider'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { getSizeImgSquare, PADDING_TOP_CONTAINER_DRAWER, width } from 'common/styles'
import { formatNumberBro, lowerCase } from 'common/function'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import RequestCard from '../RequestCard'
import SwitchChainCard from '../SwitchChainCard'
import HistoryCard from '../HistoryCard'
import ChainIcon from 'frontend/Components/UI/ChainIcon'
import { WC_VERIFY_STATE } from 'src/Services/WalletConnectAssess'
import styles from './styles'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'

// Signature methods are handled by their own stacked drawer (SignatureRequestCard,
// opened by WalletConnectRequestHost), so they are excluded from the card list here.
const SIGN_METHODS = ['personal_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4']
// Switch/add-chain requests render a dedicated card instead of the generic one.
const SWITCH_CHAIN_METHODS = ['wallet_switchEthereumChain', 'wallet_addEthereumChain']

// URL-row icon from the verdict the connect modal computed and stored on the
// session (urlVerifyState). Fixed once connected — no re-check needed. Mirrors
// WalletConnectConnectModal so the icon matches what was shown at connect time.
const getUrlIcon = (state) => {
  switch (state) {
    case WC_VERIFY_STATE.OFFICIAL:
      return images.UIV2.icons.successBlue
    case WC_VERIFY_STATE.PHISHING_API:
    case WC_VERIFY_STATE.AI_PHISHING:
      return images.UIV2.icons.wcPhishing
    default:
      // ERROR / not assessed → neutral website/globe icon.
      return images.UIV2.icons.browserBlue
  }
}

/**
 * dApp detail / requests sheet (replaces the WalletConnectDetail mock). Hosts the
 * SAME request handling as manageRequestScreenV2 by reusing CallRequestBox — each
 * pending request renders with its own approve/reject/confirm-tx logic. Adds the
 * gas-fee multiplier slider and a per-account disconnect.
 *
 * Props:
 *   topic  — the WC session topic of the tapped dApp
 *   _this  — the WalletConnect screen instance (BaseContainer): provides
 *            nfcProxy / popup / openModal / closeModal / closeDrawer / showAlert
 *            plus onApproveChangeNetwork + onHandleShowInfoReqest (ported).
 */
const WalletConnectRequestsModal = ({ topic, _this }) => {
  const walletConnectRedux = useSelector((s) => s.walletConnectRedux)
  const callRequestRedux = useSelector((s) => s.callRequestRedux)
  const gasPriceSlideValue = useSelector((s) => s.gasPriceSlideValue) || 1

  const [sliderW, setSliderW] = useState(width(40))

  const accountIndex = (walletConnectRedux || []).findIndex(
    (item) => lowerCase(item?.session?.topic) === lowerCase(topic)
  )
  const walletConnectInfo = walletConnectRedux?.[accountIndex] || {}
  const requestInfo = callRequestRedux?.[accountIndex] || []
  // Tx requests only (sign requests show in their own stacked drawer). Newest on top.
  const requestsReversed = requestInfo.filter((item) => !SIGN_METHODS.includes(item?.method)).reverse()
  // Confirmed-transaction history (already stored newest-first in redux).
  const historyReversed = walletConnectInfo?.historyCallRequest || []

  // Chains this dApp is connected to — unique chainIds from chainArray
  // (eip155:chainId:address), falling back to supportedNetwork keys (count > 0).
  const connectedChainIds = (() => {
    const set = new Set()
    ;(walletConnectInfo?.chainArray || []).forEach((c) => {
      const parts = String(c).split(':')
      if (parts[0] === 'eip155' && parts[1]) set.add(parts[1])
    })
    if (set.size === 0) {
      const sn = walletConnectInfo?.supportedNetwork || {}
      Object.keys(sn).forEach((id) => { if (sn[id] > 0) set.add(id) })
    }
    return [...set]
  })()

  // Auto-close when the session for this topic disappears from redux — e.g. the
  // dApp disconnected from the web side. Without this the sheet lingers with
  // empty data (url/chains gone). Only fires after the session was actually seen,
  // so we never close on a transient first-render miss.
  const hasSeenSession = useRef(false)
  useEffect(() => {
    if (accountIndex !== -1) {
      hasSeenSession.current = true
      return
    }
    if (hasSeenSession.current) {
      _this.closeDrawer()
    }
  }, [accountIndex, _this])

  const meta = walletConnectInfo?.session?.peer?.metadata || {}
  const isWalletConnectV2 = walletConnectInfo?.isWalletConnectV2
  // Only show the gas slider for EVM sessions (gas is irrelevant otherwise).
  const isEvmConnection = (walletConnectInfo?.chainArray || []).some((c) => String(c).startsWith('eip155:'))

  const onGasChange = (v) => {
    ReduxService.callDispatchAction(StorageReduxAction.setGasPriceSlideValue(v ?? 1))
  }

  const handleDisconnect = () => {
    ReduxService.disconnectWalletConnectV2(topic, true)
    _this.closeDrawer()
  }

  const renderUrlRow = (icon, label) => (
    <View style={styles.urlRow}>
      <MyRowItem
        noPadding
        lefIcon={(
          <View className='flex flex-row justify-center' style={{ width: getSizeImgSquare('large') }}>
            <MyIcon uri={icon} variant='medium' />
          </View>
        )}
      >
        <View>
          <MyText style={styles.urlText} numberOfLines={1}>{label}</MyText>
        </View>

      </MyRowItem>
    </View>

  )

  return (
    <View style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        leftIcon={meta.icons?.[0] || images.walletConnectIcon}
        title={meta.name || '-'}
        rightElement={(
          <MyButton
            size='small'
            variant='dangerous'
            noMinWidth
            isCircleBtn
            onPress={handleDisconnect}
          >
            <MyIcon uri={images.UIV2.icons.shutDown} variant='title' />
          </MyButton>
        )}
      />
      <View style={{ height: PADDING_TOP_CONTAINER_DRAWER }} />

      <ScrollView
        style={[styles.bodyScroll]}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* URL + connected chains */}
        <View style={styles.urlSection}>
          {renderUrlRow(getUrlIcon(walletConnectInfo?.urlVerifyState), meta.url || '')}
          {/* Connected chains — show all, scroll horizontally when many. */}
          <View style={styles.urlRow}>
            <MyRowItem
              noPadding
              lefIcon={(
                <View className='flex flex-row justify-center' style={{ width: getSizeImgSquare('large') }}>
                  <MyIcon uri={images.UIV2.icons.network} variant='medium' />
                </View>
              )}
            >
              <View style={[styles.urlRowInner, { borderBottomWidth: 0, minHeight: 0 }]}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chainScroll}
                >
                  {connectedChainIds.map((id, index) => (
                    <ChainIcon
                      key={id}
                      chainId={Number(id)}
                      style={index === 0 ? null : styles.chainOverlap}
                    />
                  ))}
                </ScrollView>
              </View>
            </MyRowItem>
          </View>

          {/* <View style={styles.urlRow}>
            <View className='flex flex-row justify-center' style={{ width: getSizeImgSquare('large') }}>
              <MyIcon uri={images.UIV2.icons.network} variant='medium' />
            </View>
            <View style={styles.urlRowInner}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chainScroll}
              >
                {connectedChainIds.map((id, index) => (
                  <ChainIcon
                    key={id}
                    chainId={Number(id)}
                    style={index === 0 ? null : styles.chainOverlap}
                  />
                ))}
              </ScrollView>
            </View>
          </View> */}
        </View>

        {/* Gas fee multiplier */}
        {isEvmConnection && (
          <View style={styles.gasRow}>
            <MyText style={styles.gasLabel}>{I18n.t('WalletConnect.gasFee')}</MyText>
            <View style={styles.gasSliderWrap} onLayout={(e) => setSliderW(e.nativeEvent.layout.width)}>
              <GasSlider
                value={gasPriceSlideValue}
                min={1}
                max={10}
                step={0.2}
                trackWidth={sliderW}
                onChangeEnd={onGasChange}
              />
            </View>
            <MyText style={styles.gasGwei}>{`${formatNumberBro(gasPriceSlideValue, 1)}x Gwei`}</MyText>
          </View>
        )}

        {/* Pending requests — switch/add-chain get their own card, the rest reuse
            CallRequestBox's full approve/reject/confirm-tx logic. */}
        {requestsReversed.length > 0
          ? requestsReversed.map((item, index) => (
            SWITCH_CHAIN_METHODS.includes(item?.method)
              ? (
                <SwitchChainCard
                  key={`${item?.id}-${index}`}
                  item={item}
                  accountIndex={accountIndex}
                  showAlert={_this.showAlert}
                  _this={_this}
                />
              )
              : (
                <RequestCard
                  key={`${item?.id}-${index}`}
                  item={item}
                  index={index}
                  accountIndex={accountIndex}
                  isWalletConnectV2={isWalletConnectV2}
                  percentGasPrice={[gasPriceSlideValue]}
                  showAlert={_this.showAlert}
                  closeModalProps={() => _this.closeDrawer()}
                  _this={_this}
                />
              )
          ))
          : historyReversed.length === 0
            ? (
              <View style={styles.emptyWrap}>
                <MyText style={styles.emptyText}>{I18n.t('v2.walletConnect.reloadHint')}</MyText>
              </View>
            )
            : null}

        {/* When no pending request precedes the history, add the top divider
            (with requests, the last request card already carries a bottom one). */}
        {requestsReversed.length === 0 && historyReversed.length > 0 && (
          <View style={styles.historyTopDivider} />
        )}

        {/* Confirmed transaction history (newest first) */}
        {historyReversed.map((historyItem, index) => (
          <HistoryCard
            key={`history-${index}`}
            historyItem={historyItem}
            accountIndex={accountIndex}
            showAlert={_this.showAlert}
          />
        ))}
      </ScrollView>
    </View>
  )
}

export default WalletConnectRequestsModal
