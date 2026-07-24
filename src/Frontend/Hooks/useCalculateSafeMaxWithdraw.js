import { useQuery } from 'react-query'
import BigNumber from 'bignumber.js'
import { sleep } from 'common/function'

export const TARGET_HEALTH_FACTOR = '1.01'

/**
 * Custom hook to calculate safe maximum withdraw amount based on Health Factor
 * Automatically refetches every 5 minutes to keep data fresh
 *
 * @param {Object} params
 * @param {Object} params.userMarketData - User market state from AAVE
 * @param {Object} params.dataReserve - Reserve data from AAVE
 * @param {Object} params.tokenInfo - Token information
 * @param {string} params.currentBalance - Current withdrawable balance
 * @param {boolean} params.enabled - Whether to enable the query
 * @returns {Object} { safeMaxWithdraw, isLoading, error, refetch }
 */
const useCalculateSafeMaxWithdraw = ({
  userMarketData,
  dataReserve,
  currentBalance,
  options = {
    cacheTime: undefined,
    enabled: true,
    delay: 0
  }
}) => {
  const calculateSafeMax = async () => {
    try {
      // If user has no borrow position, can withdraw all
      const totalDebtValue = userMarketData?.totalDebtBase || '0'
      if (!totalDebtValue || BigNumber(totalDebtValue).isZero()) {
        await sleep(1000)
        return currentBalance
      }

      // Get user's current health factor
      const currentHealthFactor = userMarketData?.healthFactor || '0'

      // If health factor is already very low, allow minimal withdraw
      if (BigNumber(currentHealthFactor).isLessThan(TARGET_HEALTH_FACTOR) && !BigNumber(currentHealthFactor).isEqualTo(Infinity)) {
        return BigNumber(0)
      }

      // Calculate safe withdraw amount
      const totalCollateral = BigNumber(userMarketData?.totalCollateralBase || '0')
      const totalDebt = BigNumber(totalDebtValue)
      const currentTokenBalance = BigNumber(currentBalance)

      // Get liquidation threshold from user's current liquidation threshold
      const liquidationThreshold = BigNumber(userMarketData?.currentLiquidationThreshold?.value || '0.78')

      // Target health factor (targetHealthFactor for minimal safety buffer, matching AAVE UI closely)
      const targetHealthFactor = BigNumber(TARGET_HEALTH_FACTOR)

      // Calculate minimum collateral needed to maintain health factor
      const minCollateralNeeded = totalDebt
        .multipliedBy(targetHealthFactor)
        .dividedBy(liquidationThreshold)

      // Calculate max withdraw in USD value
      const maxWithdrawUSD = totalCollateral.minus(minCollateralNeeded)

      // Get token price from reserve data
      const tokenPriceUSD = BigNumber(dataReserve?.usdExchangeRate || '1')

      // Convert to token amount
      let maxWithdrawToken = maxWithdrawUSD.dividedBy(tokenPriceUSD)

      // Ensure it doesn't exceed current balance
      if (maxWithdrawToken.isGreaterThan(currentTokenBalance)) {
        maxWithdrawToken = currentTokenBalance
      }
      // Get token decimals
      const tokenDecimals = BigNumber(dataReserve?.underlyingToken?.decimals ?? 18).toNumber()

      // Apply safety margin (100% of calculated max)
      const safeMaxWithdraw = maxWithdrawToken.decimalPlaces(tokenDecimals, BigNumber.ROUND_DOWN)

      // If result is negative or zero, return 0
      if (safeMaxWithdraw.isLessThanOrEqualTo(0)) {
        return '0'
      }
      if (options.delay) {
        await sleep(options.delay)
      }

      return safeMaxWithdraw.toFixed()
    } catch (error) {
      return '0'
    }
  }

  const { enabled, cacheTime } = options
  return useQuery(
    [
      'safeMaxWithdraw',
      userMarketData?.totalDebtBase,
      userMarketData?.totalCollateralBase,
      userMarketData?.healthFactor,
      dataReserve?.usdExchangeRate,
      currentBalance
    ],
    calculateSafeMax,
    {
      enabled: enabled && !!userMarketData && !!dataReserve && !!currentBalance,
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
      refetchOnWindowFocus: true, // Refetch when window regains focus
      retry: 2, // Retry failed requests twice
      ...(cacheTime !== undefined ? { cacheTime } : {})
    }
  )
}

export default useCalculateSafeMaxWithdraw
