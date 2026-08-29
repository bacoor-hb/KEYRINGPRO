import BaseAPI from 'controller/API/BaseAPI'
import settings from 'controller/settings'
import { useQuery } from 'react-query'
import { useLiquidityData, writeLiquidityData } from 'frontend/Hooks/useLiquidityData'

export const QUERY_KEY = 'CheckAddressCoinPool'

export const formatApiPathForGetPoolByChain = () => 'user'

export const getCheckAddressCoinPool = async ({ queryKey }) => {
  const listAddress = queryKey[1]
  const baseUrl = settings().server.apiCoinPool
  if (!baseUrl) {
    return {
      dataListAddressChecked: [],
      isExistAddressCoinPool: false
    }
  }

  const res = await Promise.all(listAddress.map(async (address) => {
    const data = await BaseAPI.getData(`${baseUrl}/${formatApiPathForGetPoolByChain(address)}/exist/${address}`, null, true)
    return {
      address: address?.toLowerCase(),
      // BaseAPI swallows network/timeout errors and resolves to null instead of
      // throwing. Treat a null response as "request failed" so we don't overwrite
      // a good result with isExist:false when offline.
      failed: data == null,
      isExist: data?.exist ?? false
    }
  }))

  // If any address failed to fetch (offline / timeout), throw rather than save: the
  // fresh result is incomplete and would clobber the saved "isExist:true" flags. The
  // Redux copy stays as it was, so pools remain flagged as in-coinpool.
  if (res.some(item => item.failed)) throw new Error('Coin-pool check incomplete')

  const dataListAddressChecked = res.map(({ address, isExist }) => ({ address, isExist }))
  const result = {
    dataListAddressChecked,
    isExistAddressCoinPool: dataListAddressChecked.some(item => item.isExist)
  }
  writeLiquidityData(listAddress, 'coinPool', result)
  return result
}

const useCheckAddressCoinPool = (listAddress) => {
  // Last saved result for THIS address, from Redux — in hand on the first render.
  const persisted = useLiquidityData(listAddress, 'coinPool')

  // No address means nothing to check — the query stays idle, and react-query reports
  // isLoading=true forever for an idle query, so this must gate the flag below.
  const isQueryEnabled = listAddress?.length > 0

  const { data, isLoading, refetch } = useQuery(
    [QUERY_KEY, listAddress],
    getCheckAddressCoinPool,
    {
      enabled: isQueryEnabled,
      // See useGetListPoolLiquidity: the Redux copy is per-address and covers this.
      keepPreviousData: false
    }
  )

  const source = data ?? persisted

  return {
    // Same shape as the other two liquidity hooks: loading only when nothing is saved
    // and nothing has been fetched yet.
    isLoading: isQueryEnabled && isLoading && source == null,
    refetch,
    data: source
  }
}

export default useCheckAddressCoinPool
