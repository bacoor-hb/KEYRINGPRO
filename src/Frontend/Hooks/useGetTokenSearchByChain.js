import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { zeroAddress } from 'viem'
import { isNativeToken } from 'common/tokens'
import Config from 'react-native-config'
import { sanitizeUrl } from 'common/function'
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

    arr = arr.filter(token => {
      try {
        const price = Number(token.price || '0')

        if (isNaN(price) || !price || price === 0) {
          return false
        }

        return true
      } catch (error) {
        return false
      }
    })

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
