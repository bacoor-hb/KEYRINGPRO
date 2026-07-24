import { View, TouchableOpacity, StyleSheet } from 'react-native'
import React from 'react'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { Colors, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import BigNumber from 'bignumber.js'
import MyText from 'frontend/Components/UI/MyText'
import MyBalance from 'frontend/Components/UI/MyBalance'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import images from 'assets/Image'
import { zeroAddress } from 'viem'
import { isNativeToken } from 'common/tokens'

const MAX_DECIMAL_PRICE = 6
const MAX_DECIMAL_BALANCE = 5
const MAX_DECIMAL_2USD = 2

const styles = StyleSheet.create({
  containerToken: {
    display: 'flex',
    flexDirection: 'row',
    gap: pixelByWidth(12),
    alignItems: 'center'
  },
  containerInfo: {
    borderBottomWidth: 1,
    paddingVertical: pixelByHeight(9),
    borderBottomColor: Colors.BG_BOX_SMALL
  }

})

const Token = ({ token, onPress, isSearch = false }) => {
  const renderPercentChange24h = () => {
    const price = BigNumber(token?.price_change_percentage_24h || token?.priceChange24hPct || 0).toNumber()
    const isPriceUp = BigNumber(price).gte(0)
    return (
      <MyText className={isPriceUp ? 'text-green' : 'text-red'}>
        {isPriceUp ? '+' : ''}
        <MyBalance fractionDigits={2} value={price} className={isPriceUp ? 'text-green' : 'text-red'} />
        %
      </MyText>
    )
  }

  const renderUSD = () => {
    if (isSearch && (token?.price || token?.priceUSD)) {
      return (
        <MyText fontWeight={700}>
          {' '}{' '}<FiatBalance fractionDigits={MAX_DECIMAL_PRICE} valueUSD={token?.price || token?.priceUSD} fontWeight={700} />
        </MyText>
      )
    }
    const totalToUSD = new BigNumber(token?.totalToUSD || 0)

    if (totalToUSD.gt(0)) {
      return (
        <MyText fontWeight={700}>
          {' '}{' '}<FiatBalance fractionDigits={MAX_DECIMAL_2USD} valueUSD={totalToUSD.toString()} fontWeight={700} />
        </MyText>
      )
    }

    return null
  }

  const renderBalance = () => {
    const balance = new BigNumber(token?.balanceFormatted || token?.balance || 0)
    if (balance.gt(0)) {
      return (
        <MyText className='  text-medium'>
          <MyBalance fractionDigits={MAX_DECIMAL_BALANCE} value={balance.toString()} className='  text-medium' />
          {' '}{token?.symbol}
        </MyText>
      )
    }
    return null
  }

  const renderAddress = () => {
    let address = token?.address || token?.contractAddress || zeroAddress
    if (isNativeToken(address)) {
      address = zeroAddress
    }
    const prefixLength = 6
    const suffixLength = 6
    return (
      <MyText numberOfLines={1} className='text-medium'>
        {`${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`}
      </MyText>
    )
  }

  return (
    <TouchableOpacity onPress={() => onPress(token)} activeOpacity={1} style={styles.containerToken}>
      <View style={{ width: getSizeImgSquare('large') }} className='rounded-full relative overflow-hidden'>

        <View style={{ position: 'relative', backgroundColor: Colors.BG_ICON_NO_BG }}>

          <MyIcon timeOutLoading={3000} uri={token?.icon_image || token?.logoURI || token?.metadata?.logoURI || token?.iconUrl || images.UIV2.icons.noTokenOutExchange} uriDefault={images.UIV2.icons.unknowToken} variant='large' />

        </View>
      </View>
      <View style={styles.containerInfo} className='flex-1 flex flex-col'>
        <View className='flex   flex-row items-baseline justify-between '>
          <View style={{ flex: 1 }}>
            <MyTextTicker style={{ flex: 1 }} variant='subTitle'>
              {token?.name || ''}
            </MyTextTicker>
          </View>

          {renderUSD()}

        </View>
        <View className='flex flex-row items-baseline justify-between '>
          {
            isSearch && renderAddress()
          }
          {renderPercentChange24h()}
          {!isSearch && renderBalance()}
        </View>
      </View>

    </TouchableOpacity>
  )
}

export default Token
