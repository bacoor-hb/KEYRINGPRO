import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { isArray, isEmpty } from 'lodash'
import BigNumber from 'bignumber.js'
import Clipboard from '@react-native-clipboard/clipboard'
import { formatNameFunctionWC, convertAddressArrToString } from 'common/function'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import MyText from 'frontend/Components/UI/MyText'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

// Transaction-detail drawer (the "?" on a request card). The data extraction is
// copied from the legacy InfoRequestDetail; only the UI is rebuilt to the new
// design (header + boxed sections: summary / Function / Hex / Decode Input data).
// Opened as a stacked drawer by WalletConnectRequestHost (no this.popup).
const RequestDetailDrawer = ({ request, _this }) => {
  const styles = createStyles()
  const params = request?.params ?? []
  const method = request?.contractMethodName
  const inputs = request?.inputs
  const names = request?.names
  const types = request?.types
  const strSubFunction = !isEmpty(names)
    ? names.map((item, index) => `${item} ${types[index]}`).join(', ')
    : ''

  const copy = (value, label) => {
    Clipboard.setString(value?.toString() || '')
    _this.showAlert(I18n.t('Initial.copyDone', { value: label }), '', { type: 'toast' })
  }

  // Format a decoded param value by its abi type (uint256 → decimal, address → 0x…).
  const formatDecodedValue = (value, type) => {
    switch (type) {
      case 'uint256':
        return value?.hex ? BigNumber(value?.hex).toString() : value?.toString()
      case 'address':
        if (value && value?.length === 40 && !value?.toString()?.startsWith('0x')) {
          return `0x${value?.toString()?.toLowerCase()}`
        }
        return value?.toString()
      default:
        return value?.hex ? BigNumber(value?.hex).toString() : (value?.toString() || '')
    }
  }

  const renderRow = (label, value, onPress) => (
    <View style={styles.rowBetween}>
      <MyText className='text-low'>{label}</MyText>
      <TouchableOpacity disabled={!onPress} activeOpacity={0.8} onPress={onPress}>
        <MyText className='text-medium' style={styles.rowValue} numberOfLines={1}>{value}</MyText>
      </TouchableOpacity>
    </View>
  )

  const hasDecode = !isEmpty(names) && !isEmpty(inputs) && !isEmpty(types)

  return (
    <MyViewPage isUseDrawer style={styles.container}>
      {/* Header */}
      <TitleDrawer
        absolute
        hasBlur
        leftIcon={images.UIV2.icons.dappTxInfo}
        title={I18n.t('Initial.manageRequests')}
      />

      <ScrollViewBlurHeader isUseDrawer style={styles.bodyScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Summary: From / Interact with / Transaction method */}
        <View style={styles.card} className='bg-input-field'>
          {renderRow('From', params[0]?.from && convertAddressArrToString([params[0]?.from]),
            () => copy(params[0]?.from, I18n.t('Initial.address')))}
          {renderRow(I18n.t('v2.walletConnect.interactWith'), params[0]?.to && convertAddressArrToString([params[0]?.to]),
            () => copy(params[0]?.to, I18n.t('Initial.address')))}
          {renderRow(I18n.t('v2.walletConnect.transactionMethod'), method ? formatNameFunctionWC(method) : I18n.t('Initial.unknow'))}
        </View>

        {/* Function signature */}
        <View style={styles.card} className='bg-input-field'>
          <MyText className='text-low'>{I18n.t('v2.walletConnect.func')}</MyText>
          <MyText className='text-medium'>{method ? `${method}( ${strSubFunction} )` : 'Unknown'}</MyText>
        </View>

        {/* Raw hex */}
        <View style={styles.card} className='bg-input-field'>
          <MyText className='text-low'>Hex</MyText>
          <TouchableOpacity activeOpacity={0.8} onPress={() => copy(params[0]?.data, 'Hex')}>
            <MyText className='text-medium'>{params[0]?.data}</MyText>
          </TouchableOpacity>
        </View>

        {/* Decoded input params */}
        {hasDecode && (
          <View style={styles.card} className='bg-input-field'>
            <MyText className='text-low'>{I18n.t('v2.walletConnect.decodeInputData')}</MyText>
            {names.map((name, index) => {
              const value = formatDecodedValue(inputs[index], types[index])
              return (
                <View key={index} style={styles.decodeItem}>
                  <MyText className='text-low'>{name}</MyText>
                  {isArray(value)
                    ? value.map((v, i) => <MyText key={i} className='text-medium'>{v?.toString()}</MyText>)
                    : (
                      <TouchableOpacity activeOpacity={0.8} onPress={() => copy(value, name)}>
                        <MyText className='text-medium'>{value?.toString()}</MyText>
                      </TouchableOpacity>
                    )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollViewBlurHeader>
    </MyViewPage>
  )
}

export default RequestDetailDrawer
