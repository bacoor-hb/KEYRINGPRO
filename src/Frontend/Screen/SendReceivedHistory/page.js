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
import { useSelector } from 'react-redux'
import images from 'assets/Image'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { zeroAddress } from 'viem'
import useGetTokenListHasPrice from 'frontend/Hooks/useGetTokenListHasPrice'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { getHeightHeader } from 'common/styles'
import { getRelevantTransfers } from './helper'

const SendReceivedHistoryPage = ({ _this }) => {
  const { typeScreen, state } = _this
  const { chainId } = state

  const { activeAccount } = useSelector(state => state)
  const { account } = activeAccount
  const { data: dataAll, refetch, isLoading } = useSendReceivedHistory(chainId)
  const styles = createStyles()
  const address = account.address
  const isSend = typeScreen === 'send'

  const titleScreen = useMemo(() => {
    if (isSend) {
      return I18n.t('v2.home.sendHistory')
    } else {
      return I18n.t('v2.home.receivedHistory')
    }
  }, [isSend])

  // Attach the transfers relevant to this screen (grouped by token, value > 0,
  // correct from/to address) and keep only transactions that have at least one.
  // `token swap` rows are handled here too: the leg matching `direction` decides
  // whether the swap belongs to the send or the receive screen.
  const dataFilterByTypeScreen = useMemo(() => {
    if (!Array.isArray(dataAll)) {
      return []
    }
    return dataAll
      .map(e => ({ ...e, displayTransfers: getRelevantTransfers(e, address, isSend) }))
      .filter(e => e.displayTransfers.length > 0)
  }, [dataAll, address, isSend])


  const querySearchTokenHasPrice = useMemo(() => {
    if (dataFilterByTypeScreen.length > 0) {
      const tokenByChainObject = {}
      const chainIdsObject = {}
      dataFilterByTypeScreen.forEach(item => {
        const chainId = item.chainId

        chainIdsObject[chainId] = chainId
        if (!tokenByChainObject[chainId]) {
          tokenByChainObject[chainId] = {}
        }

        // Collect every token surfaced on this screen (a swap can surface more
        // than one), not just the first transfer, so each gets a price/icon.
        item.displayTransfers.forEach(tr => {
          const addressToken = tr.isNative ? zeroAddress : (tr.address || zeroAddress)
          tokenByChainObject[chainId][lowerCase(addressToken)] = addressToken
        })
      })

      Object.keys(tokenByChainObject).forEach(chainId => {
        tokenByChainObject[chainId] = { contractAddresses: Object.keys(tokenByChainObject[chainId]) }
        if (tokenByChainObject[chainId].length === 0) {
          delete tokenByChainObject[chainId]
        }
      })

      return {
        chainIsd: Object.keys(chainIdsObject),
        options: tokenByChainObject
      }
    }
    return {
      chainIsd: [],
      options: {}
    }
  }, [dataFilterByTypeScreen])

  const { data: tokenListHasPrice, isLoading: loadingTokenListHasPrice } = useGetTokenListHasPrice(querySearchTokenHasPrice.chainIsd, querySearchTokenHasPrice.options)

  // Spam filter: an ERC20 transfer is kept only when the token resolves to a
  // priced entry (also gives us its icon). Native transfers are inherently
  // trusted, so they pass through untouched. A transaction survives only if it
  // still has at least one display transfer afterwards.
  const tokenHistoryFilterHasPrice = useMemo(() => {
    return dataFilterByTypeScreen
      .map(tokenHistory => {
        const displayTransfers = tokenHistory.displayTransfers
          .map(tr => {
            if (tr.isNative) {
              return tr
            }
            const token = tokenListHasPrice.find(tokenPrice => {
              return lowerCase(tokenPrice.address || zeroAddress) === lowerCase(tr.address || zeroAddress) && Number(tokenPrice.chainId) === Number(tokenHistory.chainId)
            })
            if (!token) {
              return null
            }
            return { ...tr, icon_image: token.icon_image || tr.token_logo }
          })
          .filter(Boolean)
        return { ...tokenHistory, displayTransfers }
      })
      .filter(tokenHistory => tokenHistory.displayTransfers.length > 0)
  }, [tokenListHasPrice, dataFilterByTypeScreen])

  // Initial load: nothing to show yet and a query is running.
  const isInitialLoading = (isLoading || loadingTokenListHasPrice) && tokenHistoryFilterHasPrice.length === 0

  const doRefresh = useCallback(() => {
    // react-query owns the fetch state via `isFetching`; just kick the refetch and
    // the Lottie spinner stays up for as long as `isFetching === true`.
    refetch()
  }, [refetch])

  // Loading and empty share the same slot (ListEmptyComponent) so the dots sit in
  // the exact spot the "No history" state would — below the title, not centered.
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
      <LottieRefreshFlatList
        blurHeader
        topOffset={getHeightHeader(true)}
        refreshing={false}
        onRefresh={doRefresh}
        showWhileRefreshing={false}
        data={tokenHistoryFilterHasPrice}
        keyExtractor={(t, idx) => `${t.metaKey}-${idx}`}
        renderItem={({ item, index }) => (
          <HistoryItem isFirst={index === 0} chainId={chainId} isSend={typeScreen === 'send'} key={item.id} item={item} />
        )}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <TitleScreen title={titleScreen} />
        )}
        ListEmptyComponent={renderEmpty}
        // ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />
    </MyViewPage>
  )
}

export default SendReceivedHistoryPage
