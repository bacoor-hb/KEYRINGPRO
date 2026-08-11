import React, { useCallback, useMemo } from 'react'
import I18n from 'assets/Lang'
import { View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import createStyles from './styles'
import HistoryItem from './Component/HistoryItem'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import useSendReceivedHistory from 'frontend/Hooks/useSendReceivedHistory'
import { lowerCase } from 'common/function'
import images from 'assets/Image'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { zeroAddress } from 'viem'
import useGetTokenListHasPrice from 'frontend/Hooks/useGetTokenListHasPrice'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { getHeightHeader, pixelByHeight } from 'common/styles'
import { isNativeToken } from 'common/tokens'
import { NATIVE_TOKEN_BY_CHAIN_ID_IN_HISTORY } from 'common/constants/app'

const SendReceivedHistoryPage = ({ _this }) => {
  const { typeScreen, state } = _this
  const { chainId } = state
  const isSend = typeScreen === 'send'

  const { data: dataAll, refetch, isLoading: loadingAllData } = useSendReceivedHistory(chainId, isSend)
  const styles = createStyles()

  const titleScreen = useMemo(() => {
    if (isSend) {
      return I18n.t('v2.home.sendHistory')
    } else {
      return I18n.t('v2.home.receivedHistory')
    }
  }, [isSend])

  const querySearchTokenHasPrice = useMemo(() => {
    if (!Array.isArray(dataAll) || dataAll.length === 0) {
      return { chainIsd: [], options: {} }
    }
    const tokenByChainObject = {}
    const chainIdsObject = {}

    dataAll.forEach(item => {
      const cId = item.chainId
      chainIdsObject[cId] = cId
      if (!tokenByChainObject[cId]) {
        tokenByChainObject[cId] = {}
      }

      const contractAddress = item.rawContract?.address || zeroAddress
      tokenByChainObject[cId][lowerCase(contractAddress)] = contractAddress
    })

    Object.keys(tokenByChainObject).forEach(cId => {
      tokenByChainObject[cId] = { contractAddresses: Object.keys(tokenByChainObject[cId]) }
      if (tokenByChainObject[cId].contractAddresses.length === 0) {
        delete tokenByChainObject[cId]
      }
    })

    return {
      chainIsd: Object.keys(chainIdsObject),
      options: tokenByChainObject
    }
  }, [dataAll])

  const { data: tokenListHasPrice, isLoading: loadingTokenListHasPrice } = useGetTokenListHasPrice(querySearchTokenHasPrice.chainIsd, querySearchTokenHasPrice.options)

  // Spam filter: an ERC20 transfer is kept only when the token resolves to a
  // priced entry (also gives us its icon). Native transfers are inherently
  // trusted, so they pass through untouched.
  const tokenHistoryFilterHasPrice = useMemo(() => {
    if (!Array.isArray(dataAll)) {
      return []
    }
    return dataAll.filter(item => {
      const addressToken = item.rawContract?.address
      const isNative = !addressToken
      const isNativeTokenConvertZeroAddress = NATIVE_TOKEN_BY_CHAIN_ID_IN_HISTORY[item.chainId] === lowerCase(addressToken)
      if (isNative || (isNativeTokenConvertZeroAddress && addressToken)) {
        const token = tokenListHasPrice.find(tokenPrice => {
          return isNativeToken(tokenPrice.address)
        })
        item.icon_image = token?.icon_image
        return true
      }

      const contractAddr = lowerCase(item.rawContract?.address || zeroAddress)
      const token = tokenListHasPrice.find(tokenPrice => {
        return lowerCase(tokenPrice.address || zeroAddress) === contractAddr && Number(tokenPrice.chainId) === Number(item.chainId)
      })

      if (!token) {
        return false
      }

      item.icon_image = token.icon_image
      return true
    })
  }, [tokenListHasPrice, dataAll])

  const isInitialLoading = (loadingAllData || loadingTokenListHasPrice) && tokenHistoryFilterHasPrice.length === 0

  const doRefresh = useCallback(() => {
    refetch()
  }, [refetch])

  const renderEmpty = () => {
    if (isInitialLoading) {
      return (
        <View style={styles.emptyWrap}>
          <View style={styles.emptySpacer} className='items-center'>
            <MyDotsLoading variant='large' />
          </View>
        </View>
      )
    }
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptySpacer} className='items-center'>
          <MyIcon uri={images.UIV2.icons.noData} style={styles.emptyIcon} variant='extraLarge' resizeMode='contain' />
          <MyText variant='small' className='text-low'>{I18n.t('v2.walletConnect.noHistoryYet')}</MyText>
        </View>
      </View>
    )
  }

  return (
    <MyViewPage style={styles.container}>
      {
        (loadingAllData || loadingTokenListHasPrice) ? (
          <View style={{ marginTop: getHeightHeader() + pixelByHeight(100), alignItems: 'center' }}>
            <MyDotsLoading variant='large' />
          </View>
        ) : (
          <LottieRefreshFlatList
            blurHeader
            topOffset={getHeightHeader(true)}
            refreshing={false}
            onRefresh={doRefresh}
            showWhileRefreshing={false}
            data={tokenHistoryFilterHasPrice}
            keyExtractor={(t, idx) => `${t.uniqueId || t.hash}-${idx}`}
            renderItem={({ item, index }) => (
              <HistoryItem isFirst={index === 0} chainId={chainId} isSend={isSend} item={item} />
            )}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={(
              <TitleScreen title={titleScreen} />
            )}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
          />
        )
      }

    </MyViewPage>
  )
}

export default SendReceivedHistoryPage
