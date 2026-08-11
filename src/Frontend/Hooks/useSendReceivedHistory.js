import { ALCHEMY_ENDPOINT } from 'common/constants/alchemy'
import { KEYSTORE } from 'common/constants/redux'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import ReduxService from 'common/redux'
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import AlchemyApi from 'frontend/Services/alchemy'
import { useQuery } from 'react-query'
import { useSelector } from 'react-redux'
import ViemWeb3 from 'src/Web3/ViemWeb3'

const getBlockTimestamp = async (item) => {
  try {
    if (!item?.blockNum) {
      return null
    }
    const client = ViemWeb3.getPublicClient(item.chainId)
    const block = await client.getBlock({ blockNumber: BigInt(item.blockNum) })
    return new Date(Number(block.timestamp) * 1000).toISOString()
  } catch (error) {
    return null
  }
}

const getData = async ({ queryKey }) => {
  try {
    const [, activeAccount, chainId, isSendData] = queryKey
    const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')

    const chain = blockchainListRedux?.[chainId]
    const { account } = activeAccount
    if (!account || !chain) {
      return []
    }

    if (!ALCHEMY_ENDPOINT[chain.chainId]) {
      return []
    }

    let data = await AlchemyApi.getHistoryTransferByAddress(chain.chainId, account.address, isSendData)
    data = data.map(e => {
      return {
        ...e,
        chainId: chain.chainId,
        iconChain: chain.icon,
        nameChain: chain.name
      }
    })

    // Per (account, chain, direction) namespace so switching chain/account never pollutes others
    const cacheContextKey = `${account.address}_${chainId}_${isSendData ? 'send' : 'received'}`
    let dataLocal = await getDataFromAsyncStorage(KEYSTORE.SEND_RECEIVED_HISTORY_BLOCK_TIMESTAMP, {})

    // init dataLocal
    if (!dataLocal) {
      dataLocal = {}
    }

    const cache = dataLocal[cacheContextKey] || {}

    const hashesInData = new Set(data.map(item => item.hash))

    // Prune: drop cached hashes no longer present in the AlchemyApi result to keep storage lean
    const cacheFiltered = {}
    Object.keys(cache).forEach(hash => {
      if (hashesInData.has(hash)) {
        cacheFiltered[hash] = cache[hash]
      }
    })

    data = await Promise.all(data.map(async item => {
      if (item.metadata?.blockTimestamp) {
        return item
      }
      // Reuse cached timestamp when possible; blockTimestamp is immutable, so fetch via RPC only once
      let blockTimestamp = cacheFiltered[item.hash]
      if (!blockTimestamp) {
        blockTimestamp = await getBlockTimestamp(item)
        if (blockTimestamp) {
          cacheFiltered[item.hash] = blockTimestamp
        }
      }
      if (!blockTimestamp) {
        return item
      }
      return {
        ...item,
        metadata: {
          ...item.metadata,
          blockTimestamp
        }
      }
    }))

    if (Object.keys(cache).length > 0 || Object.keys(cacheFiltered).length > 0) {
      dataLocal[cacheContextKey] = cacheFiltered
      await storeDataToAsyncStorage(KEYSTORE.SEND_RECEIVED_HISTORY_BLOCK_TIMESTAMP, dataLocal)
    }

    return data
  } catch (error) {
    return []
  }
}

const useSendReceivedHistory = (chainId, isSendData) => {
  const { activeAccount, blockchainListRedux } = useSelector(state => state)
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getSendReceivedHistory, activeAccount, chainId, isSendData], getData, {
    enabled: !!activeAccount?.account?.address && !!chainId && !!blockchainListRedux?.[chainId]
  })

  return {
    data: data || [],
    ...restData
  }
}

export default useSendReceivedHistory
