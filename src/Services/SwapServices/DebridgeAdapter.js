import BaseSwapService from './BaseSwapService'
import BaseAPI from 'controller/API/BaseAPI'
import {
  BRIDE_API,
  AFFILIATE_FEE_PERENT,
  AFFILIATE_FEE_RECIPIENT,
  REFERRAL_CODE
} from 'common/constants/app'
import AllChainServices from 'controller/AllChainServices'
import { getAffiliateAddress } from 'common/function'
import { isEmpty } from 'lodash'
import Config from 'react-native-config'
import Keys from 'react-native-keys'

/**
 * deBridge Finance DLN adapter implementation
 */
export default class DebridgeAdapter extends BaseSwapService {
  constructor (config) {
    super(config)
    this.apiBaseUrl = config.apiBaseUrl || BRIDE_API.DLN_API
    this.accessToken = config.accessToken || Keys.secureFor('DEBRIDGE_ACCESS_TOKEN')
  }

  getProviderName () {
    return 'deBridge'
  }

  hasIntegratedApproval () {
    return false // deBridge requires separate on-chain approval
  }

   getSettingAffiliate = async () => {
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
       if (responJson && responJson?.others) {
         return {
           affiliateFeePercent: responJson?.others?.AFFILIATE_FEE_PERENT || AFFILIATE_FEE_PERENT,
           affiliateFeeRecipient: responJson?.others?.affiliateRecipient || AFFILIATE_FEE_RECIPIENT,
           referralCode: responJson?.others?.REFERRAL_CODE || REFERRAL_CODE,
           AFFILIATE_FEE_RECIPIENT: responJson?.others?.AFFILIATE_FEE_RECIPIENT || AFFILIATE_FEE_RECIPIENT
         }
       }
     } catch (e) {
       return {
         affiliateFeePercent: AFFILIATE_FEE_PERENT,
         affiliateFeeRecipient: AFFILIATE_FEE_RECIPIENT,
         referralCode: REFERRAL_CODE,
         AFFILIATE_FEE_RECIPIENT: AFFILIATE_FEE_RECIPIENT
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
       isHasAffiliate
     } = params

     if (isHasAffiliate && (isEmpty(this.affiliateFeePercent) || isEmpty(this.affiliateRecipientInfo) || isEmpty(this.referralCode))) {
       const { affiliateFeePercent, affiliateFeeRecipient, referralCode } = await this.getSettingAffiliate()

       const affiliateRecipientInfo = affiliateFeeRecipient && JSON.parse(affiliateFeeRecipient)
       this.affiliateFeePercent = affiliateFeePercent
       this.affiliateRecipientInfo = affiliateRecipientInfo
       this.referralCode = referralCode
     }

     try {
       if (isCrossChain || (srcChainId !== dstChainId)) {
         const affiliateProps = isHasAffiliate
           ? {
             affiliateFeePercent: this.affiliateFeePercent || AFFILIATE_FEE_PERENT,
             affiliateFeeRecipient: this.affiliateRecipientInfo?.[srcChainId] || getAffiliateAddress(srcChainId)
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
           ...affiliateProps
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

         return {
           success: true,
           provider: 'debridge',
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
           isCrossChain: true,
           srcChainId,
           dstChainId
         }
       } else {
         let affiliateProps = {}

         if (isHasAffiliate) {
           affiliateProps = {
             affiliateFeePercent: this.affiliateFeePercent || AFFILIATE_FEE_PERENT,
             affiliateFeeRecipient: this.affiliateRecipientInfo?.[srcChainId] || getAffiliateAddress(srcChainId)
           }
         }

         // Same-chain swap
         const swapParams = {
           chainId: srcChainId,
           tokenIn: srcTokenAddress,
           tokenInAmount: srcTokenAmount,
           slippage,
           tokenOut: dstTokenAddress,
           tokenOutRecipient: recipientAddress,
           accesstoken: this.accessToken,
           ...affiliateProps
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

         return {
           success: true,
           provider: 'debridge',
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
           dstChainId: srcChainId
         }
       }
     } catch (error) {
       // console.log('DebridgeAdapter getQuote error:', error)
       return {
         success: false,
         error: error,
         errorMessage: error.message || 'Failed to fetch quote'
       }
     }
   }

   /**
   * Check if token approval is needed (on-chain check)
   */
   async checkApproval (params) {
     const {
       chain,
       userAddress,
       tokenAddress,
       amount,
       tokenDecimals,
       quoteData
     } = params

     try {
       // Get contract address from quote data
       const contractAddress = quoteData?.tx?.to

       if (!contractAddress) {
         return {
           isNeeded: false,
           error: 'No contract address found in quote'
         }
       }

       const isNeeded = await AllChainServices.checkIsNeedApproveToken(
         chain,
         userAddress,
         tokenAddress,
         contractAddress,
         amount,
         tokenDecimals
       )

       return {
         isNeeded,
         contractAddress,
         approvalData: null // deBridge doesn't provide approval data in quote
       }
     } catch (error) {
       // console.log('DebridgeAdapter checkApproval error:', error)
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
   * Track cross-chain bridge transaction status
   */
   async trackTransaction (params) {
     const { requestIdOrTxHash } = params
     try {
       // Get order IDs from transaction hash
       const orderInfo = await BaseAPI.getDataDebridge(
         `${this.apiBaseUrl}/v1.0/dln/tx/${requestIdOrTxHash}/order-ids?accesstoken=${this.accessToken}`,
         null,
         true
       )

       if (!orderInfo?.orderIds || orderInfo.orderIds.length === 0) {
         return {
           success: false,
           status: 'PENDING',
           message: 'Order not found yet'
         }
       }

       const orderId = orderInfo.orderIds[0]

       // Get order status
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
     } catch (error) {
       // console.log('DebridgeAdapter trackTransaction error:', error)
       return {
         success: false,
         error: error.message,
         status: 'ERROR'
       }
     }
   }

   getAffiliateFeeRecipient () {
     return AFFILIATE_FEE_RECIPIENT
   }
}
