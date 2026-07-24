import React, { useRef } from 'react'
import { View, TouchableOpacity, Animated, InteractionManager } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import LottieView from 'lottie-react-native'
import BigNumber from 'bignumber.js'
import moment from 'moment'
import TextTicker from 'react-native-text-ticker'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyIcon from 'frontend/Components/UI/MyIcon'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import ChainIcon from 'frontend/Components/UI/ChainIcon'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP, typeLiquidityPool } from 'common/constants/chain'
import {
  comparePrice,
  convertChainIdToPancakeswap,
  convertChainIdToUniswap,
  getCurrencySymbolData,
  handleOpenUrl,
  routeLinkScanWithHash,
  splitDecimalNumber
} from 'common/function'
import { Colors, getHeightHeader, getSizeImgSquare, pixelByWidth } from 'common/styles'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'
import Overview from '../Overview'
import styles from './styles'

// Total swipe-open width = the actions column width defined in styles.actionsBox.
// The column is wider than the round button so the label below it isn't clipped
// (mirrors TokenList's 64px swipe column). Must match so the panel slides fully into view.
const SWIPE_ACTIONS_WIDTH = getSizeImgSquare('large') + pixelByWidth(16)

const DEX_LABEL = {
  [typeLiquidityPool.uniswap]: 'Uniswap',
  [typeLiquidityPool.pancakeswap]: 'Pancakeswap',
  [typeLiquidityPool.raydium]: 'Raydium'
}

const statusColor = (status) => {
  if (status === 'UP') return { color: Colors.GREEN_TEXT }
  if (status === 'DOWN') return { color: Colors.RED_TEXT }
  return {}
}

const PoolList = ({ _this, isLoading, listLiquidityPool = [], listTokensDetail, dataListAddressCoinPoolChecked, arrayAddressDeleted = [], onRefresh, refreshing = false }) => {
  // Hidden state is derived here from arrayAddressDeleted (Redux) rather than baked
  // into the pool data, so Hide/Show toggles re-render instantly without re-running
  // the pool / token-detail network queries.
  const deletedSet = new Set(arrayAddressDeleted)
  // One Swipeable ref per row (keyed by _id) so an action can close its own row before
  // the list re-sorts. Closing first lets the gesture/animation settle, otherwise the
  // open-swipe animation competes with the re-render and the UI update is delayed ~1-2s.
  const swipeableRefs = useRef({})
  const currencyRedux = ReduxService.getCurrencyRedux()
  const fiatRateRedux = ReduxService.getFiatRateRedux()
  // Currency symbol + placement (matches FiatBalance / TokenRow), replacing the raw code.
  const { symbol: currencySymbol, position: currencyPosition } = getCurrencySymbolData(currencyRedux)
  const currencyPrefix = currencyPosition === 'prefix' ? currencySymbol : ''
  const currencySuffix = currencyPosition === 'suffix' ? ` ${currencySymbol}` : ''

  // Close the row's swipe panel, then run the Redux mutation once the close animation
  // has settled. Dispatching while the panel is mid-animation defers the list re-render
  // (the gesture handler holds the frame), which is what caused the ~1-2s UI lag.
  const closeRowThen = (item, mutate) => {
    swipeableRefs.current[item?._id]?.close?.()
    InteractionManager.runAfterInteractions(() => mutate())
  }

  // "Hide" reuses the legacy delete-from-view logic: stash the position id under its
  // owner in addressDeletedLiquidity so the list dims it and drops it from totals.
  const onHide = (item) => closeRowThen(item, () => {
    const temp = JSON.parse(JSON.stringify(ReduxService.getAddressDeletedLiquidity() || {}))
    temp[item?.owner] = [...(temp[item?.owner] ?? []), item._id]
    ReduxService.callDispatchAction(StorageReduxAction.setAddressDeletedLiquidity(temp))
  })

  // "Show" is the inverse: remove the position id from its owner's hidden list so it
  // returns to the active section and counts toward totals again.
  const onShow = (item) => closeRowThen(item, () => {
    const temp = JSON.parse(JSON.stringify(ReduxService.getAddressDeletedLiquidity() || {}))
    temp[item?.owner] = (temp[item?.owner] ?? []).filter((id) => id !== item._id)
    ReduxService.callDispatchAction(StorageReduxAction.setAddressDeletedLiquidity(temp))
  })

  const onRealTime = (item) => {
    let uri
    switch (item.type) {
      case typeLiquidityPool.pancakeswap:
        uri = `https://pancakeswap.finance/liquidity/${item.tokenId}?chain=${convertChainIdToPancakeswap(Number(item.chainId))}`
        break
      default:
        uri = `https://app.uniswap.org/pools/${item.tokenId}?chain=${convertChainIdToUniswap(Number(item.chainId))}`
        break
    }
    handleOpenUrl(uri)
  }

  const onTxd = (item) => {
    routeLinkScanWithHash(item?.initialHash, Number(item.chainId?.toString()))
  }

  // Track the drag distance 1:1 so the actions slide in only as far as the user
  // has pulled — no early reveal on light swipes (matches the TokenList feel).
  const renderRightActions = (item, dragX) => {
    const isRaydium = item.type === typeLiquidityPool.raydium
    const isHidden = deletedSet.has(item?._id)
    const trans = dragX.interpolate({
      inputRange: [-SWIPE_ACTIONS_WIDTH, 0],
      outputRange: [0, SWIPE_ACTIONS_WIDTH],
      extrapolate: 'clamp'
    })
    return (
      <Animated.View style={[styles.actionsBox, { transform: [{ translateX: trans }] }]}>
        {isHidden
          ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center'

              }}>
              <TouchableOpacity activeOpacity={0.8} style={styles.action} onPress={() => onShow(item)}>
                <View style={[styles.actionIcon, { backgroundColor: '#00D36CCC' }]}>
                  <MyIcon uri={images.UIV2.icons.eyeShow} variant='small' />
                </View>
              </TouchableOpacity>
            </View>

          )
          : (
            <>
              <TouchableOpacity activeOpacity={0.8} style={styles.action} onPress={() => onHide(item)}>
                <View style={[styles.actionIcon, { backgroundColor: '#FFCB45CC' }]}>
                  <MyIcon uri={images.UIV2.icons.eyeHide} variant='small' />
                </View>
              </TouchableOpacity>
              {!isRaydium && (
                <>
                  <TouchableOpacity activeOpacity={0.8} style={styles.action} onPress={() => onRealTime(item)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#2D8DEDCC' }]}>
                      <MyIcon uri={images.UIV2.icons.icon_explorer} variant='small' />
                    </View>
                  </TouchableOpacity>
                  {!!item?.initialHash && (
                    <TouchableOpacity activeOpacity={0.8} style={styles.action} onPress={() => onTxd(item)}>
                      <View style={[styles.actionIcon, { backgroundColor: '#767F8CCC' }]}>
                        <MyIcon uri={images.UIV2.icons.icon_txd} variant='small' />
                      </View>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>

          )}

      </Animated.View>
    )
  }

  const renderCard = (item) => {
    const isHidden = deletedSet.has(item?._id)
    // Per-position math copied from the legacy ListLiquidityPool renderRowPoolLiquidity.
    const quantityLiquidityTemp = (item?.fiatAmountLiquidity || 0) * fiatRateRedux
    const quantityLiquidity = splitDecimalNumber(BigNumber(quantityLiquidityTemp).decimalPlaces(8))
    const quantityUnclaimedFeesTemp = (item?.fiatAmountUnclaimedFees || 0) * fiatRateRedux
    const quantityUnclaimedFees = splitDecimalNumber(BigNumber(quantityUnclaimedFeesTemp).decimalPlaces(2))

    const quantityYesterdayProfitTemp = Math.max(
      isNaN(item?.earning?.fiatProfitEarning) ? 0 : item?.earning?.fiatProfitEarning,
      isNaN(item?.fiatAmountYesterdayProfit) ? 0 : item?.fiatAmountYesterdayProfit,
      0
    ) * fiatRateRedux
    const quantityYesterdayProfit = splitDecimalNumber(BigNumber(quantityYesterdayProfitTemp).decimalPlaces(2))

    const percentAprTemp = Math.max(
      isNaN(item?.earning?.fiatProfitEarning) ? 0 : item?.earning?.fiatProfitEarning * 365 * 100 / item?.fiatAmountLiquidity,
      isNaN(item?.positionAprLast24h) ? 0 : item?.positionAprLast24h,
      0
    )

    const quantityLiquidity24hOld = (item?.fiatAmountLiquidityLast24h || 0) * fiatRateRedux
    const statusChangePriceQuantityLiquidity = comparePrice(quantityLiquidityTemp, quantityLiquidity24hOld)
    const yesterdayProfit24hOld = Math.max(
      isNaN(item?.earning48h?.fiatProfitEarning) ? 0 : item?.earning48h?.fiatProfitEarning,
      isNaN(item?.fiatAmountYesterdayProfitLast24h) ? 0 : item?.fiatAmountYesterdayProfitLast24h,
      0
    ) * fiatRateRedux
    const statusChangePriceYesterdayProfit = comparePrice(quantityYesterdayProfitTemp, yesterdayProfit24hOld)

    const initialTimestamp = item?.initialTimestamp
    const difference = Date.now() - initialTimestamp * 1000
    let timeFormatAge = initialTimestamp && Number(moment.duration(difference).asDays()).toFixed(0)
    timeFormatAge = initialTimestamp
      ? timeFormatAge > 0 ? I18n.t('liquidityManagementScreen.timeDaysAgo', { value: timeFormatAge }) : moment(initialTimestamp * 1000).fromNow()
      : ''

    const tokenInfo0 = listTokensDetail?.find((token) => token?.address?.toLowerCase() === item?.token0?.address?.toLowerCase())
    const tokenInfo1 = listTokensDetail?.find((token) => token?.address?.toLowerCase() === item?.token1?.address?.toLowerCase())
    const symbolToken0 = tokenInfo0?.auditGoplus?.token_symbol ?? tokenInfo0?.symbol ?? item?.token0?.symbol
    const symbolToken1 = tokenInfo1?.auditGoplus?.token_symbol ?? tokenInfo1?.symbol ?? item?.token1?.symbol

    const amountToken0Format = splitDecimalNumber(BigNumber(Math.max(isNaN(item?.earning?.token0Earning) ? 0 : item?.earning?.token0Earning, isNaN(item?.unclaimedToken0Last24hProfit) ? 0 : item?.unclaimedToken0Last24hProfit, 0)).decimalPlaces(16))
    const amountToken1Format = splitDecimalNumber(BigNumber(Math.max(isNaN(item?.earning?.token1Earning) ? 0 : item?.earning?.token1Earning, isNaN(item?.unclaimedToken1Last24hProfit) ? 0 : item?.unclaimedToken1Last24hProfit, 0)).decimalPlaces(16))

    const amountToken0Text = isNaN(item?.unclaimedToken0Last24hProfit)
      ? `- ${symbolToken0}`
      : `${amountToken0Format.first}${amountToken0Format.decimal} ${symbolToken0}`
    const amountToken1Text = isNaN(item?.unclaimedToken1Last24hProfit)
      ? `- ${symbolToken1}`
      : `${amountToken1Format.first}${amountToken1Format.decimal} ${symbolToken1}`

    const apr48h = item?.positionAprLast48h || 0
    const statusChangePriceQuantityAPR = comparePrice(percentAprTemp, apr48h)

    const dexLabel = DEX_LABEL[item?.type] || 'Uniswap'

    // Fees-collected flag with the same coin-pool override the legacy list applied.
    const owner = item?.owner?.toLowerCase()
    const isAddressInCoinPool = dataListAddressCoinPoolChecked?.length > 0 && dataListAddressCoinPoolChecked?.some(data => {
      return data.isExist && data.address.toLowerCase() === owner
    })
    let isFeesCollected = !!item?.isCollected
    if (isAddressInCoinPool && isFeesCollected && BigNumber(item?.earning?.fiatProfitEarning).gte(0)) {
      isFeesCollected = false
    }

    const onPress = () => {
      _this.handleOpenDetail(item, tokenInfo0, tokenInfo1, dataListAddressCoinPoolChecked)
    }

    return (
      <Swipeable
        ref={(ref) => { swipeableRefs.current[item?._id] = ref }}
        renderRightActions={(_progress, dragX) => renderRightActions(item, dragX)}
      >
        <TouchableOpacity
          disabled={isHidden}
          activeOpacity={1}
          onPress={onPress}
          style={{
            flexDirection: 'row',
            gap: pixelByWidth(8),
            justifyContent: 'space-between'
          }}
        >
          <View
            style={[styles.card, isHidden && styles.cardHidden, {
              flex: 1
            }]}
          >

            <View style={styles.itemRow}>
              <MyText>{dexLabel}: {timeFormatAge}</MyText>
              <View style={styles.pairRow}>
                <View style={styles.tokenIcons}>
                  <TokenIconWithChain tokenIconUri={tokenInfo0?.icon_image} hideChainBadge />
                  <TokenIconWithChain tokenIconUri={tokenInfo1?.icon_image} chainId={item?.chainId} style={styles.tokenIconOverlap} />
                </View>
                <View style={styles.pairNameBox}>
                  <TextTicker animationType='auto' loop bounce={false} marqueeDelay={1000} duration={5000}>
                    <MyText variant='subTitle'>{symbolToken0}/{symbolToken1}</MyText>
                  </TextTicker>
                </View>
              </View>
            </View>

            <View style={styles.itemRow}>
              <MyText className='text-low'>{I18n.t('v2.liquidity.liquidity')}</MyText>
              <MyText variant='subTitle' fontWeight={700} style={!isNaN(item?.fiatAmountLiquidity) ? statusColor(item?.totalDayHistory === 1 ? '' : statusChangePriceQuantityLiquidity) : undefined}>
                {currencyPrefix}{!isNaN(item?.fiatAmountLiquidity) ? quantityLiquidity.first : '-'}
                <MyText variant='subTitle' fontWeight={700} style={!isNaN(item?.fiatAmountLiquidity) ? statusColor(item?.totalDayHistory === 1 ? '' : statusChangePriceQuantityLiquidity) : undefined}>
                  {currencySuffix}
                </MyText>
              </MyText>
            </View>
            <View style={styles.itemRow}>
              <View style={styles.feeRow}>
                <View style={styles.flex1}>
                  <MyText className='text-low'>{I18n.t('v2.liquidity.unclaimedFees')}</MyText>
                  {isFeesCollected
                    ? <MyText style={styles.feesCollected}>{I18n.t('v2.liquidity.feesCollected')}</MyText>
                    : (
                      <MyText variant='subTitle' fontWeight={700}>
                        {currencyPrefix}{!isNaN(item?.fiatAmountUnclaimedFees) ? quantityUnclaimedFees.first : '-'}
                        <MyText variant='subTitle' fontWeight={700}>
                          {!isNaN(item?.fiatAmountUnclaimedFees) && quantityUnclaimedFees.decimal}{currencySuffix}
                        </MyText>
                      </MyText>
                    )}
                </View>
              </View>
            </View>
            <View style={styles.itemRow}>
              <MyText className='text-low'>{I18n.t('v2.liquidity.yesterdayProfit')}</MyText>
              {isFeesCollected
                ? <MyText style={styles.feesCollected}>{I18n.t('liquidityManagementScreen.itWillBeRecalculatedAtNextUpdate')}</MyText>
                : (
                  <>
                    <MyText variant='subTitle' fontWeight={700}>
                      <MyText variant='subTitle' fontWeight={700} style={!isNaN(item?.fiatAmountYesterdayProfit) ? statusColor(item?.totalDayHistory === 1 ? '' : statusChangePriceYesterdayProfit) : undefined}>
                        {currencyPrefix}{!isNaN(item?.fiatAmountYesterdayProfit) ? quantityYesterdayProfit.first : '-'}
                        <MyText variant='subTitle' fontWeight={700} style={!isNaN(item?.fiatAmountYesterdayProfit) ? statusColor(item?.totalDayHistory === 1 ? '' : statusChangePriceYesterdayProfit) : undefined}>
                          {!isNaN(item?.fiatAmountYesterdayProfit) && quantityYesterdayProfit.decimal}{currencySuffix}
                        </MyText>
                      </MyText>
                      <MyText variant='subTitle' fontWeight={700} className='text-white'> / </MyText>
                      {!isNaN(item?.positionAprLast24h) ? (
                        <MyBalance
                          variant='subTitle'
                          fontWeight={700}
                          value={percentAprTemp}
                          fractionDigits={2}
                          fixedDecimals
                          suffix='%'
                          style={statusColor(item?.totalDayHistory === 1 ? '' : statusChangePriceQuantityAPR)}
                        />
                      ) : (
                        <MyText variant='subTitle' fontWeight={700}>-%</MyText>
                      )}
                    </MyText>
                    <MyTextTicker className='text-medium'>{amountToken0Text}</MyTextTicker>
                    <MyTextTicker className='text-medium'>{amountToken1Text}</MyTextTicker>
                  </>
                )}
            </View>
          </View>
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center'
            }}>
            <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' />

          </View>

        </TouchableOpacity>
      </Swipeable>
    )
  }

  // Hidden pools sink to the bottom; within each group sort by liquidity desc.
  const sorted = [...listLiquidityPool].sort((a, b) => {
    const aHidden = deletedSet.has(a?._id)
    const bHidden = deletedSet.has(b?._id)
    if (aHidden !== bHidden) return Number(aHidden) - Number(bHidden)
    return b?.fiatAmountLiquidity - a?.fiatAmountLiquidity
  })

  // Overview totals exclude hidden pools.
  const activePool = listLiquidityPool.filter((item) => !deletedSet.has(item?._id))

  // Title + Overview ride at the top of the list so they scroll UNDER the blur
  // header (same pattern as Send/Received history). listContent reserves the
  // header height up top so the title clears the floating header. The title shows
  // even while loading / empty; Overview only when there are pools.
  const renderHeader = () => (
    <>
      {/* Pass a no-op onLayout so this visible (scrolling) title does NOT touch the
          shared drawer-anchor ref — page.js renders a fixed off-flow anchor copy.
          (noHeaderAnchor would instead write 0 to that ref and clobber the anchor.) */}
      <TitleScreen title={I18n.t('v2.liquidity.title')} onLayout={() => {}} />
      {!!sorted.length && <Overview listLiquidityPool={activePool} />}
    </>
  )

  // Shown when the address holds no LP positions (loader is handled in the footer).
  const renderEmpty = () => {
    if (isLoading) return null
    return (
      <View style={styles.emptyWrap}>
        <MyIcon uri={images.UIV2.icons.noData} variant='extraLarge' style={styles.emptyIcon} resizeMode='contain' />
        <MyText variant='small' className='text-low'>{I18n.t('v2.liquidity.noLpToken')}</MyText>
      </View>
    )
  }

  // Each row keeps the leading divider the legacy map rendered before every card.
  const renderItem = ({ item }) => (
    <View>
      <View style={styles.divider} />
      {renderCard(item)}
    </View>
  )

  const renderFooter = () => {
    if (isLoading) {
      return (
        <View style={styles.loaderBox}>
          <LottieView style={styles.loader} source={images.keyringLoadingV1} autoPlay loop resizeMode='cover' />
        </View>
      )
    }
    if (!sorted.length) return null
    // Trailing divider (the legacy map appended one after the last card) + footer note.
    return (
      <>
        <View style={styles.divider} />

        <View style={styles.footer}>
          <View style={styles.footerChains}>
            <View style={styles.chainIcons}>
              {CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP.map((chain) => (
                <ChainIcon key={chain} chainId={chain} />
              ))}
            </View>
            <MyText variant='small' className='text-low' style={styles.footerNote}>
              Uniswap V3
            </MyText>
          </View>
          <MyText variant='small' className='text-low' style={styles.footerNote}>
            {/* Pass `number` so locales whose translation includes the "up to N LP
                tokens" sentence (e.g. JP) don't render a "[missing number value]"
                placeholder. The product limit is 10 LP tokens per address. */}
            {I18n.t('v2.liquidity.newPositionShort', { number: 10 })}
          </MyText>
        </View>

      </>
    )
  }

  return (
    <LottieRefreshFlatList
      refreshing={false}
      onRefresh={onRefresh}
      showWhileRefreshing={false}
      // Show the indicator below the floating blur header (list content is already
      // padded by that height via styles.listContent).
      topOffset={getHeightHeader(true)}
      // listContent already reserves the header height, so don't let the component
      // add its own blur-header spacer (would double the top padding).
      blurHeader={false}
      data={isLoading ? [] : sorted}
      extraData={arrayAddressDeleted}
      keyExtractor={(item) => `${item._id}`}
      // removeClippedSubviews={false}
      windowSize={Math.max(11, sorted.length)}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader()}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  )
}

export default PoolList
