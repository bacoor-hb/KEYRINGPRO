import { View, TouchableOpacity, ScrollView } from 'react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import MyButton from 'frontend/Components/UI/MyButton'
import MyText from 'frontend/Components/UI/MyText'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import MyBalance from 'frontend/Components/UI/MyBalance'

import MyIcon from 'frontend/Components/UI/MyIcon'
import createStyles from './styles'
import { pixelByHeight, pixelByWidth } from 'common/styles'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import { convertWeiToBalance } from 'common/function'
import { TYPE_STEP_PAYMENT } from '../..'
import { getUrlExplorerHash, handleOpenExplorerHash } from 'common/chain'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import I18n from 'assets/Lang'
import Clipboard from '@react-native-clipboard/clipboard'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { getBalanceTokenByAddress } from '../../page'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'

const TokenPreview = ({ _this, option }) => {
  const { handleSubmitPayment, state, closeDrawer, showAlert } = _this
  const { chainId } = state

  const infoTokens = useMemo(() => {
    const token = option.token
    const address = token.address

    const tokenOfUser = getBalanceTokenByAddress(address, chainId)
    return {
      ...token,
      tokenOfUser
    }
  }, [option, chainId])

  const { data: tokenPrice, isLoading: loading } = useGetTokenPrice(chainId, infoTokens?.address)

  const [step, setStep] = useState(TYPE_STEP_PAYMENT.idle)
  const [hash, setHash] = useState('')
  const styles = createStyles()
  const containerConfirmRef = useRef(null)

  useEffect(() => {
    if (containerConfirmRef.current) {
      containerConfirmRef.current.scrollToEnd({
        animated: true
      })
    }
  }, [step])

  const handleCopy = () => {
    if (!hash) return
    const linkScanHash = getUrlExplorerHash(hash, chainId)

    Clipboard.setString(linkScanHash)
    showAlert && showAlert(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), '', { type: 'toast' })
  }

  const handleCallback = (type, data) => {
    if (type === TYPE_STEP_PAYMENT.success) {
      if (data?.info?.txId) {
        setHash(data?.info?.txId)
      }
    }
    setStep(type)
  }

  const handlePay = async () => {
    setStep(TYPE_STEP_PAYMENT.idle)
    await handleSubmitPayment(option, handleCallback)
  }

  const getExchangeRate = () => {
    try {
      return tokenPrice || '1'
    } catch (error) {
      return '0'
    }
  }

  const getTotalAmountPaid = () => {
    const value = convertWeiToBalance(infoTokens.value || '0', infoTokens?.decimals)

    return value
  }

  const renderRightContent = () => {
    if (step === TYPE_STEP_PAYMENT.idle) {
      return (
        <MyButton label={I18n.t('v2.wcPay.pay')} size='small' variant='primary' onPress={handlePay} />
      )
    }

    return null
  }

  const renderTitle = () => {
    return (
      <View style={{ flex: 1 }} className='flex flex-1 fex-col  '>
        <MyBalance variant='subTitle' fontWeight={700} value={getTotalAmountPaid()} fractionDigits={infoTokens?.decimals} />
        <View style={{ alignItems: 'center' }} className='flex flex-row gap-1 items-baseline'>
          <MyText className='text-low'>
            {I18n.t('v2.wcPay.exchangeRate')}
          </MyText>
          {
            loading ? (
              <View>
                <MyDotsLoading variant='default' />
              </View>
            ) : (
              <FiatBalance className='text-low' valueUSD={getExchangeRate()} />

            )
          }

        </View>
      </View>

    )
  }

  const renderLine = () => {
    return (
      <View style={styles.containerLine}>
        <View style={styles.line} />
      </View>
    )
  }

  const renderTxH = () => {
    return (
      <TouchableOpacity activeOpacity={(0.8)} onPress={() => handleOpenExplorerHash(hash, chainId)}>
        <MyText className=' text-brand'>
          {hash}
        </MyText>

      </TouchableOpacity>
    )
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('v2.wcPay.confirmation')}
        leftIcon={images.UIV2.icons.payConfirm}
        rightElement={renderRightContent()}
      />
      <MyText variant='subTitle' fontWeight={700} className='text-medium'>{I18n.t('v2.wcPay.paymentTokenQuantity')}</MyText>
      <View style={{ flex: 1 }}>
        <ScrollView ref={containerConfirmRef} showsVerticalScrollIndicator={false}>
          <MyRowItem
            noBorder
            lefIcon={<TokenIconWithChain chainId={chainId} tokenIconUri={infoTokens?.iconUrl} />}
          >
            {renderTitle()}
          </MyRowItem>

          <View style={{ gap: pixelByHeight(12) }}>
            {
              step > TYPE_STEP_PAYMENT.idle && (
                <MyActionRow
                  noBorder
                  leftElement={renderLine()}
                  title={I18n.t('v2.wcPay.approvePayment')}
                  titleClassName='font-medium'

                />
              )
            }

            {
              step > TYPE_STEP_PAYMENT.signing && (
                <MyActionRow
                  noBorder
                  leftElement={(
                    <TxStepIcon uri={images.UIV2.icons.payProcess} />
                  )}
                  title={(
                    <View style={{ gap: pixelByWidth(4) }} className='flex flex-row  items-center'>
                      <MyText fontWeight={700}>{I18n.t('v2.wcPay.paymentInProgress')}{' '}</MyText>
                      {step === TYPE_STEP_PAYMENT.trackingHash && <MyDotsLoading source={images.threeDotsWhiteLoading} />}
                    </View>
                  )}
                />
              )
            }

            {
              step > TYPE_STEP_PAYMENT.trackingHash && (
                <MyActionRow
                  noBorder
                  leftElement={renderLine()}
                  title={(
                    <View style={styles.containerTxh}>
                      <View style={{ flex: 1 }}>
                        {renderTxH()}
                      </View>
                      {
                        hash && (
                          <TouchableOpacity onPress={handleCopy} style={styles.containerCopy}>
                            <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
                          </TouchableOpacity>
                        )
                      }

                    </View>
                  )}

                />
              )
            }

            {
              step === TYPE_STEP_PAYMENT.success && (
                <StatusMessage
                  className='items-center'
                  variant='success'
                  title={I18n.t('Initial.success')}
                  titleConfig={{
                    className: 'text-green'
                  }}
                  style={{ alignItems: 'center', justifyContent: 'center', marginTop: pixelByHeight(2) }}
                />
              )
            }

            {
              step === TYPE_STEP_PAYMENT.error && (
                <StatusMessage
                  className='items-center'
                  variant='error'
                  title={I18n.t('v2.common.fail')}
                  message={I18n.t('Initial.WalletConnectPay.paymentFailed')}
                  titleConfig={{
                    className: 'text-red'
                  }}
                  style={{ alignItems: 'center', justifyContent: 'center', marginTop: pixelByHeight(12) }}
                />
              )
            }
          </View>

        </ScrollView>
        {
          step === TYPE_STEP_PAYMENT.success && (
            <View style={{ paddingTop: pixelByHeight(8) }}>
              <MyButton onPress={closeDrawer} className='w-full' variant='primary' label={I18n.t('Initial.done')} />
            </View>
          )
        }
        {
          step === TYPE_STEP_PAYMENT.error && (
            <View style={{ paddingTop: pixelByHeight(8) }}>
              <MyButton onPress={handlePay} className='w-full' variant='primary' label={I18n.t('MenuScreen.RestoreWalletScreen.tryAgain')} />
            </View>
          )
        }

      </View>

    </MyViewPage>
  )
}

export default TokenPreview
