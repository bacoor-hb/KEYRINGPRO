import { View, ActivityIndicator, FlatList, RefreshControl } from 'react-native'
import React, { useState } from 'react'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { Colors, pixelByHeight } from 'common/styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyText from 'frontend/Components/UI/MyText'
import HistoryWCPayItem from './item'
import useGetHistoryWCPay from 'frontend/Hooks/useGetHistoryWCPay'
import { useSelector } from 'react-redux'

const HistoryWCPay = () => {
  const styles = createStyles()
  const { activeAccount } = useSelector(state => state)
  const { account } = activeAccount

  const { data: dataHistory, isLoading } = useGetHistoryWCPay(account.indexAccount)

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Colors.WHITE} />
        </View>
      )
    }
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptySpacer} className='items-center'>
          <MyIcon uri={images.UIV2.icons.noData} variant='extraLarge' style={styles.emptyIcon} resizeMode='contain' />
          <MyText variant='small' className='text-low'>{I18n.t('v2.walletConnect.noHistoryYet')}</MyText>
        </View>

      </View>
    )
  }

  return (
    <MyViewPage style={[styles.container, { paddingBottom: 0 }]}>
      <TitleDrawer hasBlur absolute title={I18n.t('v2.walletConnect.history')} leftIcon={images.UIV2.icons.history} />
      <FlatList
        style={{
          paddingTop: pixelByHeight(8)
        }}
        data={dataHistory}
        keyExtractor={(t, idx) => `${t.metaKey}-${idx}`}
        renderItem={({ item, index }) => (
          <HistoryWCPayItem isFirst={index === 0} isLast={index === dataHistory.length - 1} key={item.id} item={item} />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
      />
    </MyViewPage>
  )
}

export default HistoryWCPay
