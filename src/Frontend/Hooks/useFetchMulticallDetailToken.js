
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import usePersistedQueryData from 'frontend/Hooks/usePersistedQueryData'
import { resolveOnchainSymbols } from 'src/Services/TokenListV2/symbolOnchain'

export const STORAGE_KEY = 'LIST_DATA_TOKEN_LIQUIDITY_DETAIL'
export const QUERY_KEY = 'getDataMuticall'

// Fetch token details for a batch of addresses on the same chain (one API call)
const getDataTokenDetailByChain = async (chainId, addresses) => {
  if (!addresses?.length) return []
  const res = await BaseAPI.getData(`keyrings/tokens/all/${Number(chainId?.toString())}?addresses=${addresses.join(',')}`)
  const items = res?.items ?? []

  // These rows feed the LP pair label ("WETH/USDC"), which reads `symbolOnchain`
  // first (see PoolList). Fill that field in for the rows the API didn't answer
  // for, so the label shows the contract's own ticker either way. `symbol` and
  // `auditGoplus` come back exactly as the API returned them.
  //
  // Rows key the address as `address`; the resolver reads `contractAddress`, so
  // it's mapped in and dropped again to keep this flow's row shape.
  const resolved = await resolveOnchainSymbols(
    chainId,
    items.map((token) => ({ ...token, contractAddress: token?.address })),
    { keepSymbol: true }
  )
  return resolved.map(({ contractAddress, ...token }) => token)
}

const getDataMuticall = async ({ queryKey }) => {
  const listLiquidityPool = queryKey[1]

  // Group unique token addresses by chainId so each chain needs only one request
  const addressesByChain = {}
  listLiquidityPool.forEach((item) => {
    const chainId = item?.chainId
    if (chainId == null) return
    const set = addressesByChain[chainId] || (addressesByChain[chainId] = new Set())
    const token0 = item?.token0?.address
    const token1 = item?.token1?.address
    if (token0) set.add(token0)
    if (token1) set.add(token1)
  })

  const listPromise = Object.entries(addressesByChain).map(([chainId, set]) =>
    getDataTokenDetailByChain(chainId, [...set])
  )

  try {
    const result = await Promise.all(listPromise)

    const mergeResult = result.flatMap((item) => item).filter((item) => item !== null)

    if (mergeResult?.length > 0) {
      storeDataToAsyncStorage(STORAGE_KEY, mergeResult ?? [])
      return mergeResult
    } else {
      const cache = await getDataFromAsyncStorage(STORAGE_KEY)
      return cache || []
    }
  } catch (error) {
    const cache = await getDataFromAsyncStorage(STORAGE_KEY)
    return cache || []
  }
}

const useFetchMulticallDetailToken = (listLiquidityPool) => {
  // Last persisted result, hydrated from AsyncStorage on mount. `hydrated` gates the
  // loader so we don't flash it on cold-start before the persisted read settles.
  const [persisted, , hydrated] = usePersistedQueryData(STORAGE_KEY)

  const { data, isLoading } = useQuery(
    [QUERY_KEY, listLiquidityPool],
    getDataMuticall,
    {
      enabled: listLiquidityPool?.length > 0,
      staleTime: 10 * 60 * 1000, // 10 minutes
      keepPreviousData: true
    }

  )

  const source = data ?? persisted

  return {
    isLoading: isLoading && source == null && hydrated,
    data: source || []
  }
}

export default useFetchMulticallDetailToken
