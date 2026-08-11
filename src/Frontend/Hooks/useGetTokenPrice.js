import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { isNativeToken } from 'common/tokens'
import { isAddress, zeroAddress } from 'viem'
import { lowerCase, sanitizeUrl } from 'common/function'
import { NATIVE_TOKEN_BY_CHAIN_ID } from 'common/constants/app'
import { resolveKeyringTokenPriceUSD } from 'src/Services/TokenListV2'
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

    const res = await fetch(sanitizeUrl(url))

    const data = await res.json()

    const result = data.result || {}
    const arr = Object.values(result)
    const tokenInfo = arr.find(e => {
      return lowerCase(e?.address || zeroAddress) === lowerCase(textSearch)
    })
    if (!tokenInfo) return null

    // Not `tokenInfo.price` directly: for a share-based yield vault that field is
    // the UNDERLYING asset's price, not the price of one share the user holds —
    // the token list already converts it on-chain, so a raw price here would make
    // every screen using this hook disagree with the list. resolveKeyringTokenPriceUSD
    // returns the per-SHARE price for those (and the API price unchanged, with no
    // RPC, for every other token).
    const priceUSD = await resolveKeyringTokenPriceUSD(chainId, tokenInfo)
    return priceUSD
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
