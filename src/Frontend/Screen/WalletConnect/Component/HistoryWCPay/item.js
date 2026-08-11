import { View, TouchableOpacity } from 'react-native'
import React, { useMemo } from 'react'
import createStyles from './styles'
import MyText from 'frontend/Components/UI/MyText'
import I18n from 'assets/Lang'
import { handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'
import moment from 'moment'
import { convertWeiToBalance } from 'common/function'
import MyBalance from 'frontend/Components/UI/MyBalance'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import BigNumber from 'bignumber.js'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import { pixelByHeight } from 'common/styles'

const HistoryWCPayItem = ({ item, isFirst, isLast }) => {
  const styles = createStyles()
  const resultHash = item?.resultHash

  const iconToken = useMemo(() => {
    if (item?.optionPaid) {
      return item?.optionPaid?.token?.iconUrl
    } else {
      return resultHash?.info?.optionAmount?.display?.iconUrl
    }
  }, [resultHash, item])

  const handleViewHash = () => {
    if (resultHash?.info?.txId) {
      handleOpenExplorerHash(resultHash?.info?.txId, item.chainId)
    }
  }

  const getAmountPaid = () => {
    const options = item.optionsPayments[0]
    if (item?.optionPaid) {
      const amountWei = item?.optionPaid?.token?.value
      const decimals = item?.optionPaid?.token?.decimals

      return convertWeiToBalance(amountWei, decimals)
    } else {
      if (options) {
        const amountWei = options?.amount?.value
        const decimals = options?.amount?.display?.decimals

        return convertWeiToBalance(amountWei, decimals)
      }
    }

    return BigNumber(item?.info?.amount?.value || '0').div(100).toString()
  }

  const getNameBusiness = () => {
    let name = item?.info?.merchant?.name || I18n.t('v2.walletConnect.noName')
    name = name.replace(' Test Merchant', '')
    name = name.replace(' test merchant', '')
    return name
  }

  const getTimeStamp = () => {
    if (item.block_timestamp) {
      return moment(item.block_timestamp).format('DD/MM/YYYY HH:mm')
    }

    // time expired in 15 minutes:
    // NOTE: *1000 =>convert second to milliseconds
    // NOTE: - 15 * 60 * 1000 =>subtract 15 minutes from the expiration time
    if (item?.info?.expiresAt) {
      return moment(item?.info?.expiresAt * 1000 - 15 * 60 * 1000).format('DD/MM/YYYY HH:mm')
    }

    return moment().format('DD/MM/YYYY HH:mm')
  }

  return (
    <MyRowItem
      noPadding
    >
      <View style={[styles.container, isFirst && { paddingTop: pixelByHeight(0) }]}>
        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.timeStamp')}</MyText>
          <MyText>{getTimeStamp()}</MyText>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('v2.walletConnect.businessName')}</MyText>
          <MyTextTicker className='uppercase'>{getNameBusiness()}</MyTextTicker>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>TXH</MyText>
          <TouchableOpacity onPress={handleViewHash} activeOpacity={0.9}>
            <MyText className='text-brand'>{resultHash?.info?.txId || I18n.t('v2.walletConnect.noHash')}</MyText>
          </TouchableOpacity>
        </View>
        <View style={styles.itemRow}>
          <MyText className='text-low'>To</MyText>
          <TouchableOpacity onPress={() => handleOpenExplorerUserAddress(item.toAddress, item.chainId)} activeOpacity={0.9}>
            <MyText className='text-brand'>{item.toAddress}</MyText>
          </TouchableOpacity>
        </View>

        <View style={styles.itemRow}>
          <MyText className='text-low'>{I18n.t('TxTransferHistoryScreen.value')}</MyText>
          <View style={styles.valueRow}>
            <TokenIconWithChain tokenIconUri={iconToken} chainId={item.chainId} />
            <View
              style={{
                flex: 1
              }}>
              <MyBalance
                ticker
                fontWeight={700}
                variant='subTitle'
                fractionDigits={18}
                value={getAmountPaid()} />
            </View>

          </View>
        </View>
      </View>
    </MyRowItem>
  )
}

export default HistoryWCPayItem
