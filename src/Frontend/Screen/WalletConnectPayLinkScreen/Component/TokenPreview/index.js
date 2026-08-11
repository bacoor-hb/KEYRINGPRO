import { View, TouchableOpacity, ScrollView } from 'react-native'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import MyButton from 'frontend/Components/UI/MyButton'
import MyText from 'frontend/Components/UI/MyText'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyNumber from 'frontend/Components/UI/MyNumber'

import MyIcon from 'frontend/Components/UI/MyIcon'
import createStyles from './styles'
import { getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import { convertWeiToBalance, formatNumberBro } from 'common/function'
import { TYPE_STEP_PAYMENT } from '../..'
import { getNativeTokenSymbolByChain, getUrlExplorerHash, handleOpenExplorerHash } from 'common/chain'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import I18n from 'assets/Lang'
import Clipboard from '@react-native-clipboard/clipboard'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { getBalanceTokenByAddress } from '../../page'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import WalletConnectPay from 'common/walletConnectPay'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import AllChainServices from 'controller/AllChainServices'
import BigNumber from 'bignumber.js'
import { zeroAddress } from 'viem'
import { getAddressNative } from 'common/tokens'
import useGetBalanceToken from 'frontend/Hooks/useGetBalanceToken'
import { useSelector } from 'react-redux'
import useGetDecimalToken from 'frontend/Hooks/useGetDecimalToken'

const DECIMAL_SHOW_UI = 8

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

  const addressNative = useMemo(() => {
    return getAddressNative(chainId)
  }, [chainId])

  const { activeAccount } = useSelector(s => s)
  const { account } = activeAccount
  const nativeSymbol = getNativeTokenSymbolByChain(chainId)

  const { data: balanceNative, isLoading: loadingBalanceNative } = useGetBalanceToken(chainId, account?.address, addressNative)
  const { data: decimalNative, isLoading: loadingDecimalNative } = useGetDecimalToken(chainId, addressNative)

  const { data: tokenPrice, isLoading: loading } = useGetTokenPrice(chainId, infoTokens?.address)

  // For token not support EIP-3009: Transfer With Authorization
  // If the option requires the user to perform a transaction themselves
  const hasSendTransactionAction = WalletConnectPay.hasSendTransactionAction(option?.actions)
  const { data: nativePriceUSD } = useGetTokenPrice(chainId, zeroAddress)
  const [txFee, setTxFee] = useState(null)

  useEffect(() => {
    if (!hasSendTransactionAction) {
      setTxFee(null)
      return
    }
    let isMounted = true
    const estimateTxFee = async () => {
      try {
        const action = (option?.actions || []).find(a => a?.walletRpc?.method === 'eth_sendTransaction')
        const parsed = JSON.parse(action.walletRpc.params)
        const { to, from, data = '0x', value = '0x0', gas } = parsed[0]

        const client = ViemWeb3.getPublicClient(chainId)
        const gasLimit = gas
          ? BigInt(gas)
          : await client.estimateGas({ account: from, to, data, value: value ? BigInt(value) : 0n })
        const gasPrice = await client.getGasPrice()

        let l1Fee = 0
        if (Number(chainId) === 10) {
          try {
            l1Fee = (await AllChainServices.estimateL1DataFee(false, chainId, from, to)) || 0
          } catch (error) {
            l1Fee = 0
          }
        }

        if (isMounted) {
          setTxFee({
            gasLimit: gasLimit.toString(),
            gasPrice: gasPrice.toString(),
            l1Fee: String(l1Fee)
          })
        }
      } catch (error) {
        if (isMounted) {
          setTxFee(null)
        }
      }
    }
    estimateTxFee()
    return () => {
      isMounted = false
    }
  }, [hasSendTransactionAction, option, chainId])

  const txFeeInfo = useMemo(() => {
    if (!txFee || loadingBalanceNative || loadingDecimalNative) {
      return null
    }
    const feeWei = BigNumber(txFee.gasLimit).multipliedBy(txFee.gasPrice).plus(txFee.l1Fee).multipliedBy(1.5).toFixed(0)
    const feeNative = convertWeiToBalance(feeWei, 18)
    const feeFiat = BigNumber(feeNative || '0').multipliedBy(nativePriceUSD || 0).toNumber()
    const feeInsufficient = BigNumber(balanceNative || '0').isLessThan(feeNative || '0')
    const missingFee = feeInsufficient ? formatNumberBro(BigNumber(feeNative).minus(balanceNative).toString(), 8) : '0'
    return {
      feeWei,
      feeNative,
      feeFiat,
      feeInsufficient,
      missingFee
    }
  }, [txFee, loadingBalanceNative, loadingDecimalNative, balanceNative, nativePriceUSD])

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
        <MyButton isDisable={loadingBalanceNative || loadingDecimalNative || !!txFeeInfo?.feeInsufficient} label={I18n.t('v2.wcPay.pay')} size='small' variant='primary' onPress={handlePay} />
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

  const renderTransactionFee = () => {
    if (!txFee || loadingBalanceNative || loadingDecimalNative) {
      return <MyDotsLoading variant='default' />
    }

    return (
      <FiatBalance ticker className='text-medium' fractionDigits={DECIMAL_SHOW_UI} valueUSD={txFeeInfo.feeFiat} />

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
              !loadingBalanceNative && !loadingDecimalNative && hasSendTransactionAction && balanceNative && decimalNative && (
                <>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <MyText className='text-medium'>{I18n.t('v2.sendToken.nativeBalance', { symbol: nativeSymbol })}</MyText>
                    <MyNumber ticker className='text-medium' value={balanceNative} fractionDigits={DECIMAL_SHOW_UI} suffix={` ${nativeSymbol}`} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <MyText className='text-medium'>{I18n.t('v2.sendToken.transactionFee')}</MyText>
                    {renderTransactionFee()}
                  </View>
                  {
                    txFeeInfo?.feeInsufficient && (
                      <MyText variant='small' className='text-red'>
                        {I18n.t('Content.feeTokenNeed', { amount: txFeeInfo.missingFee, item: nativeSymbol })}
                      </MyText>
                    )
                  }

                </ >
              )
            }

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
            <View style={{ paddingTop: pixelByHeight(8), paddingBottom: getSafeAreaValues().bottom }}>
              <MyButton onPress={closeDrawer} className='w-full' variant='primary' label={I18n.t('Initial.done')} />
            </View>
          )
        }
        {
          step === TYPE_STEP_PAYMENT.error && (
            <View style={{ paddingTop: pixelByHeight(8), paddingBottom: getSafeAreaValues().bottom }}>
              <MyButton onPress={handlePay} className='w-full' variant='primary' label={I18n.t('MenuScreen.RestoreWalletScreen.tryAgain')} />
            </View>
          )
        }

      </View>

    </MyViewPage>
  )
}

export default TokenPreview
