import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP } from 'common/constants/chain'
import BaseAPI from 'controller/API/BaseAPI'
import { stringify } from 'query-string'
import { useQuery } from 'react-query'
import { isAddress } from 'ethers/lib/utils'
import settings from 'controller/settings'
import usePersistedQueryData from 'frontend/Hooks/usePersistedQueryData'

export const STORAGE_KEY = 'LIST_DATA_LIQUIDITY'
export const QUERY_KEY = 'getListPoolLiquidity'

const getListPoolLiquidity = async ({ queryKey }) => {
  const addressRegisteredLiquidity = queryKey[1]

  const addressRegisteredLiquidityEvm = addressRegisteredLiquidity.filter((item) => isAddress(item))

  const queryEvm = {
    addresses: [...addressRegisteredLiquidityEvm]
  }
  try {
    const baseUrl = settings().server.apiKeyringPool
    const resEvm = await BaseAPI.getData(`${baseUrl}/user/position?` + stringify(queryEvm), null, true)

    if (resEvm?.statusCode === 200) {
      let tempResEvmData = resEvm?.data ?? []
      tempResEvmData = tempResEvmData.filter((lq) => lq.type === 'uniswap')
      tempResEvmData = tempResEvmData.filter((lq) => {
        return !(lq?.token0Price === 0 && lq?.token1Price === 0 && lq?.fiatAmountLiquidity === 0)
      })
      tempResEvmData = tempResEvmData.filter((lq) => {
        return CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP.includes(Number(lq?.chainId?.toString()))
      })

      storeDataToAsyncStorage(STORAGE_KEY, tempResEvmData)
      return tempResEvmData
    } else {
      const cachedData = await getDataFromAsyncStorage(STORAGE_KEY)
      return cachedData || []
    }
  } catch (error) {
    const cachedData = await getDataFromAsyncStorage(STORAGE_KEY)
    return cachedData || []
  }
}

const useGetListPoolLiquidity = (addressRegisteredLiquidity, addressDeletedLiquidity = [], options = {}) => {
  const { enabled = true } = options
  // Last persisted result, hydrated from AsyncStorage on mount. Lets us show the
  // previous data (even after the app was killed) while the network refetches.
  // `hydrated` gates the loader: until the AsyncStorage read settles we don't know
  // whether cached data exists, so we must not flash the loader on cold-start.
  const [persisted, , hydrated] = usePersistedQueryData(STORAGE_KEY)

  // Query only runs when enabled AND there's a registered address to query.
  const isQueryEnabled = enabled && addressRegisteredLiquidity?.length > 0

  const { data, isLoading, isFetching, refetch } = useQuery(
    [QUERY_KEY, addressRegisteredLiquidity],
    getListPoolLiquidity,
    {
      enabled: isQueryEnabled,
      keepPreviousData: true
    }
  )

  // Prefer fresh query data; fall back to the persisted snapshot until it arrives.
  // Hidden pools are filtered out here only when a caller passes addressDeletedLiquidity
  // (legacy screen). The V2 screen passes nothing and derives hidden state in the UI so
  // that toggling Hide/Show re-renders instantly instead of churning this query's data
  // (and the downstream token-detail query that keys off it).
  const source = data ?? persisted
  let dataFinal = source?.length > 0 ? source : []
  if (dataFinal.length > 0 && addressDeletedLiquidity?.length > 0) {
    dataFinal = dataFinal.filter(lq => !addressDeletedLiquidity.includes(lq?._id))
  }

  return {
    // Only "loading" when the query actually runs AND we have nothing to show yet (first
    // ever fetch). When disabled (no registered address), react-query still reports
    // isLoading=true for the idle query — treat that as "not loading" so callers show an
    // empty/zero state instead of a spinner that never resolves.
    // `hydrated`: while the persisted read is still in flight we don't yet know if
    // there's cached data to show, so hold off the loader (avoids the cold-start flash).
    isLoading: isQueryEnabled && isLoading && source == null && hydrated,
    // Background fetch flag (used to drive pull-to-refresh) + manual refetch trigger.
    isFetching,
    refetch,
    data: dataFinal || []
  }
}

export default useGetListPoolLiquidity
