import React from 'react'
import { View } from 'react-native'
import BigNumber from 'bignumber.js'
import MyText from 'frontend/Components/UI/MyText'
import MyBalance from 'frontend/Components/UI/MyBalance'
import I18n from 'assets/Lang'
import ReduxService from 'common/redux'
import { getCurrencySymbolData, splitDecimalNumber } from 'common/function'
import styles from './styles'

// Totals math is copied verbatim from the legacy OverviewLiquidtyManagement so the
// numbers stay identical — only the presentation is new-design.
const Overview = ({ listLiquidityPool = [] }) => {
  const currencyRedux = ReduxService.getCurrencyRedux()
  const fiatRateRedux = ReduxService.getFiatRateRedux()
  const addressRegisteredLiquidity = ReduxService.getLiquidityList()
  // Currency symbol + placement (matches FiatBalance / TokenRow), replacing the raw code.
  const { symbol: currencySymbol, position: currencyPosition } = getCurrencySymbolData(currencyRedux)
  const currencyPrefix = currencyPosition === 'prefix' ? currencySymbol : ''
  const currencySuffix = currencyPosition === 'suffix' ? ` ${currencySymbol}` : ''

  // listLiquidityPool here already excludes hidden pools (filtered by the caller), so
  // totals are computed over active positions only.
  const totalLiquidity = listLiquidityPool.reduce((total, item) => total + ((!item?.fiatAmountLiquidity || isNaN(item?.fiatAmountLiquidity)) ? 0 : item?.fiatAmountLiquidity), 0)
  const totalLiquidityByFiat = totalLiquidity * fiatRateRedux
  const quantityLiquidity = splitDecimalNumber(BigNumber(totalLiquidityByFiat).decimalPlaces(2), BigNumber.ROUND_DOWN)

  // The raw-USD liquidity total is persisted by PoolList (not here) so it also resets
  // to 0 on an empty / all-hidden list, where Overview never mounts.

  const totalYesterdayProfit = listLiquidityPool.reduce((total, item) => {
    return total + ((!item?.fiatAmountLiquidity || isNaN(item?.fiatAmountYesterdayProfit))
      ? 0
      : Math.max(
        isNaN(item?.earning?.fiatProfitEarning) ? 0 : item?.earning?.fiatProfitEarning,
        isNaN(item?.fiatAmountYesterdayProfit) ? 0 : item?.fiatAmountYesterdayProfit,
        0
      ))
  }, 0)
  const totalYesterdayProfitByFiat = totalYesterdayProfit * fiatRateRedux
  const quantityYesterdayProfit = splitDecimalNumber(BigNumber(totalYesterdayProfitByFiat).decimalPlaces(2, BigNumber.ROUND_DOWN))

  const totalLiquidityHasYesterDayProfit = listLiquidityPool.reduce((total, item) => {
    return total + ((!item?.fiatAmountLiquidity || isNaN(item?.fiatAmountLiquidity) || isNaN(item?.fiatAmountYesterdayProfit)) ? 0 : item?.fiatAmountLiquidity)
  }, 0)
  // Convert to the selected currency (fiatRateRedux) to stay consistent with the values above.
  // The APR ratio is unchanged since fiatRate cancels out between numerator and denominator.
  const totalLiquidityHasYesterDayProfitByFiat = totalLiquidityHasYesterDayProfit * fiatRateRedux
  const totalYesterdayProfitByFiatForApr = totalYesterdayProfit * fiatRateRedux
  const totalLiquidityHasYesterDayProfitDecimalPlaces = BigNumber(totalLiquidityHasYesterDayProfitByFiat).decimalPlaces(2, BigNumber.ROUND_DOWN)
  const totalYesterdayProfitDecimalPlaces = BigNumber(totalYesterdayProfitByFiatForApr).decimalPlaces(2, BigNumber.ROUND_DOWN)
  const totalApr = (totalYesterdayProfitDecimalPlaces * 365 * 100 / totalLiquidityHasYesterDayProfitDecimalPlaces) || 0

  const hasData = listLiquidityPool?.length > 0
  const isRegistered = addressRegisteredLiquidity?.length > 0

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <MyText className='text-low'>{I18n.t('v2.liquidity.totalLiquidity')}</MyText>
        <View style={styles.valueRow}>
          <MyText fontSize={22} fontWeight={700}>
            {currencyPrefix}{!isRegistered
              ? '0'
              : (!isNaN(totalLiquidityByFiat) ? quantityLiquidity.first : '-')}{currencySuffix}
          </MyText>
        </View>
      </View>

      <View style={styles.block}>
        <MyText className='text-low'>{I18n.t('v2.liquidity.yesterdayTotalProfit')}</MyText>
        <View style={styles.valueRow}>
          <MyText fontSize={22} fontWeight={700}>
            {currencyPrefix}{!isRegistered
              ? '0.00'
              : ((!isNaN(totalYesterdayProfitByFiat) && totalYesterdayProfitByFiat !== 0)
                ? quantityYesterdayProfit.first
                : '-')}
            <MyText fontSize={22} fontWeight={700}>
              {isRegistered && (!isNaN(totalYesterdayProfitByFiat) && totalYesterdayProfitByFiat !== 0) ? quantityYesterdayProfit.decimal : ''}{currencySuffix}
            </MyText>
            {hasData && !isNaN(totalApr) && (
              <MyBalance
                fontSize={22}
                fontWeight={700}
                value={totalApr}
                fractionDigits={2}
                fixedDecimals
                prefix=' / '
                suffix='%'
              />
            )}
          </MyText>
        </View>
      </View>
    </View>
  )
}

export default Overview
