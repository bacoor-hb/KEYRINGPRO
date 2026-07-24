/**
 * Base abstract class for swap/bridge service providers
 * All swap service adapters must implement these methods
 */
export default class BaseSwapService {
  constructor (config) {
    if (this.constructor === BaseSwapService) {
      throw new Error('BaseSwapService is abstract and cannot be instantiated directly')
    }
    this.config = config
  }

  /**
   * Get swap/bridge quote
   * @param {Object} params - Quote parameters
   * @param {string} params.srcChainId - Source chain ID
   * @param {string} params.srcTokenAddress - Source token address
   * @param {string} params.srcTokenAmount - Source token amount in wei
   * @param {string} params.dstChainId - Destination chain ID
   * @param {string} params.dstTokenAddress - Destination token address
   * @param {string} params.recipientAddress - Recipient address
   * @param {string} params.senderAddress - Sender address
   * @param {number} params.slippage - Slippage percentage (e.g., 1 for 1%)
   * @param {boolean} params.isCrossChain - Whether it's a cross-chain swap
   * @returns {Promise<Object>} Quote data including estimated output, tx data, approval info
   */
  async getQuote (params) {
    throw new Error('getQuote() must be implemented by subclass')
  }

  /**
   * Check if token approval is needed
   * @param {Object} params - Approval check parameters
   * @param {string} params.chain - Chain identifier
   * @param {string} params.userAddress - User's wallet address
   * @param {string} params.tokenAddress - Token contract address
   * @param {string} params.amount - Amount to approve
   * @param {number} params.tokenDecimals - Token decimals
   * @param {Object} params.quoteData - Quote data that may contain approval info
   * @returns {Promise<Object>} { isNeeded: boolean, approvalData: Object }
   */
  async checkApproval (params) {
    throw new Error('checkApproval() must be implemented by subclass')
  }

  /**
   * Execute the swap/bridge transaction
   * @param {Object} params - Execution parameters
   * @param {Object} params.quoteData - Quote data from getQuote()
   * @param {string} params.privateKey - User's private key
   * @param {Function} params.onProgress - Progress callback
   * @returns {Promise<Object>} Transaction result
   */
  async executeSwap (params) {
    throw new Error('executeSwap() must be implemented by subclass')
  }

  /**
   * Track transaction status (for cross-chain bridges)
   * @param {Object} params - Tracking parameters
   * @param {string} params.txHash - Transaction hash
   * @param {string} params.srcChainId - Source chain ID
   * @param {string} params.dstChainId - Destination chain ID
   * @returns {Promise<Object>} Status information
   */
  async trackTransaction (params) {
    throw new Error('trackTransaction() must be implemented by subclass')
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getProviderName () {
    throw new Error('getProviderName() must be implemented by subclass')
  }

  /**
   * Check if provider supports approval in quote (no separate approval step needed)
   * @returns {boolean}
   */
  hasIntegratedApproval () {
    return false
  }
}
