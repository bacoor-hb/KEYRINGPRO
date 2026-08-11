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
import { getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import BtnBack from 'frontend/Components/UI/BtnBack'
import SwapAndSendSubmit from '../SwapAndSendSubmit'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import ReduxService from 'common/redux'
import { REDUX_KEY } from 'common/constants/redux'
import { AI_SEARCH_SESSION } from 'common/aiSearchHistory'

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

  // Open AI Search on the Swap-and-send session. Nothing is sent: the screen
  // opens on this session's own root pills ("What are cross-chain gas charges?" /
  // "Why add gas for cross-chain?" — see getRootSuggestions), and the user picks
  // the question themselves rather than arriving mid-answer.
  const askAi = () => {
    NavigationActions.navigate(NAME_SCREEN.aiSearch, {
      address: ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)?.account?.address,
      sessionKey: AI_SEARCH_SESSION.swapAndSend
    })
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
        <View style={{ gap: pixelByHeight(14), paddingTop: pixelByHeight(8), paddingBottom: getSafeAreaValues().bottom }}>
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
              <MyText variant='subTitle' fontWeight={700}>{tokenOut?.symbol}</MyText>
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
          <View style={styles.line} />

          <View style={{ gap: pixelByHeight(8) }}>
            <View style={styles.containerSubTitle}>
              <MyText variant='subTitle' fontWeight={700}>{I18n.t('v2.swapAndSend.whatIsSwapAndSend')}</MyText>
            </View>
            <View>

              <MyRowItem
                onPress={() => askAi()}
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
                    {/* The button sits inside the row's own touchable, and its
                        TouchableOpacity captures the tap — so it needs the same
                        handler explicitly, otherwise pressing the button itself
                        does nothing. */}
                    <MyButton
                      noMinWidth
                      style={{ height: pixelByHeight(28) }}
                      onPress={() => askAi()}
                    >
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
