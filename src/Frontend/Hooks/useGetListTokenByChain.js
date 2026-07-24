import { useMemo } from 'react'
import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { fetchKeyringTokens } from 'src/Services/TokenListV2'
import { isAddress, zeroAddress } from 'viem'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { lowerCase } from 'common/function'
import ReduxService from 'common/redux'
import CoinGeckoAPI from 'controller/API/CoinGeckoAPI'
import Config from 'react-native-config'
const getInfoTokenSearch = async (chainId, addressSearch) => {
  if (!addressSearch) {
    return null
  }

  const infoToken = {}
  const infoBase = await ViemWeb3.getInfoToken(chainId, addressSearch)
  if (!infoBase) {
    return null
  }
  infoToken.symbol = infoBase.symbol
  infoToken.decimals = infoBase.decimals
  infoToken.name = infoBase.name

  const blockchainInfo = ReduxService.getReduxDataByKey('blockchainListRedux')?.[chainId]
  const coingeckoTokenInfo = await CoinGeckoAPI.searchCoingeckoId({
    chain: blockchainInfo?.chainCoingecko || blockchainInfo?.chain,
    address: addressSearch,
    symbol: infoBase.symbol
  })

  if (coingeckoTokenInfo?.id) {
    const dataToken = await CoinGeckoAPI.getTokenInfoById(coingeckoTokenInfo.id)
    infoToken.icon_image = dataToken?.image?.small
    infoToken.price = dataToken?.market_data?.current_price?.usd || 0
  }
  return infoToken
}

const getInfoTokenSearchByRelay = async (chainId, textSearch) => {
  if (textSearch) {
    const res = await fetch(`${Config.RELAY_API}/currencies/v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chainIds: [chainId],
        term: textSearch,
        useExternalSearch: true
      })
    })
    const infoToken = await res.json()

    return infoToken
  }

  const res = await fetch(`${Config.RELAY_API}/currencies/v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chainIds: [chainId],
      useExternalSearch: false
    })
  })
  const infoToken = await res.json()

  return infoToken
}

const getData = async ({ queryKey }) => {
  const [, chainId, textSearch] = queryKey

  if (isAddress(textSearch)) {
    const [data1, infoToken] = await Promise.all([
      fetchKeyringTokens(chainId, [textSearch]),
      getInfoTokenSearch(chainId, textSearch)
    ])

    if (data1?.length > 0) {
      return data1
    }
    if (infoToken) {
      return [infoToken]
    }
  } else {
    if (textSearch) {
      // const keyringChainType = SUPPORTED_CHAINS_BY_KEYRING[chainId]
      // let url
      // const funcCall = [getInfoTokenSearchByRelay(chainId, textSearch)]
      // if (keyringChainType) {
      //   url = `token-list?chainId=${chainId}&key=${textSearch}`
      //   funcCall.push(BaseAPI.getData(url))
      // } else {
      //   const linkCustom = KEYRING_CUSTOM_API.replace('/keyrings/tokens/custom', '')
      //   url = `${linkCustom}?chainId=${chainId}&key=${textSearch}`
      //   funcCall.push(BaseAPI.getData(url))
      // }

      // const [dataRelay, dataKeyring] = await Promise.all(funcCall)
      // const mapData = new Map()
      // const arrData = [...dataRelay]

      // if (isObject(dataKeyring)) {
      //   arrData.push(...Object.values(dataKeyring))
      // } else {
      //   arrData.push(...dataKeyring)
      // }
      // console.log({ arrData })

      const arrData = await getInfoTokenSearchByRelay(chainId, textSearch)

      // arrData.forEach((token) => {
      //   if (token && !mapData.has(`${token.address || zeroAddress}`)) {
      //     mapData.set(`${token.address || zeroAddress}`, token)
      //   }
      // })

      return arrData
    } else {
      const mapData = new Map()
      const [dataRelay, dataKeyring] = await Promise.all([
        getInfoTokenSearchByRelay(chainId, textSearch),
        fetchKeyringTokens(chainId, [textSearch])
      ])

      const arrData = [...dataRelay, ...dataKeyring]

      arrData.forEach((token) => {
        if (token && !mapData.has(`${token.address || zeroAddress}`)) {
          mapData.set(`${token.address || zeroAddress}`, token)
        }
      })
      return [...mapData.values()]
    }
  }

  return []
}

const useGetListTokenByChain = (chainId, textSearch = '') => {
  const { data, ...restData } = useQuery([REACT_QUERY_KEY.getListTokenByChain, chainId, textSearch],
    getData
  )

  const dataBySearch = useMemo(() => {
    if (!data || data?.length === 0) {
      return []
    }

    const textSearchLoWer = lowerCase(textSearch || '')
    if (!textSearchLoWer) {
      return data
    }

    function hasCommonChar (str1, str2) {
      return lowerCase(str1 || '').includes(lowerCase(str2 || ''))
    }

    return data.filter((token) => {
      if (textSearch) {
        const isHaveName = hasCommonChar(token.name, textSearch)
        const isHaveSymbol = hasCommonChar(token.symbol, textSearch)
        const isHaveAddress = hasCommonChar(token.contractAddress, textSearch)

        return isHaveName || isHaveSymbol || isHaveAddress
      }
      return true
    })
  }, [data, textSearch])

  return {
    data: dataBySearch,
    ...restData
  }
}

export default useGetListTokenByChain
