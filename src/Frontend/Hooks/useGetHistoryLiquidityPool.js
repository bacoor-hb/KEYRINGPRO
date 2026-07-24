
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import QueryString from 'query-string'
import settings from 'controller/settings'
import usePersistedQueryData from 'frontend/Hooks/usePersistedQueryData'

const getHistoryLiquidityPool = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_, poolId, chainId, owner, tokenId] = queryKey

  const query = {
    owner,
    id: poolId,
    chainId,
    tokenId
  }

  const baseUrl = settings().server.apiKeyringPool

  const res = await BaseAPI.getData(`${baseUrl}/user/position-chart?${QueryString.stringify(query)}`, null, true)
  // Offline / failed requests resolve to null (postGateWay swallows the error), so
  // never dereference res.data directly — that crashes the app when the network is off.
  // Return null (NOT {}) so the hook's `data ?? persisted` falls back to the last good
  // snapshot instead of clobbering it with an empty object (which would also let the
  // onSuccess persist overwrite the good cache with {}).
  if (!res?.data) return null
  return {
    ...res.data,
    items: res.data.items?.reverse() ?? []
  }
}

const useGetHistoryLiquidityPool = (poolId, chainId, owner, tokenId) => {
  // Per-pool persisted snapshot — show the last result (even after app restart)
  // while the network refetches.
  const [persisted, persist] = usePersistedQueryData(`HISTORY_LIQUIDITY_POOL_${chainId}_${poolId}_${tokenId}`)

  const { data, isLoading } = useQuery(['getHistoryLiquidityPools', poolId, chainId, owner, tokenId], getHistoryLiquidityPool, {
    enabled: !!poolId && !!chainId && !!owner && !!tokenId,
    keepPreviousData: true,
    onSuccess: persist
  })

  const source = data ?? persisted

  let arrLiquidity = []
  if (source) {
    arrLiquidity = source?.items?.length > 0 && source?.items?.map((item) => {
      return Number(item?.fiatAmountLiquidity?.toFixed(4))
    })
  }

  return {
    isLoading: isLoading && source == null,
    data: arrLiquidity || [],
    rawData: source ?? {}

  }
}

export default useGetHistoryLiquidityPool
