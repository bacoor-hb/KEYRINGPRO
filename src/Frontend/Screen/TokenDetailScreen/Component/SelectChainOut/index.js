import { View, TouchableOpacity, TouchableNativeFeedback, Keyboard } from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import createStyles from './styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import BtnBack from 'frontend/Components/UI/BtnBack'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import ListActionRow from 'frontend/Components/UI/ListActionRow'
import { ScrollView } from 'react-native-gesture-handler'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { Colors, getSafeAreaValues, getSizeImgSquare, PADDING_TOP_CONTAINER_DRAWER, width } from 'common/styles'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import MyInputSearch from 'frontend/Components/UI/MyInputSearch'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import ContainerAnchor from 'frontend/Components/UI/ContainerAnchor'
import useGetListTokenByChainAndAddress from 'frontend/Hooks/useGetListTokenByChainAndAddress'
import { useSelector } from 'react-redux'
import { isNativeToken } from 'common/tokens'
import { zeroAddress } from 'viem'
import { lowerCase } from 'common/function'
import useGetTokenSearchByChain from 'frontend/Hooks/useGetTokenSearchByChain'

const SelectChainOut = ({ isExchange, handleChangeChain, handleBack, _this }) => {
  const [textSearch, setTextSearch] = useState('')
  const [textSearchDebounce, setTextSearchDebounce] = useState('')
  const [heightAnchorHeader, setHeightAnchor] = useState(0)
  const [isShowListChain, setIsShowListChain] = useState(false)
  const [chain, setChain] = useState(null)

  const { state } = _this
  const { activeAccount } = useSelector(s => s)
  const { tokenOut } = isExchange ? state.exchange : state.swapAndSend

  const { account } = activeAccount
  const styles = createStyles()

  const querySearchToken = useMemo(() => {
    if (tokenOut?.coinGeckoId) {
      return {
        cgid: tokenOut?.coinGeckoId
      }
    }
    return null
  }, [tokenOut])

  const { data: setting, isLoading } = useGetSettingExchange()
  const { data: listBalanceUser, isLoading: loadingListTokensByAddress } = useGetListTokenByChainAndAddress(account?.address, chain ? [chain?.chainId] : [])
  const { data: tokenSearch, isLoading: loadingTokenSearch } = useGetTokenSearchByChain(chain?.chainId, querySearchToken)

  useEffect(() => {
    setTimeout(() => {
      setIsShowListChain(true)
    }, 400)
  }, [])

  useEffect(() => {
    if (chain && !loadingListTokensByAddress && !loadingTokenSearch) {
      const addressToken = tokenOut?.address || tokenOut?.contractAddress
      const exitTokenBalance = listBalanceUser?.find(tokenUser => {
        if (isNativeToken(tokenUser?.contractAddress)) {
          return zeroAddress === addressToken || isNativeToken(addressToken)
        }
        return lowerCase(tokenUser?.contractAddress) === lowerCase(addressToken) || tokenUser?.coinGeckoId === tokenOut?.coinGeckoId
      })

      if (tokenOut) {
        if (exitTokenBalance) {
          handleChangeChain(chain, exitTokenBalance)
        } else {
          if (tokenSearch?.length > 0) {
            // Match on BOTH of the selected token's tickers. Its `symbol` may
            // already be the contract's own (resolveTokenOutSymbol patches it in
            // after a pick), while `tokenSearch` rows carry the listing symbol
            // only — so comparing one against the other can miss the equivalent
            // token and fall through to "first result", i.e. an unrelated one.
            const wantedSymbols = [tokenOut.symbolOnchain, tokenOut.symbol]
              .filter(Boolean)
              .map(lowerCase)
            // `lowerCase` passes a falsy value straight through, so a row with no
            // symbol would throw on .startsWith — hence the `|| ''`.
            const exitToken = tokenSearch.find(e => {
              const candidate = lowerCase(e?.symbol) || ''
              return wantedSymbols.some(wanted => candidate.startsWith(wanted))
            })
            if (exitToken) {
              handleChangeChain(chain, exitToken)
            } else {
              handleChangeChain(chain, tokenSearch?.[0])
            }
          } else {
            handleChangeChain(chain, null)
          }
        }
      } else {
        handleChangeChain(chain, null)
      }
    }
  }, [loadingTokenSearch, tokenSearch, chain, tokenOut, loadingListTokensByAddress, listBalanceUser])

  const renderChains = () => {
    const data = []

    setting.chainSupport.forEach((chain, index) => {
      if (textSearchDebounce) {
        const isHasName = chain?.name?.toLowerCase()?.includes(textSearchDebounce.toLowerCase())
        const isHashChainId = chain?.chainId?.toString()?.includes(textSearchDebounce)
        if (!isHasName && !isHashChainId) {
          return
        }
      }
      data.push({
        chainId: Number(chain?.chainId?.toString()),
        onPress: () => setChain(chain),
        title: chain?.name || chain?.displayName,
        leftElement: (
          <View style={{ width: getSizeImgSquare('large'), height: getSizeImgSquare('large') }} className='items-center justify-center'>
            <MyIcon uri={chain?.iconUrl || chain.icon || images.UIV2.icons.unknowChain} isBorderIcon />
          </View>
        )
      })
    })

    data.sort((a, b) => {
      const indexA = LIST_DEFAULT_CHAIN_ID.indexOf(a.chainId)
      const indexB = LIST_DEFAULT_CHAIN_ID.indexOf(b.chainId)

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }

      if (indexA !== -1) return -1

      if (indexB !== -1) return 1

      return 0
    })
    return <ListActionRow data={data} />
  }

  return (
    <TouchableNativeFeedback onPress={Keyboard.dismiss}>
      <MyViewPage style={styles.container}>

        <ContainerAnchor fallbackColor={Colors.BG_MAIN_DRAWER} onSetHeightContainer={setHeightAnchor}>
          <View>
            <TitleDrawer
              title={I18n.t('v2.selectChain.title')}
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
              placeholder={I18n.t('v2.selectChain.searchPlaceholder')}
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
          isShowListChain && (

            <ScrollView contentContainerStyle={{ paddingTop: heightAnchorHeader - PADDING_TOP_CONTAINER_DRAWER, paddingBottom: getSafeAreaValues().bottom }} showsVerticalScrollIndicator={false}>
              {
                isLoading && (
                  <View className='flex items-center justify-center'>
                    <MyDotsLoading variant='large' />
                  </View>
                )
              }
              {
                setting?.chainSupport && !isLoading && renderChains()
              }

            </ScrollView>
          )
        }
        {
          chain && (
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

export default SelectChainOut
