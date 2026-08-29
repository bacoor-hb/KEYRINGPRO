import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { zeroAddress } from 'viem'
import { isNativeToken } from 'common/tokens'
import Config from 'react-native-config'
import { sanitizeUrl } from 'common/function'
import { resolveKeyringTokenPriceUSD } from 'src/Services/TokenListV2'
const getData = async ({ queryKey }) => {
  try {
    let [, chainId, optionSearch] = queryKey

    if (typeof optionSearch === 'string' && isNativeToken(optionSearch)) {
      optionSearch = zeroAddress
    }
    const baseUrl = `${Config.KEYRING_API}/token-list/all`

    let url = `${baseUrl}?chainId=${chainId}`
    if (typeof optionSearch === 'object' && optionSearch !== null) {
      Object.entries(optionSearch).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (isNativeToken(value)) {
            url += `&${encodeURIComponent(key)}=${zeroAddress}`
          } else {
            url += `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
          }
        }
      })
    } else if (optionSearch) {
      url += `&key=${optionSearch}`
    }

    const res = await fetch(sanitizeUrl(url))

    const data = await res.json()

    const result = data.result || {}
    let arr = Object.values(result)

    arr = Array.from(
      new Map(arr.map(item => [item.address, item])).values()
    )

    // Not the raw `token.price` directly: for a share-based yield vault (tagged
    // with yieldProtocol/yieldAsset) that field is the UNDERLYING asset's price,
    // not the price of one share the user holds. resolveKeyringTokenPriceUSD
    // returns the per-SHARE price for those (and the API price unchanged, with no
    // RPC, for every other token) — matching useGetTokenPrice so the search list
    // and the rest of the app never disagree. Tokens with no usable price (invalid
    // API price, or a vault whose on-chain read failed) are dropped.
    arr = await Promise.all(
      arr.map(async token => {
        try {
          const price = await resolveKeyringTokenPriceUSD(chainId, token)
          if (!price || price <= 0) return null
          return { ...token, price, priceUSD: price }
        } catch {
          return null
        }
      })
    )
    arr = arr.filter(Boolean)

    return arr || []
  } catch (error) {
    return []
  }
}

const useGetTokenSearchByChain = (chainId, optionSearch = '') => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getTokenSearchByChain, chainId, optionSearch],
    getData,
    {
      enabled: !!optionSearch
    }
  )

  return {
    data,
    ...restData
  }
}

export default useGetTokenSearchByChain
