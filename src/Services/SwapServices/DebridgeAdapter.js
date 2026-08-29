import BaseSwapService from './BaseSwapService'
import BaseAPI from 'controller/API/BaseAPI'
import {
  BRIDE_API,
  AFFILIATE_FEE_PERENT,
  AFFILIATE_FEE_RECIPIENT,
  REFERRAL_CODE
} from 'common/constants/app'
import { PLATFORM_EXCHANGE } from 'common/constants/swap'
import AllChainServices from 'controller/AllChainServices'
import { convertWeiToBalance, getAffiliateAddress, sleep } from 'common/function'
import { isEmpty } from 'lodash'
import Config from 'react-native-config'
import Keys from 'react-native-keys'
import { isNativeToken } from 'common/tokens'
import { encodeFunctionData, erc20Abi } from 'viem'
import { REDUX_KEY } from 'common/constants/redux'
import ReduxService from 'common/redux'

// deBridge DTOs wrap values as { stringValue, bigIntegerValue, Base64Value, numberValue, ... }
// extract the best string/number representation of the underlying value
const getDtoValue = (dto) => {
  if (dto == null) return null
  if (typeof dto === 'string' || typeof dto === 'number') return dto
  return dto.stringValue ?? dto.numberValue ?? dto.bigIntegerValue ?? dto.Base64Value ?? null
}

/**
 * deBridge Finance DLN adapter implementation
 */
export default class DebridgeAdapter extends BaseSwapService {
  constructor (config) {
    super(config)
    this.apiBaseUrl = config.apiBaseUrl || BRIDE_API.DLN_API
    this.apiTrackingBaseUrl = config.apiTrackingBaseUrl || BRIDE_API.DLN_API_TRACKING
    this.accessToken = config.accessToken || Keys.secureFor('DEBRIDGE_ACCESS_TOKEN')
  }

  getProviderName () {
    return PLATFORM_EXCHANGE.deBridge
  }

  hasIntegratedApproval () {
    return false // deBridge requires separate on-chain approval
  }

  getAffiliateFeeRecipient () {
    return this.affiliateFeeRecipient || AFFILIATE_FEE_RECIPIENT
  }

  generateTxApprove = async (spenderAddress, tokenAddress, amount, senderAddress, chainId) => {
    if (isNativeToken(tokenAddress)) {
      return null
    }

    const allowance = await AllChainServices.checkAllowance(chainId, tokenAddress, senderAddress, spenderAddress)
    if (BigInt(allowance) >= BigInt(amount)) {
      return null
    }

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddress, BigInt(amount)]
    })

    return {
      id: 'approve',
      items: [{
        data: {
          from: senderAddress,
          to: tokenAddress,
          data,
          chainId
        }
      }]
    }
  }

  getSettingAffiliate = async (chainId) => {
    // Prefer Redux cache (populated by useGetSettingExchange) to avoid repeated API calls on each getQuote.
    const dataLocal = ReduxService.getReduxDataByKey(REDUX_KEY.settingExchangeRedux)

    if (dataLocal) {
      const current = dataLocal?.[PLATFORM_EXCHANGE.deBridge]
      return {
        affiliateFeePercent: current?.affiliateFeePercentCustom?.[chainId] || current?.affiliateFeePercent || 0,
        affiliateFeeRecipient: current?.affiliateRecipientCustom?.[chainId] || dataLocal?.affiliateRecipientDefault || AFFILIATE_FEE_RECIPIENT,
        referralCode: current?.referralCode || REFERRAL_CODE
      }
    }

    // Fallback: Redux not yet populated — fetch API once.
    try {
      const params = {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        }
      }
      const res = await fetch(`${Config.EXCHANGE_API}/admin/setting?configs=others`, params)
      const responJson = await res.json()
      const settings = responJson?.others?.keyringV2
      let result = {
        affiliateFeePercent: AFFILIATE_FEE_PERENT,
        affiliateFeeRecipient: AFFILIATE_FEE_RECIPIENT,
        referralCode: REFERRAL_CODE
      }

      if (settings) {
        const current = settings?.[PLATFORM_EXCHANGE.deBridge]
        result = {
          affiliateFeePercent: current?.affiliateFeePercentCustom?.[chainId] || current?.affiliateFeePercent || 0,
          affiliateFeeRecipient: current?.affiliateRecipientCustom?.[chainId] || settings?.affiliateRecipientDefault || AFFILIATE_FEE_RECIPIENT,
          referralCode: current?.referralCode || REFERRAL_CODE
        }
      }

      return result
    } catch (e) {
      return {
        affiliateFeePercent: AFFILIATE_FEE_PERENT,
        affiliateFeeRecipient: AFFILIATE_FEE_RECIPIENT,
        referralCode: REFERRAL_CODE
      }
    }
  }

  /**
   * Get quote for same-chain swap or cross-chain bridge
   */
  async getQuote (params) {
    const {
      srcChainId,
      srcTokenAddress,
      srcTokenAmount,
      dstChainId,
      dstTokenAddress,
      recipientAddress,
      senderAddress,
      slippage,
      isCrossChain,
      tradeType
    } = params

    const { affiliateFeePercent, affiliateFeeRecipient, referralCode } = await this.getSettingAffiliate(srcChainId)
    let isHasAffiliate = false

    this.affiliateFeePercent = affiliateFeePercent
    this.affiliateFeeRecipient = affiliateFeeRecipient
    this.referralCode = referralCode

    if (Number(this.affiliateFeePercent?.toString() || '0') > 0) {
      isHasAffiliate = true
    }

    try {
      // TH1
      if (isCrossChain || (srcChainId !== dstChainId)) {
        const affiliateProps = isHasAffiliate
          ? {
            affiliateFeePercent: this.affiliateFeePercent,
            affiliateFeeRecipient: this.affiliateFeeRecipient
          }
          : {}
        // Cross-chain bridge
        const bridgeParams = {
          srcChainId,
          srcChainTokenIn: srcTokenAddress,
          srcChainTokenInAmount: srcTokenAmount,
          dstChainId,
          dstChainTokenOut: dstTokenAddress,
          dstChainTokenOutRecipient: recipientAddress,
          srcChainOrderAuthorityAddress: senderAddress,
          dstChainOrderAuthorityAddress: recipientAddress,
          referralCode: this.referralCode || REFERRAL_CODE,
          accesstoken: this.accessToken,
          srcChainRefundAddress: senderAddress,
          // Option: Sender or Recipient to paid fee when swap cross-chain
          // if prependOperatingExpenses is true => paid by Sender
          // if prependOperatingExpenses is false => paid by Recipient
          prependOperatingExpenses: false,
          ...affiliateProps
        }

        if (tradeType === 'EXACT_INPUT') {
          bridgeParams.srcChainTokenInAmount = srcTokenAmount
        } else {
          bridgeParams.srcChainTokenInAmount = 'auto'
          bridgeParams.dstChainTokenOutAmount = srcTokenAmount
        }

        const res = await BaseAPI.getDataDebridge(
          `${this.apiBaseUrl}/v1.0/dln/order/create-tx`,
          bridgeParams,
          true,
          null,
          true
        )

        if (res?.error || res?.errorMessage) {
          return {
            success: false,
            error: res?.error || res?.errorMessage,
            errorMessage: res.error?.errorMessage || res?.errorMessage
          }
        }

        const approveStep = await this.generateTxApprove(
          res.tx.to,
          res.estimation.srcChainTokenIn.address,
          res.estimation.srcChainTokenIn.amount,
          senderAddress,
          srcChainId
        )

        return {
          success: true,
          provider: PLATFORM_EXCHANGE.deBridge,
          estimation: res.estimation,
          tx: res.tx,
          order: res.order,
          orderId: res.orderId,
          fixFee: res.fixFee,
          protocolFee: res.protocolFee,
          prependedOperations: res.prependedOperations,
          estimatedTransactionFee: res.estimatedTransactionFee,
          protocolFeeApproximateUsdValue: res.protocolFeeApproximateUsdValue,
          usdPriceImpact: res.usdPriceImpact,
          userPoints: res.userPoints,
          integratorPoints: res.integratorPoints,
          tokenIn: res.estimation?.srcChainTokenIn,
          tokenOut: res.estimation?.dstChainTokenOut,
          costsDetails: res.estimation?.costsDetails,
          recommendedSlippage: res.estimation?.recommendedSlippage,
          slippage: res.estimation?.recommendedSlippage,
          isCrossChain: true,
          srcChainId,
          dstChainId,
          approveStep,
          hasApprovalStep: !!approveStep
        }
      } else {
        // TH2
        let affiliateProps = {}

        if (isHasAffiliate) {
          affiliateProps = {
            affiliateFeePercent: this.affiliateFeePercent || AFFILIATE_FEE_PERENT,
            affiliateFeeRecipient: this.affiliateFeeRecipient || getAffiliateAddress(srcChainId)
          }
        }

        // Same-chain swap
        const swapParams = {
          chainId: srcChainId,
          tokenIn: srcTokenAddress,
          slippage,
          tokenOut: dstTokenAddress,
          tokenOutRecipient: recipientAddress,
          accesstoken: this.accessToken,
          referralCode: this.referralCode,
          ...affiliateProps
        }

        if (tradeType === 'EXACT_INPUT') {
          swapParams.tokenInAmount = srcTokenAmount
        } else {
          swapParams.tokenInAmount = 'auto'
          swapParams.tokenOutAmount = srcTokenAmount
        }

        const res = await BaseAPI.getDataDebridge(
          `${this.apiBaseUrl}/v1.0/chain/transaction`,
          swapParams,
          true,
          null,
          true
        )

        if (res?.error || res?.errorMessage) {
          return {
            success: false,
            error: res?.error || res?.errorMessage,
            errorMessage: res.error?.errorMessage || res?.errorMessage
          }
        }

        const approveStep = await this.generateTxApprove(
          res.tx.to,
          res.tokenIn.address,
          res.tokenIn.amount,
          senderAddress,
          srcChainId
        )

        return {
          success: true,
          provider: PLATFORM_EXCHANGE.deBridge,
          estimation: {
            srcChainTokenIn: res.tokenIn,
            dstChainTokenOut: res.tokenOut,
            costsDetails: res.costsDetails,
            recommendedSlippage: res.recommendedSlippage
          },
          tokenIn: res.tokenIn,
          tokenOut: res.tokenOut,
          tx: res.tx,
          slippage: res.slippage,
          recommendedSlippage: res.recommendedSlippage,
          protocolFee: res.protocolFee,
          estimatedTransactionFee: res.estimatedTransactionFee,
          costsDetails: res.costsDetails,
          isCrossChain: false,
          srcChainId,
          dstChainId: srcChainId,
          approveStep,
          hasApprovalStep: !!approveStep
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error,
        errorMessage: error.message || 'Failed to fetch quote'
      }
    }
  }

  /**
   * Check if token approval is needed (on-chain check)
   * Reuses generateTxApprove logic to avoid duplicate allowance checks
   */
  async checkApproval (params) {
    const {
      chain,
      userAddress,
      tokenAddress,
      amount,
      quoteData
    } = params

    try {
      const contractAddress = quoteData?.tx?.to

      if (!contractAddress) {
        return {
          isNeeded: false,
          error: 'No contract address found in quote'
        }
      }

      if (isNativeToken(tokenAddress)) {
        return {
          isNeeded: false,
          contractAddress,
          approvalData: null
        }
      }

      const allowance = await AllChainServices.checkAllowance(chain, tokenAddress, userAddress, contractAddress)
      const isNeeded = BigInt(allowance) < BigInt(amount)

      return {
        isNeeded,
        contractAddress,
        approvalData: null // deBridge doesn't provide approval data in quote
      }
    } catch (error) {
      return {
        isNeeded: false,
        error: error.message
      }
    }
  }

  /**
   * Execute swap/bridge transaction
   * For deBridge, approval must be done separately before calling this
   */
  async executeSwap (params) {
    const {
      quoteData
    } = params

    try {
      // deBridge execution is handled in the confirmation popup
      // This is a wrapper that returns the necessary transaction data
      return {
        success: true,
        provider: 'debridge',
        txData: quoteData.tx,
        estimation: quoteData.estimation,
        order: quoteData.order,
        prependedOperations: quoteData.prependedOperations
      }
    } catch (error) {
      // console.log('DebridgeAdapter executeSwap error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get order IDs from transaction hash
   */
  async getOrderId (hash) {
    try {
      const orderInfo = await BaseAPI.getDataDebridge(
        `${this.apiBaseUrl}/v1.0/dln/tx/${hash}/order-ids?accesstoken=${this.accessToken}`,
        null,
        true
      )
      if (!orderInfo?.orderIds || orderInfo.orderIds.length === 0) {
        await sleep(2000)
        return this.getOrderId(hash)
      }
      return orderInfo.orderIds[0]
    } catch (error) {
      return null
    }
  }

  async trackTransaction (orderId) {
    const orderStatusRes = await BaseAPI.getDataDebridge(
      `${this.apiBaseUrl}/v1.0/dln/order/${orderId}/status?accesstoken=${this.accessToken}`,
      null,
      true
    )

    const status = orderStatusRes?.status.toUpperCase()
    // None, Created, Fulfilled, SentUnlock, OrderCancelled, SentOrderCancel, ClaimedUnlock, ClaimedOrderCancel

    let formatStatus = status
    switch (status) {
      case 'FULFILLED':
      case 'SENTUNLOCK':
      case 'CLAIMEDUNLOCK':
        formatStatus = 'COMPLETED'
        break
      case 'ORDERCANCELLED':
      case 'SENTORDERCANCEL':
      case 'CLAIMEDORDERCANCEL':
        formatStatus = 'FAILED'
        break
      case 'NONE':
      case 'CREATED':
      default:
        formatStatus = 'PENDING'
        break
    }

    return {
      success: true,
      status: formatStatus
    }
  }

  convertChainIdByDeBridge (chainId) {
    const dataLocal = ReduxService.getReduxDataByKey(REDUX_KEY.settingExchangeRedux)

    // convert  chainId to chainId debridge support
    if (dataLocal?.chainSupport) {
      const chain = dataLocal.chainSupport.find(c => c.chainId?.toString() === chainId?.toString())

      if (chain?.[`chainId_${PLATFORM_EXCHANGE.deBridge}`]) {
        return chain?.[`chainId_${PLATFORM_EXCHANGE.deBridge}`]
      }
    }

    return chainId
  }

  async getInfoDetailTx (params, maxDuration = 60000) {
    try {
      const pollInterval = 2000
      const hash = params?.hash
      const isCrossChain = params?.isCrossChain || false
      const chainId = params?.chainId

      // Optional callback (`params.isCancelled`) so the caller can abort the poll the
      // moment the UI that owns it is gone (e.g. drawer closed). Checked before every
      // request and during every sleep, so the loop stops almost immediately.
      const isCancelled = params?.isCancelled
      const isPollCancelled = () => typeof isCancelled === 'function' && isCancelled()

      const startTime = Date.now()
      let res = null
      let resData = null

      // Poll every 2s until the receipt is ready, up to maxDuration (default 60s)
      while (!res && Date.now() - startTime < maxDuration) {
        if (isPollCancelled()) {
          return { data: null, status: 'CANCELLED' }
        }

        resData = isCrossChain
          ? await BaseAPI.getDataDebridge(
            `${this.apiTrackingBaseUrl}/api/Orders/creationTxHash/${hash}?accesstoken=${this.accessToken}`,
            null,
            true
          )
          : await BaseAPI.getDataDebridge(
            `${this.apiTrackingBaseUrl}/api/SameChainSwap/${this.convertChainIdByDeBridge(chainId)}/tx/${hash}?accesstoken=${this.accessToken}`,
            null,
            true
          )

        if (resData && !isEmpty(resData) && !resData?.errorCode) {
          res = Array.isArray(resData) ? resData[0] : resData
        }

        // sleep 2s after each request when the result is not ready yet
        if (!res) {
          if (!await this.sleepCancellable(pollInterval, isCancelled)) {
            return { data: null, status: 'CANCELLED' }
          }
        }
      }

      if (isPollCancelled()) {
        return { data: null, status: 'CANCELLED' }
      }

      if (!res) {
        if (resData?.errorCode) {
          return { data: null, status: 'FAILED' }
        }
        return { data: null, status: 'COMPLETED' }
      }

      // requestId is the orderId (cross-chain) or swapId (same-chain)
      res.requestId = isCrossChain ? getDtoValue(res?.orderId) : getDtoValue(res?.swapId)

      const status = isCrossChain ? this.getStatusFromState(res?.state) : 'COMPLETED'
      if (status === 'FAILED') {
        return { data: null, status: 'FAILED' }
      }

      return {
        data: isCrossChain
          ? await this.formatCrossChainToRequest(res)
          : await this.formatSameChainToRequest(res),
        status
      }
    } catch (error) {
      return {
        error: error.message,
        status: 'FAILED'
      }
    }
  }

  getStatusFromState (state) {
    const formatStatus = (state || '').toUpperCase()
    if (formatStatus === 'ORDERCANCELLED' || formatStatus === 'SENTORDERCANCEL' || formatStatus === 'CLAIMEDORDERCANCEL') {
      return 'FAILED'
    }
    return 'COMPLETED'
  }

  async formatCurrencyToRelay (tokenDto, chainIdFallback = null) {
    const address = getDtoValue(tokenDto?.tokenAddress)
    const amount = getDtoValue(tokenDto?.amount)
    const meta = tokenDto?.metadata || {}
    const decimals = meta.decimals ?? tokenDto?.decimals ?? 18
    const chainId = Number(getDtoValue(tokenDto?.chainId) || chainIdFallback) || null

    return {
      currency: {
        chainId,
        address,
        decimals,
        symbol: meta.symbol ?? tokenDto?.symbol ?? null,
        name: meta.name ?? tokenDto?.name ?? null,
        logoURI: meta.logoURI ?? tokenDto?.logoURI ?? null,
        metadata: {
          isNative: isNativeToken(address, chainId)
        }
      },
      amount: amount ? amount.toString() : '0',
      amountFormatted: convertWeiToBalance(amount || 0, decimals),
      finalAmount: getDtoValue(tokenDto?.finalAmount)
    }
  }

  async formatCrossChainToRequest (resCrossChain) {
    const giveOffer = resCrossChain?.giveOfferWithMetadata || {}
    const takeOffer = resCrossChain?.takeOfferWithMetadata || {}
    const chainIdIn = Number(getDtoValue(giveOffer.chainId)) || null
    const chainIdOut = Number(getDtoValue(takeOffer.chainId)) || null

    const currencyIn = await this.formatCurrencyToRelay(giveOffer, chainIdIn)
    const currencyOut = await this.formatCurrencyToRelay(takeOffer, chainIdOut)

    return {
      id: getDtoValue(resCrossChain?.orderId),
      requestId: resCrossChain?.requestId || getDtoValue(resCrossChain?.orderId),
      user: getDtoValue(resCrossChain?.makerSrc),
      recipient: getDtoValue(resCrossChain?.receiverDst),
      sender: getDtoValue(resCrossChain?.givePatchAuthoritySrc) || getDtoValue(resCrossChain?.makerSrc),
      refundTo: getDtoValue(resCrossChain?.allowedCancelBeneficiarySrc),
      supersededByRequestId: null,
      depositAddress: null,
      data: {
        slippageTolerance: null,
        status: resCrossChain?.state,
        metadata: {
          currencyIn,
          currencyOut
        },
        route: {
          actual: {
            origin: {
              inputCurrency: currencyIn
            },
            destination: {
              outputCurrency: currencyOut
            }
          }
        }
      },
      protocol: {
        orderId: getDtoValue(resCrossChain?.orderId),
        hubType: 'onchain',
        isWithdrawable: resCrossChain?.externalCallState === 'AwaitingOrderFulfillment',
        taker: getDtoValue(resCrossChain?.taker)
      },
      requestType: 'createOrder',
      features: [],
      createdAt: resCrossChain?.createdSrcEventMetadata?.blockTimeStamp ?? null,
      updatedAt: resCrossChain?.fulfilledDstEventMetadata?.blockTimeStamp ?? null
    }
  }

  async formatSameChainToRequest (resSameChain) {
    const chainId = Number(getDtoValue(resSameChain?.chainId)) || null
    const currencyIn = await this.formatCurrencyToRelay(resSameChain?.tokenIn, chainId)
    const currencyOut = await this.formatCurrencyToRelay(resSameChain?.tokenOut, chainId)

    return {
      id: getDtoValue(resSameChain?.swapId),
      requestId: resSameChain?.requestId || getDtoValue(resSameChain?.swapId),
      user: getDtoValue(resSameChain?.sender),
      recipient: getDtoValue(resSameChain?.recipient),
      sender: getDtoValue(resSameChain?.sender),
      refundTo: null,
      supersededByRequestId: null,
      depositAddress: null,
      data: {
        slippageTolerance: null,
        status: 'Completed',
        metadata: {
          currencyIn,
          currencyOut
        },
        route: {
          actual: {
            origin: {
              inputCurrency: currencyIn
            },
            destination: {
              outputCurrency: currencyOut
            }
          }
        }
      },
      protocol: {
        swapId: getDtoValue(resSameChain?.swapId),
        hubType: 'samechain',
        isWithdrawable: true,
        chainId
      },
      requestType: 'sameChainSwap',
      features: [],
      createdAt: resSameChain?.blockTimeStamp ?? null,
      updatedAt: resSameChain?.blockTimeStamp ?? null
    }
  }
}
