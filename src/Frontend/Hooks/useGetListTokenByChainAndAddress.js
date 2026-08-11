
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { sleep } from 'common/function'
import { filterTokenToShow } from 'frontend/Screen/TokenList/page'
import { useQuery } from 'react-query'
import { useSelector } from 'react-redux'
import { fetchChainTokens } from 'src/Services/TokenListV2'

const filterListToken = (listToken = []) => {
  return listToken.filter(token => {
    return filterTokenToShow(token)
  })
}

const getData = async ({ queryKey }) => {
  const [, address, chainIds = [], accountTokenListRedux] = queryKey
  const listBalanceUser = accountTokenListRedux[address]?.tokens || []
  try {
    const res = await Promise.all(chainIds.map(async (chainId) => {
      const listTokenInApp = listBalanceUser.filter(token => {
        if (token?.chainId?.toString() === chainId?.toString()) {
          return true
        }
        return false
      })

      if (listTokenInApp?.length > 0) {
        await sleep(500)
        return filterListToken(listTokenInApp, true)
      }

      // fetchChainTokens now rejects when the price list came back incomplete
      // (so a refresh won't mistake unpriced-by-accident for worthless). Here we
      // only need a selectable list, so drop that one chain instead of failing
      // every other chain's result with it.
      let dataAPi = []
      try {
        dataAPi = await fetchChainTokens(chainId, address, true)
      } catch {
        return []
      }

      return filterListToken(dataAPi)
    }))
    return res.flatMap(e => e)
  } catch (error) {
    return {}
  }
}

const useGetListTokenByChainAndAddress = (address, chainIds = []) => {
  const { accountTokenListRedux } = useSelector(s => s)

  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getListTokenByChainAndAddress, address, chainIds, accountTokenListRedux],
    getData,
    {
      enabled: !!address && chainIds?.length > 0
    }

  )

  return {
    data: data || [],
    ...restData
  }
}

export default useGetListTokenByChainAndAddress
