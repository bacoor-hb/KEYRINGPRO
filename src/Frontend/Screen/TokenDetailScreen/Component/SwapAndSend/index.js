import { View, TouchableOpacity } from 'react-native'
import React from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import MyIcon from 'frontend/Components/UI/MyIcon'
import createStyles from './styles'
import { getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import BtnBack from 'frontend/Components/UI/BtnBack'
import SwapAndSendSubmit from '../SwapAndSendSubmit'

const SwapAndSend = ({ _this }) => {
  const {
    state,
    handleSelectTokenOut,
    handleSelectChain
  } = _this

  const {
    tokenOut,
    tokenIn,
    chainOut
  } = state.swapAndSend

  const chainIdOut = chainOut?.chainId || tokenIn?.chainId
  const styles = createStyles()

  const askAi = (message, useNfcInfo) => {

  }

  const handleOpenSubmit = () => {
    _this.openDrawer({
      children: <SwapAndSendSubmit _this={_this} />
    })
  }

  return (
    <MyViewPage isUseDrawer style={{ flex: 1 }}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('v2.swapAndSend.title')}
        leftIcon={images.UIV2.icons.swapAndSend}
        rightElement={
          !!tokenOut && <BtnBack onPress={handleOpenSubmit} isToNext />
        }

      />
      <ScrollViewBlurHeader isUseDrawer>
        <View style={{ gap: pixelByHeight(14), paddingTop: pixelByHeight(8) }}>
          <MyRowItem
            containerContentStyle={{ paddingVertical: 8 }}
            lefIcon={(
              <TokenIconWithChain
                chainId={chainIdOut}
                chainIconUrl={chainOut?.iconUrl}
                tokenIconUri={
                  tokenOut?.icon_image ||
                  tokenOut?.logoURI ||
                  tokenOut?.metadata?.logoURI ||
                  tokenOut?.iconUrl ||
                  images.UIV2.icons.noTokenOutExchange
                }
              />
            )}
            bottomContent={
              <MyText className='text-medium'>{I18n.t('v2.swapAndSend.selectTokenNetwork')}</MyText>
            }
          >
            <View className='flex items-center flex-row justify-between'>
              <MyText variant='subTitle' fontWeight={700}>ETH</MyText>
              <View className='flex items-center flex-row' style={{ gap: pixelByWidth(14) }}>
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.btnOption}
                  onPress={() => handleSelectChain(false, () => {})}>
                  <MyIcon uri={images.UIV2.icons.network} variant='small' />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={1}
                  style={styles.btnOption}
                  onPress={() => handleSelectTokenOut(false)}>
                  <MyIcon uri={images.UIV2.icons.home.token} variant='small' />
                </TouchableOpacity>
              </View>
            </View>

          </MyRowItem>

          <View style={{ gap: pixelByHeight(8) }}>
            <MyText variant='subTitle' fontWeight={700}>{I18n.t('v2.swapAndSend.whatIsSwapAndSend')}</MyText>
            <View>

              <MyRowItem
                onPress={() => askAi(I18n.t('NFC.whatIsNfcTag'), true)}
                lefIcon={(
                  <View className='flex items-center' style={{ width: getSizeImgSquare('large') }}>
                    <MyIcon uri={images.UIV2.icons.idea} />
                  </View>
                )}
                bottomContent={
                  <MyText className='text-low'>{I18n.t('v2.swapAndSend.addGasChargesDesc')}</MyText>
                }
              >
                <View className='flex items-center flex-row justify-between'>
                  <MyText className='text-medium'>{I18n.t('v2.swapAndSend.addGasCharges')}</MyText>
                  <View>
                    <MyButton noMinWidth style={{ height: pixelByHeight(28) }}>
                      <MyIcon style={{ width: sizeImageSquare(35), height: sizeImageSquare(17) }} uri={images.UIV2.icons.btnAiChat} />

                    </MyButton>
                  </View>
                </View>
              </MyRowItem>

              <MyRowItem
                lefIcon={(
                  <View className='flex items-center' style={{ width: getSizeImgSquare('large') }}>
                    <MyIcon uri={images.UIV2.icons.idea} />
                  </View>
                )}
                bottomContent={
                  <MyText className='text-low'>{I18n.t('v2.swapAndSend.doneInOneStepDesc')}</MyText>
                }
              >
                <MyText className='text-medium'>{I18n.t('v2.swapAndSend.doneInOneStep')}</MyText>
              </MyRowItem>
            </View>
          </View>

        </View>
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default SwapAndSend
