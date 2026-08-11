import BigNumber from 'bignumber.js'
import BaseSwapService from './BaseSwapService'
import { AFFILIATE_FEE_PERENT, AFFILIATE_FEE_RECIPIENT, NULL_ADDRESS } from 'common/constants/app'
import { isEmpty } from 'lodash'
import { isAddress } from 'viem'
import AllChainServices from 'controller/AllChainServices'
import { sleep } from 'common/function'
import Config from 'react-native-config'

// Key filter all data in relay
const REFERRER_KEY = 'bacoor.io'

const convertChainId = (chainId) => {
  if (chainId === 7565164) {
    return 792703809
  }
  return chainId
}

async function formatFees (fees, srcChainId, currencyIn) {
  const result = {}
  const priceCurrencyIn = BigNumber(currencyIn.amountUsd).dividedBy(currencyIn.amountFormatted).toFixed()

  Object.entries(fees).forEach(async ([key, item]) => {
    // Skip native gas fees
    if (key === 'gas' || key === 'relayerGas' || key === 'relayerService' || key === 'subsidized') return

    let symbol = item.currency?.symbol

    let amount = BigNumber(item.amountFormatted || 0)

    if (!symbol || amount.isZero()) return

    if (key === 'app' || key === 'relayer') {
      if (currencyIn?.currency.symbol?.toLowerCase() !== item.currency?.symbol.toLowerCase()) {
        if (isAddress(currencyIn?.currency?.address) && currencyIn?.currency?.address !== NULL_ADDRESS) {
          symbol = await AllChainServices.getTokenSymbol(srcChainId, currencyIn?.currency?.address)
        }
        symbol = symbol || currencyIn?.currency?.symbol

        amount = BigNumber(item.amountUsd).dividedBy(priceCurrencyIn)
        result[symbol] = BigNumber(result[symbol] || 0).plus(amount || 0).toFixed()
        return
      }
    }

    result[symbol] = BigNumber(result[symbol] || 0).plus(amount || 0).toFixed()
  })

  return result
}

/**
 * Relay.link adapter implementation
 * Relay provides integrated approval handling in the quote
 */
export default class RelayAdapter extends BaseSwapService {
  constructor (config) {
    super(config)
    this.apiBaseUrl = config.apiBaseUrl || Config.RELAY_API
    this.apiKey = config.apiKey
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
           AFFILIATE_FEE_PERCENT: responJson?.others?.RELAY_AFFILIATE_FEE_PERCENT || responJson?.others?.AFFILIATE_FEE_PERENT || AFFILIATE_FEE_PERENT,
           AFFILIATE_FEE_RECIPIENT: responJson?.others?.RELAY_AFFILIATE_FEE_RECIPIENT || responJson?.others?.AFFILIATE_FEE_RECIPIENT || AFFILIATE_FEE_RECIPIENT
         }
       }
     } catch (e) {
       return {
         AFFILIATE_FEE_PERCENT: AFFILIATE_FEE_PERENT,
         AFFILIATE_FEE_RECIPIENT: AFFILIATE_FEE_RECIPIENT
       }
     }
   }

   getProviderName () {
     return 'Relay'
   }

   hasIntegratedApproval () {
     return true // Relay includes approval in quote transaction
   }

   /**
   * Get quote for swap/bridge via Relay
   * Relay API Reference: https://docs.relay.link/references/api
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
       isHasAffiliate = false,
       tradeType = 'EXACT_INPUT'
     } = params

     try {
       if (isHasAffiliate && (isEmpty(this.affiliateFeePercent) || isEmpty(this.affiliateFeeRecipient))) {
         const { AFFILIATE_FEE_RECIPIENT, AFFILIATE_FEE_PERCENT } = await this.getSettingAffiliate()
         this.affiliateFeeRecipient = AFFILIATE_FEE_RECIPIENT
         this.affiliateFeePercent = AFFILIATE_FEE_PERCENT
       }

       // Relay uses /quote/v2 endpoint for both same-chain and cross-chain
       const quoteParams = {
         user: senderAddress,
         originChainId: convertChainId(srcChainId),
         destinationChainId: convertChainId(dstChainId),
         originCurrency: srcTokenAddress,
         destinationCurrency: dstTokenAddress,
         amount: srcTokenAmount,
         recipient: recipientAddress || senderAddress,
         referrer: REFERRER_KEY, // this is a any referrer text or domain string
         tradeType,
         appFees: isHasAffiliate ? [{
           recipient: this.affiliateFeeRecipient || AFFILIATE_FEE_RECIPIENT,
           fee: Math.floor(this.affiliateFeePercent * 100) || AFFILIATE_FEE_PERENT
         }] : []
       }

       // Add slippage if provided (in basis points: 1% = 100)
       if (slippage) {
         quoteParams.slippageTolerance = Math.floor(slippage * 100).toString()
       }

       const headers = {
         'content-type': 'application/json'
       }
       if (this.apiKey) {
         headers['x-api-key'] = this.apiKey
       }

       // Make POST request to /quote/v2
       const res = await this._makeRelayRequest('/quote/v2', quoteParams, headers, 'POST')

       if (!res || res.error) {
         return {
           success: false,
           error: res?.error || 'Unknown error',
           errorMessage: res?.message || 'Failed to fetch quote from Relay'
         }
       }

       // Relay response structure:
       // {
       //   steps: [
       //     { id: "approve", items: [{ data: { from, to, data, value, chainId, ... } }] },
       //     { id: "swap", items: [{ data: { ... }, check: { endpoint, method } }] }
       //     // OR
       //     { id: "deposit", items: [{ data: { ... }, check: { endpoint, method } }] } // when input is native token
       //   ],
       //   fees: { gas, relayer, relayerGas, relayerService, app },
       //   details: { currencyIn, currencyOut, rate, timeEstimate, ... }
       // }

       // Find approve and swap/deposit steps
       const approveStep = res.steps?.find(step => step.id === 'approve')
       const swapStep = res.steps?.find(step => step.id === 'swap' || step.id === 'deposit')

       // Extract transaction data from swap/deposit step
       const swapTxData = swapStep?.items?.[0]?.data

       // Check if this is a Solana transaction (has instructions array)
       const isSolanaTransaction = swapTxData?.instructions && Array.isArray(swapTxData.instructions)

       // Map to format compatible with existing code
       return {
         success: true,
         provider: 'relay',

         // Keep original Relay format
         steps: res.steps,
         fees: res.fees,
         details: res.details,

         // Map to deBridge-compatible format for backward compatibility
         tx: swapTxData ? (isSolanaTransaction ? {
           // For Solana: pass through instructions and lookup tables
           data: {
             instructions: swapTxData.instructions,
             addressLookupTableAddresses: swapTxData.addressLookupTableAddresses || []
           },
           chainId: swapTxData.chainId
         } : {
           // For EVM: standard transaction format
           from: swapTxData.from,
           to: swapTxData.to,
           data: swapTxData.data,
           value: swapTxData.value,
           chainId: swapTxData.chainId,
           maxFeePerGas: swapTxData.maxFeePerGas,
           maxPriorityFeePerGas: swapTxData.maxPriorityFeePerGas,
           gas: swapTxData.gas
         }) : null,

         estimation: {
           srcChainTokenIn: {
             address: res.details?.currencyIn?.currency?.address,
             symbol: res.details?.currencyIn?.currency?.symbol,
             decimals: res.details?.currencyIn?.currency?.decimals,
             amount: res.details?.currencyIn?.amount,
             // USD value straight from the quote — authoritative, avoids mismatched
             // per-token price sources on the client.
             amountUsd: res.details?.currencyIn?.amountUsd
           },
           dstChainTokenOut: {
             address: res.details?.currencyOut?.currency?.address,
             symbol: res.details?.currencyOut?.currency?.symbol,
             decimals: res.details?.currencyOut?.currency?.decimals,
             amount: res.details?.currencyOut?.amount,
             minAmount: res.details?.currencyOut?.minimumAmount,
             amountUsd: res.details?.currencyOut?.amountUsd
           }
         },

         // Additional fields
         tokenIn: {
           address: res.details?.currencyIn?.currency?.address,
           symbol: res.details?.currencyIn?.currency?.symbol,
           decimals: res.details?.currencyIn?.currency?.decimals,
           amount: res.details?.currencyIn?.amount
         },
         tokenOut: {
           address: res.details?.currencyOut?.currency?.address,
           symbol: res.details?.currencyOut?.currency?.symbol,
           decimals: res.details?.currencyOut?.currency?.decimals,
           amount: res.details?.currencyOut?.amount,
           minAmount: res.details?.currencyOut?.minimumAmount
         },

         // Approval data
         approveStep: approveStep,
         hasApprovalStep: !!approveStep,

         isCrossChain: srcChainId !== dstChainId,
         srcChainId,
         dstChainId,

         // Keep raw response for advanced usage
         rawResponse: {
           ...res,
           requestId: swapStep.requestId
         },
         feeResponseQuote: await formatFees(res.fees, srcChainId, res.details?.currencyIn)
       }
     } catch (error) {
       // console.log('RelayAdapter getQuote error:', error)
       return {
         success: false,
         error: error,
         errorMessage: error.message || 'Failed to fetch quote'
       }
     }
   }

   /**
   * Check if approval is needed
   * For Relay, check if quote has approval step
   */
   async checkApproval (params) {
     const { quoteData } = params

     try {
       if (!quoteData) {
         return {
           isNeeded: false,
           error: 'Invalid quote data'
         }
       }

       // Check if quote has approval step
       const hasApprovalStep = quoteData.hasApprovalStep || false
       const approveStep = quoteData.approveStep

       if (hasApprovalStep && approveStep) {
         const approvalTxData = approveStep.items?.[0]?.data

         return {
           isNeeded: true,
           integrated: true, // Relay has integrated approval
           approvalData: approvalTxData,
           approvalStep: approveStep,
           contractAddress: approvalTxData?.to,
           message: 'Approval step is included in quote, will be executed first'
         }
       }

       return {
         isNeeded: false,
         integrated: true,
         message: 'No approval needed or already approved'
       }
     } catch (error) {
       // console.log('RelayAdapter checkApproval error:', error)
       return {
         isNeeded: false,
         error: error.message
       }
     }
   }

   /**
   * Execute swap/bridge transaction
   * For Relay, execute all steps in the quote
   */
   async executeSwap (params) {
     const {
       quoteData
     } = params

     try {
       if (!quoteData || !quoteData.steps) {
         return {
           success: false,
           error: 'Invalid quote data'
         }
       }

       // Relay execution logic will be implemented in the confirmation popup
       // This method provides the transaction steps
       return {
         success: true,
         provider: 'relay',
         steps: quoteData.steps,
         fees: quoteData.fees,
         details: quoteData.details,
         estimation: quoteData.estimation
       }
     } catch (error) {
       // console.log('RelayAdapter executeSwap error:', error)
       return {
         success: false,
         error: error.message
       }
     }
   }

   /**
   * Track transaction status
   * Relay tracking endpoint: GET /intents/status/v3?requestId=<requestId>
   */
   async trackTransaction (params) {
     const { requestIdOrTxHash } = params

     try {
       const requestId = requestIdOrTxHash

       // Relay tracking endpoint
       const res = await this._makeRelayRequest('/intents/status/v3', {
         requestId: requestId
       }, {}, 'GET')

       // Map Relay status to standard status
       let mappedStatus = 'PENDING'
       if (res.status === 'success' || res.status === 'refunded') {
         mappedStatus = 'COMPLETED'
       } else if (res.status === 'waiting' || res.status === 'pending' || res.status === 'delayed' || res.status === 'submitted') {
         mappedStatus = 'PENDING'
       } else if (res.status === 'failure' || res.status === 'expired') {
         mappedStatus = 'FAILED'
       }

       return {
         success: true,
         status: mappedStatus
       }
     } catch (error) {
       // console.log('RelayAdapter trackTransaction error:', error)
       return {
         success: false,
         error: error.message,
         status: 'ERROR'
       }
     }
   }

   /**
   * Helper method to make Relay API requests
   */
   async _makeRelayRequest (endpoint, params, headers = {}, method = 'POST') {
     const url = `${this.apiBaseUrl}${endpoint}`

     const options = {
       method: method,
       headers: {
         'Content-Type': 'application/json',
         ...headers
       }
     }

     // Add body for POST requests
     if (method === 'POST' && params) {
       options.body = JSON.stringify(params)
     } else if (method === 'GET' && params) {
       // Build query string for GET requests
       const queryString = Object.keys(params)
         .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
         .join('&')
       const fullUrl = `${url}?${queryString}`

       const response = await fetch(fullUrl, options)
       if (!response.ok) {
         const errorData = await response.json().catch(() => ({}))
         throw new Error(errorData.message || `HTTP ${response.status}`)
       }
       return response.json()
     }

     const response = await fetch(url, options)

     if (!response.ok) {
       const errorData = await response.json().catch(() => ({}))
       throw new Error(errorData.message || `HTTP ${response.status}`)
     }

     return response.json()
   }

   /**
   * Execute a single transaction step from Relay quote
   */
   async executeStep (stepData) {
     try {
       // This will be called from the confirmation popup
       // to execute each step in the Relay quote
       return {
         success: true,
         stepData
       }
     } catch (error) {
       // console.log('RelayAdapter executeStep error:', error)
       return {
         success: false,
         error: error.message
       }
     }
   }

   async indexingTransactions (requestId, chainId, hash, rawTransaction = {}) {
     try {
       const rawTxFormat = {
         ...rawTransaction,
         txHash: hash
       }

       delete rawTxFormat.noEstimateGas

       await Promise.allSettled([
         this._makeRelayRequest('/transactions/index', {
           chainId: `${chainId}`,
           txHash: hash
         }, {}, 'POST'),
         this._makeRelayRequest('/transactions/single', {
           requestId: requestId,
           chainId: `${chainId}`,
           referrer: REFERRER_KEY,
           tx: JSON.stringify(rawTxFormat)
         }, {}, 'POST')
       ])
     } catch (error) {
       // Silent catch
     }
   }

   async getInfoDetailTx (params, maxRequestAgain = 3, requestAgainStatus = 30) {
     try {
       const pollInterval = 1500

       const requestId = params?.requestId || params?.id
       const chainId = params?.chainId
       const hash = params?.hash
       const rawTransactionApi = params?.rawTransactionApi

       // indexing transaction when first call
       if (maxRequestAgain === 3 && requestAgainStatus === 30) {
         await this.indexingTransactions(requestId, chainId, hash, rawTransactionApi)
       }

       // Tracking transaction status when it is pending: 1 minutes
       if (requestId && requestAgainStatus > 0) {
         let requestAgain = requestAgainStatus
         let trackResult = await this.trackTransaction({ requestIdOrTxHash: requestId })
         let status = trackResult?.status

         while (status === 'PENDING' && requestAgain >= 0) {
           // sleep 2s when request again is small
           await sleep(pollInterval + 500)
           trackResult = await this.trackTransaction({ requestIdOrTxHash: requestId })
           status = trackResult?.status
           requestAgain--
         }

         if (status === 'FAILED') {
           return { data: null, status: 'FAILED' }
         }
       }
       await sleep(pollInterval)

       const res = await this._makeRelayRequest('/requests/v2', { hash }, {}, 'GET')
       let data = res?.requests || null

       if (!data || (Array.isArray(data) && data.length === 0)) {
         if (maxRequestAgain >= 0) {
           await sleep(pollInterval)
           return this.getInfoDetailTx(params, maxRequestAgain - 1, 0)
         }
         return { data: null, status: 'COMPLETED' }
       }

       if (Array.isArray(data) && data.length > 0) {
         data = data[0]
       }

       return {
         data,
         status: 'COMPLETED'
       }
     } catch (error) {
       return {
         error: error.message,
         status: 'FAILED'
       }
     }
   }
}
