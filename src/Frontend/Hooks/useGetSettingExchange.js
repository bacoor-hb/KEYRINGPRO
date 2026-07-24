import { AFFILIATE_FEE_RECIPIENT, BRIDGE_SLIPAGE, REFERRAL_CODE } from 'common/constants/app'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import { useSelector } from 'react-redux'
import usePersistedQueryData from './usePersistedQueryData'
import { KEYSTORE } from 'common/constants/redux'
import { storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { useMemo } from 'react'
import Config from 'react-native-config'

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

const getData = async ({ queryKey }) => {
  const [, blockchainListRedux] = queryKey
  try {
    const [chainSupportReplay, settingBase, chainSupportCustom] = await Promise.all([
      getChainSupportedRelay(),
      getSettingBase(),
      getChainSupportedAPICustom()
    ])

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

    storeDataToAsyncStorage(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE, chainSupportTemp)

    return {
      chainSupport: chainSupportTemp, ...settingBase
    }
  } catch (error) {
    return {}
  }
}

const useGetSettingExchange = () => {
  const [persisted] = usePersistedQueryData(KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE)

  const { blockchainListRedux } = useSelector(s => s)
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getSettingExchange, blockchainListRedux],
    getData,
    {
      keepPreviousData: true
    }
  )

  const dataFilter = useMemo(() => {
    if (data) {
      return data
    }
    if (persisted) {
      return {
        chainSupport: persisted

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
