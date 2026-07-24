import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { useQuery } from 'react-query'
import { fetchKeyringTokens } from 'src/Services/TokenListV2'

const getData = async ({ queryKey }) => {
  try {
    const [, chainIds, option = {}] = queryKey

    const funcCall = chainIds.map(async chainId => {
      const contractAddresses = option[chainId]?.contractAddresses || []
      const data = await fetchKeyringTokens(chainId, contractAddresses)
      return data.map(token => ({
        ...token,
        chainId: chainId
      }))
    })
    let data = await Promise.all(funcCall)

    data = data.flat()

    return data
  } catch (error) {
    return []
  }
}

const useGetTokenListHasPrice = (chainIds = [], options = {}) => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getTokenListHasPrice, chainIds, options], getData, {
    enabled: chainIds.length > 0
  })

  return {
    data: data || [],
    ...restData
  }
}

export default useGetTokenListHasPrice
