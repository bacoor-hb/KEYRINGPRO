import React from 'react'
import I18n from 'assets/Lang'
import { TouchableOpacity, View } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import createStyles from './styles'
import { convertAddressArrToString } from 'common/function'
import { useSelector } from 'react-redux'
import { handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'
import { getSizeImgSquare, pixelByHeight } from 'common/styles'
import moment from 'moment'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const HistoryItem = ({ chainId, item, isSend = true, isFirst }) => {
  const { activeAccount, blockchainListRedux } = useSelector(state => state)
  const { account } = activeAccount
  const styles = createStyles()

  // Already grouped by token (same token summed, different tokens split) and
  // filtered to this screen's direction by the page. Fall back to [] defensively.
  const transfers = item?.displayTransfers || []
  // Counterparty (from/to) is the same across a swap's legs, so the first one
  // represents the transaction's counterparty for the from/to rows.
  const primaryTx = transfers[0] || {}

  const getIconToken = (infoTx) => {
    return infoTx?.icon_image || infoTx?.token_logo || item?.icon_image || blockchainListRedux[chainId]?.icon
  }

  const renderFrom = () => {
    const infoTx = primaryTx

    if (isSend) {
      return null
      // return (
      //   <View style={styles.accountContainer}>

      //     <AvatarAccount noShowAccountType size={getSizeImgSquare('large')} account={account} />

      //     <View>
      //       <MyText variant='subTitle'>{account?.name || `Account ${indexAccount + 1}`}</MyText>
      //       <MyText className='text-medium'>{convertAddressArrToString([infoTx.from_address])}</MyText>
      //     </View>
      //   </View>
      // )
    }
    return (
      <TouchableOpacity onPress={() => handleOpenExplorerUserAddress(infoTx.from_address, item.chainId)} activeOpacity={0.9}>
        <MyText className='text-brand'>{infoTx.from_address}</MyText>
      </TouchableOpacity>
    )
  }

  const renderTo = () => {
    const infoTx = primaryTx
    if (!isSend) {
      return (
        <View style={styles.accountContainer}>
          <AvatarAccount noShowAccountType size={getSizeImgSquare('large')} account={account} />

          <View>
            <MyText variant='subTitle'>{account?.name || `Account ${account.indexAccount + 1}`}</MyText>
            <MyText className='text-medium'>{convertAddressArrToString([infoTx.to_address])}</MyText>
          </View>
        </View>
      )
    }
    return (
      <TouchableOpacity onPress={() => handleOpenExplorerUserAddress(infoTx.to_address, item.chainId)} activeOpacity={0.9}>
        <MyText className='text-brand'>{infoTx?.to_address}</MyText>
      </TouchableOpacity>
    )
  }

  return (
    <MyRowItem noPadding>
      <View style={[styles.container, isFirst && { paddingTop: pixelByHeight(8) }]}>
        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.timeStamp')}</MyText>
          <MyText>{moment(item.block_timestamp).format('DD/MM/YYYY HH:mm')}</MyText>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.status')}</MyText>
          <MyText className={item.hash ? 'text-green' : 'text-red'}>{item.hash ? I18n.t('Initial.success') : I18n.t('v2.common.fail')}</MyText>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>TXH</MyText>
          <TouchableOpacity onPress={() => handleOpenExplorerHash(item.hash, item.chainId)} activeOpacity={0.9}>
            <MyText className='text-brand'>{item.hash}</MyText>
          </TouchableOpacity>
        </View>
        {
          !isSend && (

            <View style={styles.itemRow}>
              <MyText className='text-low'>{I18n.t('Initial.from')}</MyText>
              {renderFrom()}
            </View>
          )
        }

        {
          isSend && (
            <View style={styles.itemRow}>
              <MyText className='text-low'>{isSend ? I18n.t('TxTransferHistoryScreen.to') : I18n.t('v2.common.receivedAddress')}</MyText>
              {renderTo()}
            </View>
          )
        }

        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.value')}</MyText>

          <View style={styles.valueList}>
            {transfers.map((infoTx, index) => (
              <View style={styles.valueRow} key={infoTx.tokenKey || index}>
                <TokenIconWithChain
                  tokenIconUri={getIconToken(infoTx)}
                  chainId={chainId}
                />
                <MyTextTicker>
                  <MyBalance numberOfLines={1} fractionDigits={18} variant='subTitle' value={infoTx?.value_formatted || '0'} suffix={infoTx?.token_symbol ? ` ${infoTx.token_symbol}` : undefined} />
                </MyTextTicker>
              </View>
            ))}
          </View>
        </View>
      </View>
    </MyRowItem>
  )
}

export default HistoryItem
