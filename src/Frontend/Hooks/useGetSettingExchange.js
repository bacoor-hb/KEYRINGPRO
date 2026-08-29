import { AFFILIATE_FEE_RECIPIENT, BRIDE_API } from 'common/constants/app'
import { CHAIN_ID_EXCLUDE_EVM, PLATFORM_EXCHANGE } from 'common/constants/swap'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import Config from 'react-native-config'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { useCallback } from 'react'
import { REDUX_KEY } from 'common/constants/redux'

const DEFAULT_DATA_API_SETTING = {
  affiliateFeePercent: 0,
  bridgeProvider: PLATFORM_EXCHANGE.relay,
  affiliateRecipientDefault: AFFILIATE_FEE_RECIPIENT
}

const CHAIN_SUPPORT_CACHE_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

const getSettingAPI = async () => {
  try {
    const params = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    }
    const res = await fetch(`${Config.EXCHANGE_API}/admin/setting?configs=others`, params)
    const responseJson = await res.json()
    // const dataApi = __DEV__ ? responseJson?.others?.keyringV2Dev : responseJson?.others?.keyringV2
    const dataApi = responseJson?.others?.keyringV2
    return {
      ...DEFAULT_DATA_API_SETTING,
      ...dataApi
    }
  } catch (error) {
    return DEFAULT_DATA_API_SETTING
  }
}

const getChainSupportedRelay = async () => {
  const res = await fetch(`${Config.RELAY_API}/chains`)
  const data = await res.json()
  return (data?.chains || []).filter(chain => {
    return chain?.vmType === 'evm'
  }).map(item => ({
    ...item,
    chainId: item?.id
  }))
}

const getChainSupportedDeBridge = async () => {
  const res = await fetch(`${BRIDE_API.DLN_API}/v1.0/supported-chains-info`)
  const data = await res.json()
  return (data?.chains || []).map(item => ({
    ...item,
    chainId: item?.originalChainId ?? item?.chainId,
    [`chainId_${PLATFORM_EXCHANGE.deBridge}`]: item?.chainId
  })).filter(chain => {
    if (CHAIN_ID_EXCLUDE_EVM.includes(chain?.chainId)) {
      return false
    }
    return true
  })
}

const getChainSupportedAPICustom = async () => {
  const data = await BaseAPI.getBlockChainList()
  return Object.entries(data || {}).map(([chainId, chainInfo]) => {
    return {
      ...chainInfo,
      chainId
    }
  })
}

const CHAIN_SUPPORTED_SOURCES = {
  [PLATFORM_EXCHANGE.relay]: getChainSupportedRelay,
  [PLATFORM_EXCHANGE.deBridge]: getChainSupportedDeBridge
}

const isChainSupportCacheValid = (cached) => {
  if (!cached?.chainSupport || cached.chainSupport.length === 0) {
    return false
  }
  if (!cached?.cachedAt) {
    return false
  }
  return (Date.now() - cached.cachedAt) < CHAIN_SUPPORT_CACHE_TTL_MS
}

const mergeChainIcons = (chainSupport, blockchainListRedux) => {
  return chainSupport.map(itemTemp => {
    const chainCommon = blockchainListRedux?.[itemTemp?.chainId || itemTemp?.id]
    if (chainCommon?.icon) {
      itemTemp.iconUrl = chainCommon.icon
      itemTemp.icon = chainCommon.icon
    } else if (itemTemp.icon) {
      itemTemp.iconUrl = itemTemp.icon
    }
    return itemTemp
  })
}

const fetchChainSupport = async (blockchainListRedux) => {
  const chainSupportByProvider = {}
  const [customResult] = await Promise.allSettled([
    getChainSupportedAPICustom(),
    ...Object.entries(CHAIN_SUPPORTED_SOURCES).map(([provider, fetchSupported]) =>
      fetchSupported().then(data => {
        chainSupportByProvider[provider] = data
      })
    )
  ])

  const chainSupportCustom = customResult.status === 'fulfilled' ? customResult.value : []

  const chainSupportTemp = []

  chainSupportCustom.forEach(chain => {
    const chainIdStr = chain?.chainId?.toString()
    const moreInfoByProvider = {}

    Object.values(PLATFORM_EXCHANGE).forEach(provider => {
      const chainInfo = chainSupportByProvider[provider]?.find(e => e?.chainId?.toString() === chainIdStr?.toString())
      if (chainInfo) {
        moreInfoByProvider[provider] = chainInfo
      }
    })

    const bridgeProvider = Object.keys(moreInfoByProvider)

    if (bridgeProvider.length > 0) {
      const itemTemp = {
        ...moreInfoByProvider[PLATFORM_EXCHANGE.deBridge],
        ...moreInfoByProvider[PLATFORM_EXCHANGE.relay],
        ...chain,
        bridgeProvider
      }

      const chainCommon = blockchainListRedux?.[itemTemp?.chainId || itemTemp?.id]

      if (chainCommon?.icon) {
        itemTemp.iconUrl = chainCommon.icon
        itemTemp.icon = chainCommon.icon
      } else {
        if (itemTemp.icon) {
          itemTemp.iconUrl = itemTemp.icon
        }
      }

      chainSupportTemp.push(itemTemp)
    }
  })

  return chainSupportTemp
}

const getData = async () => {
  try {
    const blockchainListRedux = ReduxService.getReduxDataByKey(REDUX_KEY.blockchainListRedux)

    // Always call getSettingAPI for realtime bridgeProvider
    const settingAPI = await getSettingAPI()

    // Read cached chainSupport from Redux
    const cached = ReduxService.getReduxDataByKey(REDUX_KEY.settingExchangeRedux)

    let chainSupport = cached?.chainSupport || []

    // Only fetch CHAIN_SUPPORTED_SOURCES if cache expired (>4h)
    if (!isChainSupportCacheValid(cached)) {
      chainSupport = await fetchChainSupport(blockchainListRedux)
    } else {
      chainSupport = mergeChainIcons(chainSupport, blockchainListRedux)
    }

    const result = {
      chainSupport,
      ...settingAPI,
      cachedAt: isChainSupportCacheValid(cached) ? cached.cachedAt : Date.now()
    }

    // Persist to Redux for next cold start
    ReduxService.callDispatchAction(StorageReduxAction.setSettingExchange(result))

    return result
  } catch (error) {
    // fallback to cache data
    const fallback = ReduxService.getReduxDataByKey(REDUX_KEY.settingExchangeRedux)

    if (fallback) {
      return fallback
    }

    return null
  }
}

const useGetSettingExchange = () => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getSettingExchange],
    getData,
    {
      initialData: () => ReduxService.getReduxDataByKey(REDUX_KEY.settingExchangeRedux),
      keepPreviousData: true
    }
  )

  const getMoreDataSwap = useCallback((chainId) => {
    if (data) {
      const affiliateRecipientDefault = data?.affiliateRecipientDefault || AFFILIATE_FEE_RECIPIENT
      const affiliateFeePercentDefault = data?.affiliateFeePercent || 0
      const currentProvider = data[data?.bridgeProvider]

      return {
        affiliateFeePercent: currentProvider?.affiliateFeePercentCustom?.[chainId] ||
          currentProvider?.affiliateFeePercent ||
          affiliateFeePercentDefault,

        affiliateRecipient: currentProvider?.affiliateRecipientCustom?.[chainId] ||
          data?.affiliateRecipientCustom?.[chainId] ||
          affiliateRecipientDefault
      }
    }
    return {
      affiliateFeePercent: 0,
      affiliateRecipient: AFFILIATE_FEE_RECIPIENT
    }
  }, [data])

  const getAllChain = useCallback(() => {
    if (data?.chainSupport && data?.bridgeProvider) {
      const chainRequire = []

      Object.values(PLATFORM_EXCHANGE).forEach(provider => {
        data?.[provider]?.requireChain?.forEach(chainId => {
          chainRequire.push(chainId.toString())
        })
      })

      return data?.chainSupport.filter(chain => {
        return chain.bridgeProvider.includes(data?.bridgeProvider) || chainRequire.includes(chain.chainId.toString())
      })
    }
    return []
  }, [data])

  return {
    data,
    ...restData,
    getMoreDataSwap,
    getAllChain
  }
}

export default useGetSettingExchange
