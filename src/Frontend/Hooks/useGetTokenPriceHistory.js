import { useQuery } from 'react-query'
import Config from 'react-native-config'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import BaseAPI from 'controller/API/BaseAPI'
import ReduxService from 'common/redux'

const PRICE_HISTORY_ENDPOINT = `${Config.MINNADEFI_API}/coin/prices-history-app`

const getData = async ({ queryKey }) => {
  const [, coinGeckoId, days] = queryKey
  const res = await BaseAPI.getData(`${PRICE_HISTORY_ENDPOINT}?cgId=${coinGeckoId}&days=${days}`, null, true)
  if (res?.statusCode === 200 && Array.isArray(res.data)) {
    return res.data.map((d) => Number(d?.priceUSD)).filter(Number.isFinite)
  }
  return []
}

// Real price history (USD series) for a coin, keyed by coinGeckoId. Days come
// from app settings (fallback 7). Only fires once a coinGeckoId is available.
const useGetTokenPriceHistory = (coinGeckoId) => {
  const days = ReduxService.getAppSettingByKey?.('DAYS_PRICES_HISTORY_CHART') || 7
  const { data, ...restData } = useQuery(
    [REACT_QUERY_KEY.getTokenPriceHistory, coinGeckoId, days],
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

export default useGetTokenPriceHistory
