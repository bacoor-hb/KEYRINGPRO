import BigNumber from 'bignumber.js'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import AllChainServices from 'controller/AllChainServices'
import { useQuery } from 'react-query'

const getData = async ({ queryKey }) => {
  try {
    const [, chainId, extraPercent] = queryKey
    const gasPrice = await AllChainServices.getGasPrice(chainId)
    const result = BigNumber(gasPrice?.toString()).multipliedBy(extraPercent).decimalPlaces(0).toString()
    return result
  } catch (error) {
    return '1'
  }
}

const useGasPrice = (chainId, extraPercent = 1.1) => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getGasPrice, chainId, extraPercent],
    getData,
    {
      enabled: !!chainId
    }
  )

  return {
    data: data || '0',
    ...restData
  }
}

export default useGasPrice
