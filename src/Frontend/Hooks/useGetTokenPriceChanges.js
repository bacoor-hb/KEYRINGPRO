import { useQuery } from 'react-query'
import Config from 'react-native-config'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import BaseAPI from 'controller/API/BaseAPI'

const PRICE_CHANGE_ENDPOINT = `${Config.MINNADEFI_API}/coin/prices-history-change`

const getData = async ({ queryKey }) => {
  const [, coinGeckoId] = queryKey
  const res = await BaseAPI.getData(`${PRICE_CHANGE_ENDPOINT}?cgId=${coinGeckoId}`, null, true)
  if (res?.statusCode === 200 && Array.isArray(res.data)) return res.data
  return []
}

// Multi-timeframe price changes (1h/24h/7d/14d/30d/1y) for a coin, keyed by
// coinGeckoId. Only fires once a coinGeckoId is available.
const useGetTokenPriceChanges = (coinGeckoId) => {
  const { data, ...restData } = useQuery(
    [REACT_QUERY_KEY.getTokenPriceChanges, coinGeckoId],
    getData,
    {
      enabled: !!coinGeckoId
    }
  )

  return {
    data: data || [],
    ...restData
  }
}

export default useGetTokenPriceChanges
