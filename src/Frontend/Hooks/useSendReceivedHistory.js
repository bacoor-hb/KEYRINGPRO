import { SUPPORTED_CHAINS_BY_SERVICE_MORALIS } from 'common/constants/chain'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { useMemo } from 'react'
import { useQuery } from 'react-query'
import { useSelector } from 'react-redux'
import MoralisService from 'src/Services/Moralis'

const getData = async ({ queryKey }) => {
  try {
    const [, activeAccount, chain] = queryKey
    const { account } = activeAccount
    if (!account) {
      return []
    }
    // let data = []
    // const arrChainSupport = Object.values(blockchainListRedux).filter(chain => SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chain.chainId])

    // if (arrChainSupport.length === 0) {
    //   return []
    // }
    if (!SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chain.chainId]) {
      return []
    }

    // const funcCall = arrChainSupport.map(async chain => {
    //   const chainMoralis = SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chain.chainId]
    //   let data = await MoralisService.getHistoryByAddress(account.address, chainMoralis)
    //   data = data.filter(history => {
    //     if (
    //       history?.category === 'receive' ||
    //       history?.category === 'send' ||
    //       history?.category === 'token send' ||
    //       history?.category === 'token receive'
    //     ) {
    //       if (
    //         history?.erc20_transfers?.length > 0 ||
    //         history?.native_transfers?.length > 0
    //       ) {
    //         return true
    //       }
    //     }
    //     return false
    //   })

    //   return data.map(e => {
    //     return {
    //       ...e,
    //       chainId: chain.chainId,
    //       iconChain: chain.icon,
    //       nameChain: chain.name
    //     }
    //   })
    // })

    // data = await Promise.all(funcCall)

    // data = data.filter(e => e.length > 0)
    // data = data.flat()

    const chainMoralis = SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chain.chainId]
    let data = await MoralisService.getHistoryByAddress(account.address, chainMoralis, {
      limit: 50
    })

    data = data.filter(history => {
      if (
        history?.category === 'receive' ||
        history?.category === 'token swap' ||
        history?.category === 'send' ||
        history?.category === 'token send' ||
        history?.category === 'token receive'
      ) {
        if (
          history?.erc20_transfers?.length > 0 ||
          history?.native_transfers?.length > 0
        ) {
          return true
        }
      }
      return false
    })

    return data.map(e => {
      return {
        ...e,
        chainId: chain.chainId,
        iconChain: chain.icon,
        nameChain: chain.name
      }
    })
  } catch (error) {
    return []
  }
}

const useSendReceivedHistory = (chainId) => {
  const { blockchainListRedux, activeAccount } = useSelector(state => state)
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getSendReceivedHistory, activeAccount, blockchainListRedux[chainId]], getData)

  const dataCurrent = useMemo(() => {
    if (!data) return []
    if (chainId && chainId !== 'ALL') {
      return data.filter(e => e.chainId === chainId)
    }
    return data
  }, [chainId, data])

  return {
    data: dataCurrent,
    ...restData
  }
}

export default useSendReceivedHistory
