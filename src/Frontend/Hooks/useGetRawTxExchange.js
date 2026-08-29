import { BRIDGE_SLIPAGE } from 'common/constants/app'
import { PLATFORM_EXCHANGE } from 'common/constants/swap'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { useQuery } from 'react-query'
import { SwapServiceFactory } from 'src/Services/SwapServices'
import useGetSettingExchange from './useGetSettingExchange'
import { useCallback, useMemo } from 'react'

const getData = async ({ queryKey }) => {
  try {
    const [, filterData, bridgeProvider, chainSupport] = queryKey
    // Use SwapServiceFactory to get the active service based on chainId
    const isCrossChain = filterData?.srcChainId?.toString() !== filterData?.dstChainId?.toString()
    const swapService = await SwapServiceFactory.getService(bridgeProvider)

    // Default slippage is BRIDGE_SLIPAGE (1); use the user's pick when provided.
    // No cross-chain vs same-chain distinction.
    const slippage = filterData?.slippage ?? BRIDGE_SLIPAGE

    // deBridge exposes a synthetic chainId for some networks (e.g. Story 100000013 instead of 1514).
    // The app works with real chainIds, so convert a real chainId back to the deBridge one before
    // calling the deBridge API. Falls back to the given chainId when no mapping is found.
    const toDeBridgeChainId = (chainId) => {
      const chain = (chainSupport || []).find(c => c?.chainId?.toString() === chainId?.toString())

      // iterate over all deBridge
      Object.values(PLATFORM_EXCHANGE).forEach(platform => {
        const chainIdPlatform = chain?.[`chainId_${platform}`]

        if (bridgeProvider === platform && chainIdPlatform) {
          chainId = chainIdPlatform
        }
      })

      return chainId
    }

    const quoteParams = {
      srcChainId: toDeBridgeChainId(filterData.srcChainId),
      srcTokenAddress: filterData.srcTokenAddress,
      srcTokenAmount: filterData.srcTokenAmount,
      dstChainId: toDeBridgeChainId(isCrossChain ? filterData.dstChainId : filterData.srcChainId),
      dstTokenAddress: filterData.dstTokenAddress,
      recipientAddress: filterData.recipientAddress,
      senderAddress: filterData.senderAddress,
      slippage,
      isCrossChain,
      userAddress: filterData.recipientAddress || filterData.senderAddress
    }
    if (filterData?.tradeType) {
      quoteParams.tradeType = filterData.tradeType
    }

    const result = await swapService.getQuote(quoteParams)

    if (!result.success) {
      return result.error ? { error: result.error, errorMessage: result.errorMessage } : null
    }

    // Return in the expected format for backward compatibility
    return result
  } catch (error) {
    return {
      success: false,
      error,
      errorMessage: error.message || 'Failed to fetch quote'
    }
  }
}

/**
 * @param {object} filterData - Filter parameters for data fetching
 * @param {number} filterData.srcChainId - The source chain ID
 * @param {string} filterData.srcTokenAddress - The source token address (native or token)
 * @param {string} filterData.srcTokenAmount - The amount of source token to swap
 * @param {number} filterData.dstChainId - The destination chain ID
 * @param {string} filterData.dstTokenAddress - The destination token address
 * @param {string} filterData.recipientAddress - The recipient address for the destination token
 * @param {string} filterData.senderAddress - The sender address
 * @param {number} filterData.slippage - The slippage tolerance percentage
 * @param {object} [options] - Extra options
 * @param {boolean} [options.freeze] - When true, stop re-fetching the quote (used once the
 *   user has tapped Approve/Execute so the in-flight tx isn't swapped out from under them).
 */

const useGetRawTxExchange = (filterData, options = {}) => {
  const { freeze = false } = options
  const { data: setting } = useGetSettingExchange()

  const bridgeProvider = useMemo(() => {
    const bridgeProviderCurrent = setting?.bridgeProvider

    if (setting && filterData) {
      const requireChainDeBridge = (setting?.[PLATFORM_EXCHANGE.deBridge]?.requireChain || []).map(e => e.toString())
      const chainIn = setting.chainSupport.find(c => c.chainId?.toString() === filterData?.srcChainId?.toString())
      const chainOut = setting.chainSupport.find(c => c.chainId?.toString() === filterData?.dstChainId?.toString())

      const isRequiredDeBridge = requireChainDeBridge.includes(chainIn?.chainId?.toString()) ||
        requireChainDeBridge.includes(chainOut?.chainId?.toString())

      const isSupportDeBridge = chainIn?.bridgeProvider?.includes(PLATFORM_EXCHANGE.deBridge) &&
        chainOut?.bridgeProvider?.includes(PLATFORM_EXCHANGE.deBridge)

      if (isRequiredDeBridge && isSupportDeBridge) {
        return PLATFORM_EXCHANGE.deBridge
      }

      return bridgeProviderCurrent
    }
  }, [setting, filterData])

  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getRawTxExchange, filterData, bridgeProvider, setting?.chainSupport],
    getData,
    {
      enabled: !!filterData && !freeze && !!bridgeProvider,
      // Quotes go stale fast (price/liquidity move), so re-fetch every 10s while the
      // query is enabled. Only polls in the foreground (not when the app is backgrounded).
      // Once frozen (approve/execute started), stop polling and refetching entirely so the
      // quote the user is committing to stays fixed.
      refetchInterval: freeze ? false : 10000,
      refetchOnWindowFocus: !freeze,
      refetchOnReconnect: !freeze
    }
  )

  const getBridgeProvider = useCallback((chainIdIn, chainIdOut) => {
    const requireChainDeBridge = (setting?.[PLATFORM_EXCHANGE.deBridge]?.requireChain || []).map(e => e?.toString())
    const chainIn = setting?.chainSupport.find(c => c.chainId?.toString() === chainIdIn?.toString())
    const chainOut = setting?.chainSupport.find(c => c.chainId?.toString() === chainIdOut?.toString())

    if (chainIn && chainOut) {
      const isSupportDeBridge = chainIn?.bridgeProvider?.includes(PLATFORM_EXCHANGE.deBridge) &&
      chainOut?.bridgeProvider?.includes(PLATFORM_EXCHANGE.deBridge)

      const isRequiredDeBridge = requireChainDeBridge.includes(chainIn?.chainId?.toString()) ||
        requireChainDeBridge.includes(chainOut?.chainId?.toString())

      if (isRequiredDeBridge && isSupportDeBridge) {
        return PLATFORM_EXCHANGE.deBridge
      }
    }

    return setting?.bridgeProvider
  }, [setting])

  return {
    data: data ?? null,
    bridgeProvider,
    getBridgeProvider,
    ...restData
  }
}

export default useGetRawTxExchange
