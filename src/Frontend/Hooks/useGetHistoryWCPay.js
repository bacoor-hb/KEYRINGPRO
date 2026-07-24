import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { KEYSTORE } from 'common/constants/redux'
import { getDataFromAsyncStorage } from 'common/storage/asyncStorage'
import { useQuery } from 'react-query'
import { useSelector } from 'react-redux'

const getData = async ({ queryKey }) => {
  try {
    const [, account] = queryKey
    if (!account) {
      return []
    }
    const dataLocal = await getDataFromAsyncStorage(KEYSTORE.HISTORY_WC_PAY)
    const arr = dataLocal?.[account?.address] || []

    return arr.reverse()
  } catch (error) {
    return []
  }
}

const useGetHistoryWCPay = (indexAccount = 0) => {
  const { blockchainListRedux, accountListRedux } = useSelector(state => state)
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getWCPayHistory, accountListRedux[indexAccount], blockchainListRedux], getData)

  return {
    data: data || [],
    ...restData
  }
}

export default useGetHistoryWCPay
