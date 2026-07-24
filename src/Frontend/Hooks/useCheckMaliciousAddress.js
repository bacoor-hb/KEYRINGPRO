import { isAddress } from 'ethers/lib/utils'
import { useQuery } from 'react-query'
import { isArrayWithData } from 'common/function'

function hasMoreThanOneValueOne (obj) {
  let count = 0
  for (const key in obj) {
    if (obj[key] === '1') {
      count++
    }
    if (count >= 1) {
      return true
    }
  }
  return false
}

export const getCheckMaliciousAddress = async ({ queryKey }) => {
  const listAddressForCheckMalicious = isArrayWithData(queryKey[1], false) ? queryKey[1] : [queryKey[1]]
  const chainId = queryKey[2]

  try {
    const fetchData = async (address, chainId) => {
      const options = { method: 'GET', headers: { accept: '*/*' } }
      const responseRaw = await fetch(`https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${chainId}`, options)
      const response = await responseRaw.json()
      const result = response?.result || {}
      delete result.contract_address
      delete result.data_source
      return result
    }

    const resultList = await Promise.all(listAddressForCheckMalicious.map((address) => fetchData(address, chainId)))
    return resultList.some((result) => hasMoreThanOneValueOne(result))
  } catch (error) {
    return false
  }
}

/**
 *
 * @param {mixed} address string | array
 * @param {*} chainId
 * @param {*} options
 * @returns
 */
const useCheckMaliciousAddress = (address, chainId, options = {}) => {
  const { queryKey = 'checkMaliciousAddress' } = options

  const listAddressForCheckMalicious = isArrayWithData(address, false) ? address : [address]

  const isValidAddress = (listAddressForCheckMalicious ?? []).every((addr) => isAddress(addr))

  const { data, isLoading, refetch, isFetching } = useQuery(
    [queryKey, address, chainId],
    getCheckMaliciousAddress,
    {
      enabled: isValidAddress && !!chainId
    }
  )

  return {
    isLoading,
    isFetching,
    data: data,
    refetch
  }
}

export default useCheckMaliciousAddress
