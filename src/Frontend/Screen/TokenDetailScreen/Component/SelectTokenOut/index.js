import { View, TouchableOpacity, TouchableNativeFeedback, Keyboard } from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import BtnBack from 'frontend/Components/UI/BtnBack'
import { FlatList } from 'react-native-gesture-handler'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { Colors, getHeightHeaderDrawer, PADDING_TOP_CONTAINER_DRAWER, pixelByHeight, pixelByWidth, width } from 'common/styles'
import createStyles from './styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import ListActionRow from 'frontend/Components/UI/ListActionRow'
import { convertWeiToBalance, jsonStr2Obj, lowerCase } from 'common/function'
import { zeroAddress } from 'viem'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import MyInputSearch from 'frontend/Components/UI/MyInputSearch'
import MyText from 'frontend/Components/UI/MyText'
import Token from './token'
import { useSelector } from 'react-redux'
import BigNumber from 'bignumber.js'
import useGetTokenSearchByChain from 'frontend/Hooks/useGetTokenSearchByChain'
import useGetListTokenByChainAndAddress from 'frontend/Hooks/useGetListTokenByChainAndAddress'
import ContainerAnchor from 'frontend/Components/UI/ContainerAnchor'
import { getAddressNative, isNativeToken } from 'common/tokens'
import { resolveOnchainSymbolFor } from 'src/Services/TokenListV2/symbolOnchain'
import { TOKEN_RECOMMEND_SWAP } from 'common/constants/swap'
import ReduxService from 'common/redux'
import { CONTRACT_CONVERT_ZERO_ADDRESS_GET_PRICE_API } from 'common/constants/app'

const MAX_SHOW_TOKEN = 20
const CHAIN_FULL_TOKEN_RECOMMEND_FEE_GAS = ['4217']

function hasCommonChar (str1, str2) {
  return lowerCase(str1 || '').includes(lowerCase(str2 || ''))
}

const SelectTokenOut = ({ isExchange = false, handleSelectToken, handleBack, _this }) => {
  const { state } = _this
  const { chainOut, tokenIn, tokenOut: tokenOutDefault } = isExchange ? state.exchange : state.swapAndSend
  const chainIdOut = chainOut?.chainId || tokenIn?.chainId
  const { activeAccount } = useSelector(s => s)
  const { account } = activeAccount

  const [pageListToken, setPageListToken] = useState(1)
  const [textSearch, setTextSearch] = useState('')
  const [textSearchDebounce, setTextSearchDebounce] = useState('')
  const [heightAnchorHeader, setHeightAnchor] = useState(0)
  const [tokenOut, setTokenOut] = useState()

  const { data: setting, isLoading: loadingSetting } = useGetSettingExchange()
  const { data: listTokensAPI, isLoading: loadingTokensAPI } = useGetTokenSearchByChain(chainIdOut, textSearchDebounce)
  const { data: listBalanceUser, isLoading: loadingListTokensByAddress } = useGetListTokenByChainAndAddress(account?.address, [chainIdOut])
  const styles = createStyles()

  const querySearchToken = useMemo(() => {
    if (tokenOut && !tokenOut?.coinGeckoId) {
      return tokenOut?.address || tokenOut?.contractAddress || zeroAddress
    }
    return null
  }, [tokenOut])

  const { data: tokenSearch, isLoading: loadingTokenSearch } = useGetTokenSearchByChain(chainIdOut, querySearchToken)

  const loading = loadingSetting || loadingTokensAPI || loadingListTokensByAddress

  const listTokens = useMemo(() => {
    const mapTemp = {}
    listBalanceUser?.forEach((balanceToken) => {
      let address = lowerCase(balanceToken.contractAddress || balanceToken.address || zeroAddress)

      if (isNativeToken(address)) {
        address = zeroAddress
      }

      if (!mapTemp[address] && !balanceToken?.isHidden) {
        const balance = BigNumber(convertWeiToBalance(balanceToken.balance || '0', balanceToken?.decimals || 18)).toString()
        const price = BigNumber(balanceToken.priceUSD || '0').toString()
        let isValidToShow = false

        if (textSearchDebounce) {
          const isHaveName = hasCommonChar(balanceToken.name, textSearchDebounce)
          const isHaveSymbol = hasCommonChar(balanceToken.symbol, textSearchDebounce)
          const isHaveAddress = hasCommonChar(address, textSearchDebounce)
          if (isHaveName || isHaveSymbol || isHaveAddress) {
            isValidToShow = true
          }
        } else {
          isValidToShow = true
        }

        if (isValidToShow && BigNumber(balance || '0').gt(0)) {
          const tokenTemp = { ...balanceToken }
          tokenTemp.address = address
          tokenTemp.balance = balance
          tokenTemp.totalToUSD = BigNumber(balance).multipliedBy(price).toString()
          mapTemp[address] = tokenTemp
        }
      }
    })

    if (textSearchDebounce) {
      listTokensAPI?.forEach((token, index) => {
        let address = lowerCase(token.address || token.contractAddress || zeroAddress)

        if (isNativeToken(address)) {
          address = zeroAddress
        }

        const tokenTemp = { ...token }
        tokenTemp.address = address

        if (!mapTemp[address]) {
          mapTemp[address] = tokenTemp
        }
      })
    }
    const arrTemp = Object.values(mapTemp)
    return arrTemp
  }, [listTokensAPI, listBalanceUser, textSearchDebounce])

  // Build recommended token list: base from featuredTokens/swap fallback,
  // append API show tokens, then remove API ignore tokens.
  const tokensRecommend = useMemo(() => {
    const tokenShowByApi = jsonStr2Obj(ReduxService.getSettingOther('keyring_EXCHANGE_LIST_TOKEN_RECOMMENDATION'))
    const tokenIgnoreByApi = jsonStr2Obj(ReduxService.getSettingOther('keyring_EXCHANGE_LIST_TOKEN_IGNORE'))

    if (!setting?.chainSupport) {
      return []
    }
    const chain = setting?.chainSupport.find(item => item.chainId?.toString() === chainIdOut?.toString())

    // Base recommended list from chain config, fallback to swap constant.
    let listToken = chain?.featuredTokens || []

    if (listToken?.length === 0 && TOKEN_RECOMMEND_SWAP[chain.chainId]) {
      listToken = TOKEN_RECOMMEND_SWAP[chain.chainId]
    }

    const chainIdStr = chainIdOut?.toString()
    const apiTokens = tokenShowByApi?.[chainIdStr] ?? []
    const ignoreTokens = tokenIgnoreByApi?.[chainIdStr] ?? []

    // Append API show tokens that are not already in the base list based on tokenPosition.
    if (apiTokens && apiTokens?.length > 0) {
      const existingAddresses = new Set(listToken.map(token => lowerCase(token.address || token.contractAddress || zeroAddress)))
      const newTokens = { top: [], bottom: [] }
      apiTokens.forEach(token => {
        const address = lowerCase(token.address || token.contractAddress || zeroAddress)
        if (!existingAddresses.has(address)) {
          if (token.position === 'top') {
            newTokens.top.push(token)
          } else {
            newTokens.bottom.push(token)
          }
          existingAddresses.add(address)
        }
      })

      listToken = [...newTokens.top, ...listToken, ...newTokens.bottom]
    }

    // Remove tokens marked as ignored by API.
    if (ignoreTokens?.length > 0) {
      listToken = listToken.filter(token => {
        const address = lowerCase(token.address || token.contractAddress || zeroAddress)
        return !ignoreTokens.some(ignoreToken => lowerCase(ignoreToken) === address)
      })
    }

    // Filter by search term (name, symbol, or address).
    const data = []
    listToken.forEach((token) => {
      const isHaveName = hasCommonChar(token.name, textSearchDebounce)
      const isHaveSymbol = hasCommonChar(token.symbol, textSearchDebounce)
      const isHaveAddress = hasCommonChar(token.address || zeroAddress, textSearchDebounce)
      if (isHaveName || isHaveSymbol || isHaveAddress) {
        data.push(token)
      }
    })
    const addressNativeTokenFee = getAddressNative(chainIdOut)

    data.forEach((token, index) => {
      const addressToken = isNativeToken(token.address) ? zeroAddress : lowerCase(token.address)

      const existing = listBalanceUser?.find(tokenUser => {
        if (isNativeToken(tokenUser?.contractAddress)) {
          if (addressToken === lowerCase(addressNativeTokenFee)) {
            return true
          }
        }

        return addressToken === lowerCase(tokenUser?.contractAddress)
      })
      if (existing && existing?.iconUrl) {
        if (data[index].metadata) {
          data[index].metadata.logoURI = existing?.iconUrl
        }
      }
    })

    return data
  }, [setting, chainIdOut, textSearchDebounce, listBalanceUser])

  const tokenShow = useMemo(() => {
    return listTokens.slice(0, pageListToken * MAX_SHOW_TOKEN)
  }, [listTokens, pageListToken])

  const isShowEmptySearchToken = useMemo(() => {
    if (tokenShow?.length === 0 && textSearchDebounce) {
      return true
    }
    return false
  }, [tokenShow, textSearchDebounce])

  const onSearch = (value) => {
    Keyboard.dismiss()
    setTextSearchDebounce(value)
  }

  const handleSelectTokenByGetSymbol = async () => {
    const tokenMerge = { ...tokenOut, ...tokenSearch?.[0] }
    const address = tokenMerge.address

    if (isNativeToken(tokenMerge.address)) {
      // If the token is a native token, we can directly assign the symbol from the chain's native currency
      if (chainOut?.nativeCurrency?.symbol) {
        tokenMerge.symbol = chainOut.nativeCurrency.symbol
      }
    } else {
      tokenMerge.symbol = await resolveOnchainSymbolFor(chainIdOut, address)
    }
    handleSelectToken(tokenMerge)
  }

  useEffect(() => {
    if (!loadingTokenSearch && tokenOut) {
      handleSelectTokenByGetSymbol()
    }
  }, [loadingTokenSearch, tokenSearch, tokenOut, listBalanceUser])

  const handleLoadMore = () => {
    const totalPage = Math.floor(listTokens.length / MAX_SHOW_TOKEN)
    if (pageListToken < totalPage) {
      setPageListToken(prev => prev + 1)
    }
  }

  const onSelectToken = (token) => {
    if (token?.coinGeckoId) {
      setTokenOut(token)
    } else {
      const exitTokenBalance = listBalanceUser?.find(tokenUser => {
        if (isNativeToken(tokenUser?.contractAddress)) {
          return zeroAddress === token.address
        }
        return lowerCase(tokenUser?.contractAddress) === lowerCase(token?.address)
      })
      if (exitTokenBalance) {
        handleSelectToken(exitTokenBalance)
      } else {
        setTokenOut(token)
      }
    }
  }

  const renderListTokenRecommend = () => {
    const data = []
    tokensRecommend.forEach((token, index) => {
      const addressToken = token.address || zeroAddress
      const isHaveName = hasCommonChar(token.name, textSearchDebounce)
      const isHaveSymbol = hasCommonChar(token.symbol, textSearchDebounce)
      const isHaveAddress = hasCommonChar(token.address || zeroAddress, textSearchDebounce)
      let iconTokenDefault
      let nativeCoin = isNativeToken(addressToken, chainIdOut)

      if (tokenOutDefault && tokenOutDefault?.icon_image) {
        if (isNativeToken(tokenOutDefault) && isNativeToken(addressToken)) {
          iconTokenDefault = tokenOutDefault.icon_image
        }
        if (lowerCase(tokenOutDefault.address) === lowerCase(addressToken)) {
          iconTokenDefault = tokenOutDefault.icon_image
        }
      }

      if (CONTRACT_CONVERT_ZERO_ADDRESS_GET_PRICE_API[chainIdOut]) {
        if (lowerCase(CONTRACT_CONVERT_ZERO_ADDRESS_GET_PRICE_API[chainIdOut]) === lowerCase(addressToken)) {
          nativeCoin = true
        }
      }

      if (isHaveName || isHaveSymbol || isHaveAddress) {
        data.push({
          onPress: () => onSelectToken(token),
          title: token?.name,

          rightElement: (nativeCoin || CHAIN_FULL_TOKEN_RECOMMEND_FEE_GAS.includes(chainIdOut?.toString())) && (<MyIcon variant='small' uri={images.UIV2.icons.gas} resizeMode='contain' />),
          leftElement: (
            <View style={{ padding: pixelByWidth(8) }}>
              <View className='relative overflow-hidden  rounded-full'>

                <View style={{ position: 'relative', backgroundColor: Colors.BG_ICON_NO_BG }}>
                  <MyIcon uriDefault={images.UIV2.icons.unknowToken} uri={iconTokenDefault || token?.metadata?.logoURI || token?.iconUrl || images.UIV2.icons.noTokenOutExchange} />

                </View>
              </View>
            </View>
          )
        })
      }
    })

    return data?.length > 0 && (
      <>
        <MyText className='text-low'>{I18n.t('v2.selectToken.commonUsed')}</MyText>
        <ListActionRow data={data} />
        {!textSearchDebounce && (
          <View style={{ height: pixelByHeight(14) }} />
        )}

      </>
    )
  }

  const renderEmpty = () => {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptySpacer} className='items-center'>
          <MyIcon uri={images.UIV2.icons.noData} style={styles.emptyIcon} variant='extraLarge' resizeMode='contain' />
          <MyText variant='small' className='text-low'>{I18n.t('v2.selectToken.noData')}</MyText>
        </View>

      </View>
    )
  }

  const renderListTokens = () => {
    return (
      <FlatList
        showsVerticalScrollIndicator={false}
        data={tokenShow}
        contentContainerStyle={[styles.listToken, { paddingTop: heightAnchorHeader - PADDING_TOP_CONTAINER_DRAWER }]}
        keyExtractor={(item, index) => `token-${item?.address || item.name}-${index}`}
        renderItem={({ item }) => {
          return (
            <Token isSearch={!!textSearchDebounce} key={item?.address || item.name} token={item} onPress={onSelectToken} />
          )
        }}
        ListEmptyComponent={isShowEmptySearchToken ? renderEmpty : null}
        ListHeaderComponent={(
          <View>
            {
              !textSearchDebounce && (
                <>
                  {renderListTokenRecommend()}
                  <MyText className='text-low'>{I18n.t('v2.selectToken.tokensYouOwn')}</MyText>
                  {
                    listBalanceUser?.length === 0 && !loadingListTokensByAddress && renderEmpty()
                  }
                  {
                    loadingListTokensByAddress && (
                      <View style={{ marginTop: pixelByHeight(20) }} className='flex  items-center justify-center'>
                        <MyDotsLoading variant='large' />
                      </View>
                    )
                  }
                </>
              )
            }

          </View>
        )}
        onEndReached={handleLoadMore}
        // onEndReachedThreshold={0.5}

      />
    )
  }

  return (
    <TouchableNativeFeedback onPress={Keyboard.dismiss}>
      <MyViewPage style={styles.container}>

        <ContainerAnchor fallbackColor={Colors.BG_MAIN_DRAWER} onSetHeightContainer={setHeightAnchor}>
          <View>
            <TitleDrawer
              title={I18n.t('Initial.selectAToken')}
              leftIcon={(<BtnBack onPress={handleBack} />)}
            />
            <MyInputSearch
              value={textSearch}
              onChangeText={e => {
                setTextSearch(e)
                if (!e) {
                  setTextSearchDebounce('')
                }
              }}
              returnKeyType='search'
              onSubmitEditing={() => onSearch(textSearch)}
              placeholder={I18n.t('ExchangeScreen.selectToken')}
              rightIcon={(
                <TouchableOpacity onPress={() => onSearch(textSearch)} activeOpacity={1}>
                  <MyIcon uri={images.UIV2.icons.search} variant='small' />
                </TouchableOpacity>
              )}
            />
          </View>

        </ContainerAnchor>

        <View style={{ height: PADDING_TOP_CONTAINER_DRAWER }} />

        {
          loading && (
            <View style={{ marginTop: getHeightHeaderDrawer(false) + pixelByHeight(40) }} className='flex items-center justify-center'>
              <MyDotsLoading variant='large' />
            </View>
          )
        }

        {
          setting && !loading && (
            <>
              {renderListTokens()}
            </>
          )
        }
        {
          tokenOut && (
            <View
              style={{
                position: 'absolute',
                zIndex: 10000,
                width: width(100),
                height: '100%',
                top: 0,
                backgroundColor: Colors.BG_BACK_DROP_MODAL
              }}>
              <View className='flex flex-1 items-center justify-center'>
                <MyDotsLoading variant='large' />
              </View>
            </View>
          )
        }
      </MyViewPage>
    </TouchableNativeFeedback>
  )
}

export default SelectTokenOut
