
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import { useMemo } from 'react'
import QueryString from 'query-string'
import settings from 'controller/settings'
import { buildPositionKey, useLiquidityPositionData, writeLiquidityPositionData } from 'frontend/Hooks/useLiquidityData'

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
  // Saved result for this position, from Redux — rehydrated before the first render, so
  // reopening a position shows its previous chart immediately instead of an empty one.
  // `owner` is the position's account, which is the address it is stored under.
  const owners = useMemo(() => [owner], [owner])
  const positionKey = buildPositionKey(chainId, tokenId)
  const persisted = useLiquidityPositionData(owners, positionKey, 'history')

  const { data, isLoading } = useQuery(['getHistoryLiquidityPools', poolId, chainId, owner, tokenId], getHistoryLiquidityPool, {
    enabled: !!poolId && !!chainId && !!owner && !!tokenId,
    keepPreviousData: true,
    // The fetcher returns null on a failed/offline request, and the writer ignores null,
    // so a bad response never replaces a good saved chart.
    onSuccess: (value) => writeLiquidityPositionData(owners, positionKey, 'history', value)
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
