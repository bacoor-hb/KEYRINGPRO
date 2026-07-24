import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { erc20Abi } from 'viem'
import ViemWeb3 from 'src/Web3/ViemWeb3'

const DEFAULT_DECIMALS = 18

const getData = async ({ queryKey }) => {
  try {
    const [, chainId, address] = queryKey

    const [decimals] = await ViemWeb3.readMulticall(chainId, [
      {
        abi: erc20Abi,
        address,
        functionName: 'decimals'
      }
    ])

    return decimals?.result ?? DEFAULT_DECIMALS
  } catch (error) {
    return DEFAULT_DECIMALS
  }
}

const useGetDecimalToken = (chainId, addressToken = '', options = {}) => {
  const { data, ...restData } = useQuery(
    [REACT_QUERY_KEY.getDecimalToken, chainId, addressToken],
    getData,
    {
      enabled: !!chainId && addressToken !== 'nodata',
      ...options
    }
  )

  return {
    data: data ?? DEFAULT_DECIMALS,
    ...restData
  }
}

export default useGetDecimalToken
