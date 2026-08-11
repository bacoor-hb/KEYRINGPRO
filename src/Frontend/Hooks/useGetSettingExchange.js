import { AFFILIATE_FEE_RECIPIENT, BRIDGE_SLIPAGE, REFERRAL_CODE } from 'common/constants/app'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import usePersistedQueryData from './usePersistedQueryData'
import { KEYSTORE } from 'common/constants/redux'
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { useMemo } from 'react'
import Config from 'react-native-config'
import ReduxService from 'common/redux'

const DEADLINE_MS = 12 * 60 * 60 * 1000 // 12h cache TTL

const DEFAULT_DATA_API = {
  affiliate: {
    affiliateRecipient: AFFILIATE_FEE_RECIPIENT,
    affiliateFeePercentRelay: 0 // AFFILIATE_FEE_PERENT
    // affiliateRecipientCustom: '{"1": "0xe8ea93eb0947ec6bedb8fa6396cb3a168276ddb3"}'
  },
  bridgeProvider: 'relay',
  referralCode: REFERRAL_CODE,
  bridgeFee: BRIDGE_SLIPAGE
}

const getSettingBase = async () => {
  const params = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  }
  const res = await fetch(`${Config.EXCHANGE_API}/admin/setting?configs=others`, params)
  const responJson = await res.json()
  return {
    ...DEFAULT_DATA_API,
    ...responJson?.keyring
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

const getChainSupportedAPICustom = async () => {
  const data = await BaseAPI.getBlockChainList()
  return Object.entries(data || {}).map(([chainId, chainInfo]) => {
    return {
      ...chainInfo,
      chainId
    }
  })
}

// Check if cached data is still within the deadline window
const isCacheValid = (cached) => {
  if (!cached?.deadline) return false
  return Date.now() < cached.deadline
}

const getData = async () => {
  try {
    const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux')
    const dataLocal = await getDataFromAsyncStorage(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE)

    // Return cached data if still valid, skip API calls
    if (dataLocal && isCacheValid(dataLocal)) {
      const chainSupport = (dataLocal.data || []).map(itemTemp => {
        const chainCommon = blockchainListRedux?.[itemTemp?.chainId || itemTemp?.id]

        if (chainCommon?.icon) {
          itemTemp.iconUrl = chainCommon.icon
          itemTemp.icon = chainCommon.icon
        }
        return itemTemp
      })

      return {
        chainSupport,
        ...dataLocal.settingBase
      }
    }

    // Fetch fresh data from all sources
    const [chainSupportReplay, settingBase, chainSupportCustom] = await Promise.all([
      getChainSupportedRelay(),
      getSettingBase(),
      getChainSupportedAPICustom()
    ])

    // Merge: only chains present in both relay and custom API are included
    const chainSupportTemp = []

    chainSupportCustom.forEach(chain => {
      const moreInfoByReplay = chainSupportReplay.find(e => e?.chainId?.toString() === chain?.chainId?.toString())
      if (moreInfoByReplay) {
        const itemTemp = {
          ...moreInfoByReplay,
          ...chain

        }
        const chainCommon = blockchainListRedux?.[itemTemp?.chainId || itemTemp?.id]

        if (chainCommon?.icon) {
          itemTemp.iconUrl = chainCommon.icon
          itemTemp.icon = chainCommon.icon
        }

        chainSupportTemp.push(itemTemp)
      }
    })

    // Save fresh data to cache with 12h deadline
    if (chainSupportTemp?.length > 0) {
      storeDataToAsyncStorage(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE, {
        data: chainSupportTemp,
        settingBase,
        deadline: Date.now() + DEADLINE_MS
      })
    } else {
      // API returned empty — use local fallback and refresh deadline
      const fallbackData = dataLocal?.data || []
      storeDataToAsyncStorage(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE, {
        ...dataLocal,
        deadline: Date.now() + DEADLINE_MS
      })
      return {
        chainSupport: fallbackData,
        ...settingBase
      }
    }

    return {
      chainSupport: chainSupportTemp, ...settingBase
    }
  } catch (error) {
    // On API error, return cached data and extend deadline
    const dataLocal = await getDataFromAsyncStorage(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE)
    if (dataLocal?.data) {
      storeDataToAsyncStorage(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE, {
        ...dataLocal,
        deadline: Date.now() + DEADLINE_MS
      })
      return {
        chainSupport: dataLocal.data,
        ...dataLocal.settingBase
      }
    }
    return null
  }
}

const useGetSettingExchange = () => {
  const [persisted] = usePersistedQueryData(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE)

  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getSettingExchange],
    getData,
    {
      keepPreviousData: true
    }
  )

  // Prefer react-query data, fallback to persisted cache
  const dataFilter = useMemo(() => {
    if (data) {
      return data
    }
    if (persisted?.data) {
      return {
        chainSupport: persisted.data,
        ...persisted.settingBase
      }
    }
    return null
  }, [data, persisted])

  return {
    data: dataFilter,
    ...restData
  }
}

export default useGetSettingExchange
