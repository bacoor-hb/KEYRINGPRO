import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { isNativeToken } from 'common/tokens'
import { isAddress, zeroAddress } from 'viem'
import { lowerCase } from 'common/function'
import { NATIVE_TOKEN_BY_CHAIN_ID } from 'common/constants/app'
import Config from 'react-native-config'

const getData = async ({ queryKey }) => {
  try {
    let [, chainId, textSearch] = queryKey

    if (isNativeToken(textSearch) || (chainId && NATIVE_TOKEN_BY_CHAIN_ID[chainId] && NATIVE_TOKEN_BY_CHAIN_ID[chainId] === lowerCase(textSearch || zeroAddress))) {
      textSearch = zeroAddress
    }
    const baseUrl = `${Config.KEYRING_API}/token-list/all`

    let url = `${baseUrl}?chainId=${chainId}`
    if (isAddress(textSearch)) {
      url += `&address=${textSearch}`
    } else {
      if (textSearch) {
        url += `&key=${textSearch}`
      }
    }

    const res = await fetch(url)

    const data = await res.json()

    const result = data.result || {}
    const arr = Object.values(result)
    const tokenInfo = arr.find(e => {
      return lowerCase(e?.address || zeroAddress) === lowerCase(textSearch)
    })

    return tokenInfo?.price || null
  } catch (error) {
    return null
  }
}

const useGetTokenPrice = (chainId, textSearch = '', options = {}) => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getTokenPrice, chainId, textSearch],
    getData,
    {
      enabled: !!textSearch && !!chainId,
      ...options
    }
  )

  return {
    data: data,
    ...restData
  }
}

export default useGetTokenPrice
