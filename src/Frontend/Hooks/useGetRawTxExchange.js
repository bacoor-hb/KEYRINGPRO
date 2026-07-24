import { BRIDGE_SLIPAGE } from 'common/constants/app'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { useQuery } from 'react-query'
import { SwapServiceFactory } from 'src/Services/SwapServices'

const getData = async ({ queryKey }) => {
  try {
    const [, filterData] = queryKey
    // Use SwapServiceFactory to get the active service based on chainId
    const isCrossChain = filterData?.srcChainId !== filterData?.dstChainId
    const swapService = await SwapServiceFactory.getService(filterData.srcChainId, filterData.dstChainId)

    // Default slippage is BRIDGE_SLIPAGE (1); use the user's pick when provided.
    // No cross-chain vs same-chain distinction.
    const slippage = filterData?.slippage ?? BRIDGE_SLIPAGE

    const quoteParams = {
      srcChainId: filterData.srcChainId,
      srcTokenAddress: filterData.srcTokenAddress,
      srcTokenAmount: filterData.srcTokenAmount,
      dstChainId: isCrossChain ? filterData.dstChainId : filterData.srcChainId,
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
    return []
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
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getRawTxExchange, filterData],
    getData,
    {
      enabled: !!filterData && !freeze,
      // Quotes go stale fast (price/liquidity move), so re-fetch every 10s while the
      // query is enabled. Only polls in the foreground (not when the app is backgrounded).
      // Once frozen (approve/execute started), stop polling and refetching entirely so the
      // quote the user is committing to stays fixed.
      refetchInterval: freeze ? false : 10000,
      refetchOnWindowFocus: !freeze,
      refetchOnReconnect: !freeze
    }
  )

  return {
    data: data ?? null,
    ...restData
  }
}

export default useGetRawTxExchange
