import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { zeroAddress } from 'viem'
import { isNativeToken } from 'common/tokens'
import Config from 'react-native-config'
const getData = async ({ queryKey }) => {
  try {
    let [, chainId, textSearch] = queryKey

    if (isNativeToken(textSearch)) {
      textSearch = zeroAddress
    }
    const baseUrl = `${Config.KEYRING_API}/token-list/all`

    let url = `${baseUrl}?chainId=${chainId}`
    if (textSearch) {
      url += `&key=${textSearch}`
    }

    const res = await fetch(url)

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

const useGetTokenSearchByChain = (chainId, textSearch = '') => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getTokenSearchByChain, chainId, textSearch],
    getData,
    {
      enabled: !!textSearch
    }
  )

  return {
    data,
    ...restData
  }
}

export default useGetTokenSearchByChain
