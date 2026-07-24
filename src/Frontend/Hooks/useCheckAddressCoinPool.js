import BaseAPI from 'controller/API/BaseAPI'
import settings from 'controller/settings'
import { useQuery } from 'react-query'
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import usePersistedQueryData from 'frontend/Hooks/usePersistedQueryData'

export const STORAGE_KEY = 'CHECK_ADDRESS_COIN_POOL'
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

  try {
    const res = await Promise.all(listAddress.map(async (address) => {
      const data = await BaseAPI.getData(`${baseUrl}/${formatApiPathForGetPoolByChain(address)}/exist/${address}`, null, true)
      return {
        address: address?.toLowerCase(),
        // BaseAPI swallows network/timeout errors and resolves to null instead of
        // throwing. Treat a null response as "request failed" so we don't overwrite
        // a good cache with isExist:false when offline.
        failed: data == null,
        isExist: data?.exist ?? false
      }
    }))

    // If any address failed to fetch (offline / timeout), don't persist — the fresh
    // result is incomplete and would clobber the cached "isExist:true" flags. Fall
    // back to the last good cache instead so pools stay flagged as in-coinpool.
    if (res.some(item => item.failed)) {
      const cache = await getDataFromAsyncStorage(STORAGE_KEY)
      return cache || {
        dataListAddressChecked: [],
        isExistAddressCoinPool: false
      }
    }

    const dataListAddressChecked = res.map(({ address, isExist }) => ({ address, isExist }))
    const result = {
      dataListAddressChecked,
      isExistAddressCoinPool: dataListAddressChecked.some(item => item.isExist)
    }
    storeDataToAsyncStorage(STORAGE_KEY, result)
    return result
  } catch (error) {
    const cache = await getDataFromAsyncStorage(STORAGE_KEY)
    return cache || {
      dataListAddressChecked: [],
      isExistAddressCoinPool: false
    }
  }
}

const useCheckAddressCoinPool = (listAddress) => {
  // Last persisted result, hydrated from AsyncStorage on mount. `hydrated` gates the
  // loader so we don't flash it on cold-start before the persisted read settles.
  const [persisted, , hydrated] = usePersistedQueryData(STORAGE_KEY)

  const { data, isLoading, refetch } = useQuery(
    [QUERY_KEY, listAddress],
    getCheckAddressCoinPool,
    {
      enabled: listAddress?.length > 0,
      keepPreviousData: true
    }
  )

  const source = data ?? persisted

  return {
    isLoading: isLoading && source == null && hydrated,
    refetch,
    data: source
  }
}

export default useCheckAddressCoinPool
