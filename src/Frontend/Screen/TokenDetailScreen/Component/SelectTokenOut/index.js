import { View, TouchableOpacity, TouchableNativeFeedback, Keyboard } from 'react-native'
import React, { useMemo, useState } from 'react'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import BtnBack from 'frontend/Components/UI/BtnBack'
import { FlatList } from 'react-native-gesture-handler'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { Colors, getHeightHeaderDrawer, PADDING_TOP_CONTAINER_DRAWER, pixelByHeight, pixelByWidth } from 'common/styles'
import createStyles from './styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import ListActionRow from 'frontend/Components/UI/ListActionRow'
import { convertWeiToBalance, lowerCase } from 'common/function'
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

const MAX_SHOW_TOKEN = 20
const CHAIN_FULL_TOKEN_RECOMMEND_FEE_GAS = ['4217']

function hasCommonChar (str1, str2) {
  return lowerCase(str1 || '').includes(lowerCase(str2 || ''))
}

const SelectTokenOut = ({ isExchange = false, handleSelectToken, handleBack, _this }) => {
  const { state } = _this
  const { chainOut, tokenIn } = isExchange ? state.exchange : state.swapAndSend
  const chainIdOut = chainOut?.chainId || tokenIn?.chainId
  const { activeAccount } = useSelector(s => s)
  const { account } = activeAccount

  const [pageListToken, setPageListToken] = useState(1)
  const [textSearch, setTextSearch] = useState('')
  const [textSearchDebounce, setTextSearchDebounce] = useState('')
  const [heightAnchorHeader, setHeightAnchor] = useState(0)

  const { data: setting, isLoading: loadingSetting } = useGetSettingExchange()
  const { data: listTokensAPI, isLoading: loadingTokensAPI } = useGetTokenSearchByChain(chainIdOut, textSearchDebounce)
  const { data: listBalanceUser, isLoading: loadingListTokensByAddress } = useGetListTokenByChainAndAddress(account?.address, [chainIdOut])
  const styles = createStyles()

  const loading = loadingSetting || loadingTokensAPI || loadingListTokensByAddress

  const listTokens = useMemo(() => {
    const mapTemp = {}
    listBalanceUser?.forEach((balanceToken) => {
      const address = lowerCase(balanceToken.contractAddress || balanceToken.address || zeroAddress)

      if (!mapTemp[address] && !balanceToken?.isHidden) {
        const balance = BigNumber(convertWeiToBalance(balanceToken.balance, balanceToken?.decimals || 18)).toString()
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

        if (isValidToShow) {
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
        const address = lowerCase(token.address || token.contractAddress || zeroAddress)
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

  const tokensRecommend = useMemo(() => {
    if (!setting?.chainSupport) {
      return []
    }
    const chain = setting?.chainSupport.find(item => item.chainId?.toString() === chainIdOut?.toString())
    const listToken = chain.featuredTokens
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
        data[index].metadata.logoURI = existing?.iconUrl
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

  const handleLoadMore = () => {
    const totalPage = Math.floor(listTokens.length / MAX_SHOW_TOKEN)
    if (pageListToken < totalPage) {
      setPageListToken(prev => prev + 1)
    }
  }

  const renderListTokenRecommend = () => {
    const data = []
    tokensRecommend.forEach((token, index) => {
      const addressToken = token.address || zeroAddress
      const isHaveName = hasCommonChar(token.name, textSearchDebounce)
      const isHaveSymbol = hasCommonChar(token.symbol, textSearchDebounce)
      const isHaveAddress = hasCommonChar(token.address || zeroAddress, textSearchDebounce)

      const nativeCoin = isNativeToken(addressToken, chainIdOut)

      if (isHaveName || isHaveSymbol || isHaveAddress) {
        data.push({
          onPress: () => handleSelectToken(token),
          title: token?.name,

          rightElement: (nativeCoin || CHAIN_FULL_TOKEN_RECOMMEND_FEE_GAS.includes(chainIdOut?.toString())) && (<MyIcon variant='small' uri={images.UIV2.icons.gas} resizeMode='contain' />),
          leftElement: (
            <View style={{ padding: pixelByWidth(8) }}>
              <View className='relative overflow-hidden  rounded-full'>

                <View style={{ position: 'relative', backgroundColor: Colors.BG_ICON_NO_BG }}>
                  <MyIcon uriDefault={images.UIV2.icons.unknowToken} uri={token?.metadata?.logoURI || token?.iconUrl || images.UIV2.icons.noTokenOutExchange} />

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
            <Token isSearch={!!textSearchDebounce} key={item?.address || item.name} token={item} onPress={handleSelectToken} />
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
              onSubmitEditing={() => setTextSearchDebounce(textSearch)}
              placeholder={I18n.t('ExchangeScreen.selectToken')}
              rightIcon={(
                <TouchableOpacity onPress={() => setTextSearchDebounce(textSearch)} activeOpacity={1}>
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
      </MyViewPage>
    </TouchableNativeFeedback>
  )
}

export default SelectTokenOut
