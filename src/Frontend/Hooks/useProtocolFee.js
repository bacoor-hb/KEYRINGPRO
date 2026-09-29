import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { useQuery } from 'react-query'
import { CONTRACT_FEE_PROTOCOL } from 'common/constants/swap'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { convertWeiToBalance } from 'common/function'

const getData = async ({ queryKey }) => {
  try {
    const [, chainIdIn, chainIdOut, bridgeProvider] = queryKey
    const isCrossChain = chainIdIn?.toString() !== chainIdOut?.toString()
    const contractAddress = CONTRACT_FEE_PROTOCOL?.[bridgeProvider]?.[chainIdIn] || CONTRACT_FEE_PROTOCOL?.[bridgeProvider]?.DEFAULT

    if (isCrossChain && contractAddress) {
      const minABI = [
        {
          inputs: [],
          name: 'globalFixedNativeFee',
          outputs: [
            {
              internalType: 'uint256',
              name: '',
              type: 'uint256'
            }
          ],
          stateMutability: 'view',
          type: 'function'
        }
      ]

      const gasProtocolNative = await ViemWeb3.readContract(chainIdIn, {
        address: contractAddress,
        abi: minABI,
        functionName: 'globalFixedNativeFee'
      })

      return convertWeiToBalance(gasProtocolNative.toString())
    }
    return '0'
  } catch (error) {
    return '0'
  }
}

const useProtocolFee = (chainIdIn, chainIdOut, bridgeProvider) => {
  const { data, ...restData } = useQuery(
    [REACT_QUERY_KEY.getProtocolFee, chainIdIn, chainIdOut, bridgeProvider],
    getData,
    {
      enabled: !!bridgeProvider
    }
  )

  return {
    data: data || '0',
    ...restData
  }
}

export default useProtocolFee
