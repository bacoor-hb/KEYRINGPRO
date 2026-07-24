import React from 'react'
import { View, StyleSheet } from 'react-native'
import BigNumber from 'bignumber.js'
import { AreaChart, LineChart } from 'react-native-svg-charts'
import * as shape from 'd3-shape'
import { Defs, LinearGradient, Stop } from 'react-native-svg'
import { isEmpty } from 'lodash'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import MyIcon from 'frontend/Components/UI/MyIcon'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import ReduxService from 'common/redux'
import { typeLiquidityPool } from 'common/constants/chain'
import { comparePrice, getCurrencySymbolData, splitDecimalNumber } from 'common/function'
import { Colors, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import { STATUS_RANGE } from 'common/constants/app'
import useGetHistoryLiquidityPool from 'frontend/Hooks/useGetHistoryLiquidityPool'
import useGetPositionLiquidityInfo from 'frontend/Hooks/useGetPositionLiquidityInfo'
import useGetPositionNftName from 'frontend/Hooks/useGetPositionNftName'
import styles, { GRID_LINE_COUNT } from './styles'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

// Shared by the area fill and the line so the stroke sits exactly on the fill's
// upper edge. bottom is 0 so the curve's baseline lands on the container floor —
// i.e. exactly on the bottom (8th) grid line, which is the chart baseline. A top
// inset keeps the peak from being clipped.
const CHART_INSET = { top: pixelByHeight(14), bottom: pixelByHeight(14) }

// 8 grid lines as 8 equal flex rows; the last is the brighter baseline that the
// chart curve rests on. Shared by the chart and the empty-state placeholder.
const renderChartGrid = () => (
  <View style={styles.chartGridLines}>
    {Array.from({ length: GRID_LINE_COUNT }, (_, index) => (
      <View key={index} style={styles.chartGridRow}>
        <View style={[styles.chartGridLine, index === GRID_LINE_COUNT - 1 && styles.chartGridLineFloor]} />
      </View>
    ))}
  </View>
)

const DEX_ICON = {
  [typeLiquidityPool.uniswap]: images.icUniswapV3,
  [typeLiquidityPool.pancakeswap]: images.ic_pancake_swap,
  [typeLiquidityPool.raydium]: images.ic_raydium_v3
}

const DetailPool = ({ item, tokenInfo0, tokenInfo1 }) => {
  const currencyRedux = ReduxService.getCurrencyRedux()
  const fiatRateRedux = ReduxService.getFiatRateRedux()
  // Currency symbol + placement (matches FiatBalance / TokenRow), replacing the raw code.
  const { symbol: currencySymbol, position: currencyPosition } = getCurrencySymbolData(currencyRedux)
  const currencyPrefix = currencyPosition === 'prefix' ? currencySymbol : ''
  const currencySuffix = currencyPosition === 'suffix' ? ` ${currencySymbol}` : ''
  const dexIcon = DEX_ICON[item?.type] || images.icUniswapV3

  // Same hooks / data the legacy DetailPool used — design is the only change.
  const { data: dataHistoryLiquidityPool, isLoading: isLoadingHistoryLiquidityPool } = useGetHistoryLiquidityPool(item?.id, item?.chainId, item?.owner, item?.tokenId)
  const { data: positionLiquidityInfoData, isLoading: isLoadingPositionLiquidityInfo } = useGetPositionLiquidityInfo(item?.id, item?.chainId, item?.owner, item?.tokenId)

  const { token0Percentage, token1Percentage, rangeStatus, percentMinTick, percentMaxTick, token0OriginalPercentage } = positionLiquidityInfoData || {}

  // Subtitle under "Range" — pair + fee + price range, taken straight from the
  // on-chain Uniswap/Pancake NFT (tokenURI → name), so it always matches the NFT:
  //   name = "Uniswap - 0.3% - VIRTUAL/WETH - 2270.2<>3413.8"
  // We re-assemble in the design order "{pair} {fee}% - {lower}<>{upper}". Each
  // part is appended only when present, so it degrades gracefully.
  const { data: positionNftName } = useGetPositionNftName(item?.chainId, item?.tokenId, item?.type)
  const rangeSubtitleParts = []
  if (positionNftName?.pair) rangeSubtitleParts.push(positionNftName.pair)
  if (positionNftName?.feePercent) rangeSubtitleParts.push(`${positionNftName.feePercent}%`)
  let rangeSubtitle = rangeSubtitleParts.join(' ')
  if (positionNftName?.range) {
    rangeSubtitle = rangeSubtitle ? `${rangeSubtitle} - ${positionNftName.range}` : positionNftName.range
  }
  // Out-of-range arrow side, derived from the same signal the API uses to flag
  // OUT_RANGE (a token at 0%) rather than a tick comparison — the raw tick values
  // (min/max as strings, current as number) don't reliably reflect which side the
  // price left the range, so some OUT_RANGE positions showed no arrow at all.
  //   token0 at 0% → price below range → arrow on the left segment
  //   token1 at 0% → price above range → arrow on the right segment
  const isOutRange = rangeStatus === STATUS_RANGE.OUT_RANGE
  const isBelowRange = isOutRange && Number(token0Percentage) === 0
  const isAboveRange = isOutRange && Number(token1Percentage) === 0
  const token0PercentageSplit = splitDecimalNumber(token0Percentage)
  const token1PercentageSplit = splitDecimalNumber(token1Percentage)
  const TITLE_RANGE = {
    [STATUS_RANGE.FULL_RANGE]: I18n.t('liquidityManagementScreen.fullRange'),
    [STATUS_RANGE.IN_RANGE]: I18n.t('v2.liquidity.inRange'),
    [STATUS_RANGE.OUT_RANGE]: ''
  }

  const statusChangePriceQuantityLiquidity = comparePrice(dataHistoryLiquidityPool?.[dataHistoryLiquidityPool?.length - 1], dataHistoryLiquidityPool?.[0])
  // Line stroke + the area-fill tint, kept in sync the way token detail v2 does.
  // The NO_CHANGE (flat) case keeps the neutral grey the liquidity chart used.
  const colorLine = statusChangePriceQuantityLiquidity === 'NO_CHANGE' ? 'white' : statusChangePriceQuantityLiquidity === 'UP' ? '#00C365' : '#FF3D4A'
  const chartFillColor = statusChangePriceQuantityLiquidity === 'NO_CHANGE' ? '#757578' : statusChangePriceQuantityLiquidity === 'UP' ? '#0E5D3A' : '#752A2E'

  const quantityLiquidityStartTemp = (dataHistoryLiquidityPool?.[0] || 0) * fiatRateRedux
  const quantityStartLiquidity = splitDecimalNumber(BigNumber(quantityLiquidityStartTemp).decimalPlaces(8))
  const quantityLiquidityEndTemp = (item?.fiatAmountLiquidity || 0) * fiatRateRedux
  const quantityEndLiquidity = splitDecimalNumber(BigNumber(quantityLiquidityEndTemp).decimalPlaces(8))

  const hasChart = dataHistoryLiquidityPool?.length > 0

  // Full-screen states. Each hook's isLoading is already "loading AND no data yet"
  // (offline still surfaces the persisted snapshot, so this only fires on a genuine
  // first load with nothing cached). We wait for BOTH the position info and the chart
  // history before showing content — "show only once all data is in". The NFT-name
  // subtitle is optional (degrades gracefully) so it doesn't gate the screen.
  const isLoadingAll = isLoadingPositionLiquidityInfo || isLoadingHistoryLiquidityPool
  // Loaded but the position info came back empty (e.g. server returned nothing and no
  // cache) → show the shared empty state instead of a broken/blank layout.
  const isEmptyData = !isLoadingAll && isEmpty(positionLiquidityInfoData)

  return (
    <MyViewPage isUseDrawer style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        containerConfig={{ style: styles.sectionPadding }}
        title={(
          <View style={styles.flex1}>
            <MyText variant='subTitle'>{item?.tokenId}</MyText>
            {/* <MyText className='text-medium'>{dateFmt(item?.initialTimestamp ? item.initialTimestamp * 1000 : Date.now())}</MyText> */}
          </View>
        )}
        leftIcon={<TokenIconWithChain tokenIconUri={dexIcon} chainId={item?.chainId} />}
      />

      {/* Full-screen loading / empty / content. Loader shows only on a genuine first
          load (no cached snapshot); once all data is in we render the content, and if
          the position info came back empty we show the shared empty state. */}
      {isLoadingAll
        ? (
          <View style={styles.fullScreenState}>
            <MyDotsLoading variant='small' />
          </View>
        )
        : isEmptyData
          ? (
            <View style={styles.fullScreenState}>
              <MyIcon uri={images.UIV2.icons.noData} variant='extraLarge' style={styles.emptyIcon} resizeMode='contain' />
              <MyText variant='small' className='text-low'>{I18n.t('v2.selectToken.noData')}</MyText>
            </View>
          )
          : (
            <ScrollViewBlurHeader
              style={{
                paddingTop: pixelByHeight(8)
              }}
              isUseDrawer
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}>
              {/* Range meter — ported 1:1 from the legacy DetailPool (dark-mode only). */}
              {!isLoadingPositionLiquidityInfo && !isEmpty(positionLiquidityInfoData) && (
                <View style={styles.section}>
                  <MyText variant='subTitle'>{I18n.t('v2.liquidity.range')}</MyText>
                  <MyTextTicker
                    scroll={false}
                    style={{
                      opacity: rangeSubtitle ? 1 : 0
                    }}
                    className='text-medium'>{rangeSubtitle || ''}</MyTextTicker>
                  <View style={styles.rangeMeterBox}>
                    {rangeStatus === STATUS_RANGE.FULL_RANGE && (
                      <View
                        style={{
                          gap: pixelByHeight(4)
                        }}>
                        <View style={styles.fullRangeRow}>
                          <ImageRender style={styles.imgIconToken} uri={tokenInfo0?.icon_image} uriDefault={images.UIV2.icons.unknowToken} resizeMode='contain' />
                          <MyText variant='small' style={styles.textStatusRange}>{TITLE_RANGE[rangeStatus]}</MyText>
                          <ImageRender style={styles.imgIconToken} uri={tokenInfo1?.icon_image} uriDefault={images.UIV2.icons.unknowToken} resizeMode='contain' />
                        </View>
                        <View style={[styles.rangeTrackBorder, { marginTop: pixelByHeight(10) }]}>
                          <View style={[styles.rangeSegment, { backgroundColor: Colors.WHITE }]} />
                        </View>
                      </View>
                    )}

                    {(rangeStatus === STATUS_RANGE.IN_RANGE || rangeStatus === STATUS_RANGE.OUT_RANGE) && (
                      <View style={{ marginVertical: pixelByHeight(10), marginTop: pixelByHeight(17) }}>
                        <View style={[styles.rangeTrackBorder, { marginVertical: pixelByHeight(10) }]}>
                          {/* left */}
                          <View style={{ flex: 1 }}>
                            <View style={[styles.rangeSegment, { width: '100%', borderTopEndRadius: 0, borderBottomEndRadius: 0 }]} />
                            {isBelowRange && (
                              <View style={{ position: 'absolute', top: pixelByHeight(7), left: `${100 - percentMinTick}%`, marginLeft: -sizeImageSquare(13) / 2 }}>
                                <ImageRender style={styles.arrowRange} uri={images.ic_arrow_up_range_Darkmode} resizeMode='contain' />
                              </View>
                            )}
                          </View>
                          {/* center */}
                          <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', position: 'relative' }}>
                            <View style={{ position: 'absolute', top: -pixelByHeight(38), left: 0, height: pixelByHeight(86), display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: pixelByWidth(83), transform: [{ translateX: pixelByWidth(41) * -1 }] }}>
                              <ImageRender style={styles.imgIconToken} uri={tokenInfo0?.icon_image} uriDefault={images.UIV2.icons.unknowToken} resizeMode='contain' />
                              <MyText>
                                <MyText>{token0PercentageSplit.first}</MyText>
                                <MyText>{token0PercentageSplit.decimal}%</MyText>
                              </MyText>
                            </View>
                            <View style={{ position: 'absolute', top: -pixelByHeight(38), right: 0, height: pixelByHeight(86), display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: pixelByWidth(83), transform: [{ translateX: pixelByWidth(41) }] }}>
                              <ImageRender style={styles.imgIconToken} uri={tokenInfo1?.icon_image} uriDefault={images.UIV2.icons.unknowToken} resizeMode='contain' />
                              <MyText>
                                <MyText>{token1PercentageSplit.first}</MyText>
                                <MyText>{token1PercentageSplit.decimal}%</MyText>
                              </MyText>
                            </View>
                            <View style={{ position: 'absolute', top: -pixelByHeight(38), width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <MyText variant='small' style={styles.textStatusRange}>{TITLE_RANGE[rangeStatus]}</MyText>
                            </View>

                            {rangeStatus === STATUS_RANGE.IN_RANGE && token0OriginalPercentage && (
                              <View style={{ position: 'absolute', left: `${token0OriginalPercentage}%`, top: -pixelByHeight(5) - pixelByHeight(5) }}>
                                <View style={{ backgroundColor: Colors.WHITE, height: pixelByHeight(7), width: pixelByWidth(2) }} />
                              </View>
                            )}

                            <View style={[styles.rangeSegment, { width: '100%', backgroundColor: Colors.WHITE, borderRadius: pixelByHeight(5), maxHeight: pixelByHeight(5) }]} />

                            {rangeStatus === STATUS_RANGE.IN_RANGE && (
                              <View style={{ position: 'absolute', top: pixelByHeight(7), left: `${token0Percentage}%`, marginLeft: -sizeImageSquare(13) / 2 }}>
                                <ImageRender style={styles.arrowRange} uri={images.ic_arrow_up_range_Darkmode} resizeMode='contain' />
                              </View>
                            )}
                          </View>
                          {/* right */}
                          <View style={{ flex: 1 }}>
                            <View style={[styles.rangeSegment, { width: '100%', borderTopStartRadius: 0, borderBottomStartRadius: 0 }]} />
                            {isAboveRange && (
                              <View style={{ position: 'absolute', top: pixelByHeight(7), left: `${percentMaxTick}%`, marginLeft: -sizeImageSquare(13) / 2 }}>
                                <ImageRender style={styles.arrowRange} uri={images.ic_arrow_up_range_Darkmode} resizeMode='contain' />
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Liquidity chart */}
              <View
                style={{
                  paddingTop: pixelByHeight(10)
                }}
              >
                <View
                  style={styles.divider} />
              </View>

              <View
                style={[styles.section, {
                  marginBottom: pixelByHeight(18.5)
                }]}>
                <MyText variant='subTitle'>{I18n.t('liquidityManagementScreen.liquidityChart')}</MyText>
                <View>
                  {hasChart && (
                    <View style={styles.chartLabels}>
                      <MyText className='text-medium'>{currencyPrefix}{quantityStartLiquidity.first}{currencySuffix}</MyText>
                      <MyText className='text-medium'>{currencyPrefix}{quantityEndLiquidity.first}{currencySuffix}</MyText>
                    </View>
                  )}
                  {hasChart
                    ? (
                  // Same two-layer chart as token detail v2: an AreaChart that only
                  // paints the vertical fade-to-transparent fill (no stroke, so its
                  // flat bottom edge never shows as a stray line), with the price line
                  // drawn on top by a LineChart sharing the exact same contentInset.
                      <View style={styles.chartWrap}>
                        {renderChartGrid()}
                        <AreaChart
                          start={Math.min(...dataHistoryLiquidityPool)}
                          style={styles.chart}
                          data={dataHistoryLiquidityPool}
                          svg={{ fill: 'url(#gradientLiquidity)' }}
                          curve={shape.curveCatmullRom}
                          contentInset={CHART_INSET}
                          animate
                          animationDuration={1000}
                        >
                          <Defs>
                            <LinearGradient id='gradientLiquidity' x1='0%' y1='0%' x2='0%' y2='100%'>
                              <Stop offset='0%' stopColor={chartFillColor} stopOpacity='0.9' />
                              <Stop offset='50%' stopColor={chartFillColor} stopOpacity='0.8' />
                              <Stop offset='100%' stopColor={chartFillColor} stopOpacity='0' />
                            </LinearGradient>
                          </Defs>
                        </AreaChart>
                        <LineChart
                          style={StyleSheet.absoluteFill}
                          data={dataHistoryLiquidityPool}
                          svg={{ stroke: colorLine, strokeWidth: pixelByWidth(2) }}
                          curve={shape.curveCatmullRom}
                          contentInset={CHART_INSET}
                          animate
                          animationDuration={1000}
                        />
                      </View>
                    )
                    : (
                      <View style={styles.chartWrap}>
                        {renderChartGrid()}
                      </View>
                    )}
                </View>

              </View>
            </ScrollViewBlurHeader>
          )}
    </MyViewPage>
  )
}

export default DetailPool
