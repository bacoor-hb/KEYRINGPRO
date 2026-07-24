import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { useQuery } from 'react-query'
import ViemWeb3 from 'src/Web3/ViemWeb3'

const getData = async ({ queryKey }) => {
  try {
    const [, chainId, addressUser, addressToken] = queryKey

    const balance = await ViemWeb3.getBalanceToken(chainId, addressUser, addressToken)
    return balance
  } catch (error) {
    return '0'
  }
}

const useGetBalanceToken = (chainId, addressUser, addressToken) => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getBalanceToken, chainId, addressUser, addressToken],
    getData,
    {
      enabled: !!chainId && !!addressToken
    }
  )

  return {
    data: data || '0',
    ...restData
  }
}

export default useGetBalanceToken
