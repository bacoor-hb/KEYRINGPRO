import React from 'react'
import I18n from 'assets/Lang'
import { TouchableOpacity, View } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import createStyles from './styles'
import { useSelector } from 'react-redux'
import { handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import { getSizeImgSquare } from 'common/styles'
import moment from 'moment'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'

const HistoryItem = ({ chainId, item, isSend = true, isFirst }) => {
  const { activeAccount, blockchainListRedux } = useSelector(state => state)
  const { account } = activeAccount
  const styles = createStyles()

  const getIconToken = () => {
    return item?.icon_image || blockchainListRedux[chainId]?.icon
  }

  const renderFrom = () => {
    if (isSend) {
      return null
    }
    return (
      <TouchableOpacity onPress={() => handleOpenExplorerUserAddress(item.from, item.chainId)} activeOpacity={0.9}>
        <MyText className='text-brand'>{item.from}</MyText>
      </TouchableOpacity>
    )
  }

  const renderTo = () => {
    if (!isSend) {
      return (
        <View style={styles.accountContainer}>
          <AvatarAccount noShowAccountType size={getSizeImgSquare('large')} account={account} />

          <View>
            <MyText variant='subTitle'>{account?.name || `Account ${account.indexAccount + 1}`}</MyText>
            <MyText className='text-medium'>{item.to}</MyText>
          </View>
        </View>
      )
    }
    return (
      <TouchableOpacity onPress={() => handleOpenExplorerUserAddress(item.to, item.chainId)} activeOpacity={0.9}>
        <MyText className='text-brand'>{item.to}</MyText>
      </TouchableOpacity>
    )
  }

  return (
    <MyRowItem noPadding>
      <View style={[styles.container, isFirst && { paddingTop: 8 }]}>
        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.timeStamp')}</MyText>
          <MyText>{moment(item.metadata?.blockTimestamp).format('DD/MM/YYYY HH:mm')}</MyText>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.status')}</MyText>
          <MyText className='text-green'>{item.hash ? I18n.t('Initial.success') : I18n.t('v2.common.fail')}</MyText>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>TXH</MyText>
          <TouchableOpacity onPress={() => handleOpenExplorerHash(item.hash, item.chainId)} activeOpacity={0.9}>
            <MyText className='text-brand'>{item.hash}</MyText>
          </TouchableOpacity>
        </View>

        {!isSend && (
          <View style={styles.itemRow}>
            <MyText className='text-low'>{I18n.t('Initial.from')}</MyText>
            {renderFrom()}
          </View>
        )}

        {isSend && (
          <View style={styles.itemRow}>
            <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.to')}</MyText>
            {renderTo()}
          </View>
        )}

        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.value')}</MyText>

          <View style={styles.valueRow}>
            <TokenIconWithChain
              tokenIconUri={getIconToken()}
              chainId={chainId}
            />
            <View
              style={{
                flex: 1
              }}
            >
              <MyBalance
                ticker
                numberOfLines={1}
                fractionDigits={18}
                variant='subTitle'
                value={item.value || '0'}
                suffix={item.asset ? ` ${item.asset}` : ''}
              />
            </View>

          </View>
        </View>
      </View>
    </MyRowItem>
  )
}

export default HistoryItem
