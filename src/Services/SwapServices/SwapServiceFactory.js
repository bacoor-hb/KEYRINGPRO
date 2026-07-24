import DebridgeAdapter from './DebridgeAdapter'
import RelayAdapter from './RelayAdapter'
import { SWAP_SERVICE_CONFIG } from 'common/constants/app'
import BaseAPI from 'controller/API/BaseAPI'

/**
 * Factory for creating swap service instances
 * Determines which provider to use based on chainId configuration from Redux
 */
class SwapServiceFactory {
  constructor () {
    this.currentService = null
    this.serviceInstances = {}
  }

  /**
   * Get the active swap service instance based on chainId
   * @param {number} srcChainId - The source chain ID
   * @param {number} dstChainId - The destination chain ID (optional for same-chain swaps)
   * @returns {BaseSwapService} The active swap service
   */
  async getService (srcChainId = null, dstChainId = null) {
    const activeProvider = await this.getActiveProvider(srcChainId, dstChainId)

    // Return cached instance if available
    if (this.serviceInstances[activeProvider]) {
      return this.serviceInstances[activeProvider]
    }

    // Create new instance
    const service = this.createService(activeProvider)
    this.serviceInstances[activeProvider] = service

    return service
  }

  /**
   * Create a service instance for the specified provider
   * @param {string} providerName - Provider name ('debridge' or 'relay')
   * @returns {BaseSwapService} Service instance
   */
  createService (providerName) {
    const config = SWAP_SERVICE_CONFIG.providers[providerName]

    if (!config) {
      throw new Error(`Unknown swap provider: ${providerName}`)
    }

    switch (providerName) {
      case 'debridge':
        return new DebridgeAdapter(config)

      case 'relay':
        return new RelayAdapter(config)

      default:
        return new DebridgeAdapter(config)
    }
  }

  /**
   * Get the name of the provider based on chainIds from Redux config
   * @param {number} sourceChainId - The source chain ID to check
   * @param {number} dstChainId - The destination chain ID to check (optional)
   * @returns {string} Provider name ('debridge' or 'relay')
   */
  async getActiveProvider (srcChainId = null, dstChainId = null) {
    // Get config from API
    const result = await BaseAPI.getApiSettingByKey('keyring_EXCHANGE_PROVIDER')
    let configExchangeProvider = result?.keyring_EXCHANGE_PROVIDER
    const typeofConfig = typeof configExchangeProvider
    if (typeofConfig !== 'object' && !!typeofConfig) {
      configExchangeProvider = JSON.parse(configExchangeProvider)
    }
    return 'relay'

    // // If no chainId provided or no config, default to debridge
    // if (!sourceChainId || Object.keys(configExchangeProvider).length === 0) {
    //   return 'debridge'
    // }

    // // For same-chain swaps, use dstChainId = srcChainId
    // const destinationChainId = dstChainId || sourceChainId
    // const isCrossChain = sourceChainId !== destinationChainId

    // // Check which provider supports BOTH chains (for cross-chain) or single chain (for same-chain)
    // for (const [providerName, providerConfig] of Object.entries(configExchangeProvider)) {
    //   if (providerConfig.chainIds && Array.isArray(providerConfig.chainIds)) {
    //     const supportsSrcChain = providerConfig.chainIds.includes(sourceChainId)
    //     const supportsDstChain = providerConfig.chainIds.includes(destinationChainId)

    //     // Provider must support both chains
    //     if (supportsSrcChain && supportsDstChain) {
    //       if (isCrossChain) {
    //         console.log(`🚀 ~ SwapServiceFactory ~ Using provider "${providerName}" for cross-chain swap: ${sourceChainId} → ${destinationChainId}`)
    //       } else {
    //         console.log(`🚀 ~ SwapServiceFactory ~ Using provider "${providerName}" for same-chain swap on chainId ${sourceChainId}`)
    //       }
    //       return providerName
    //     }
    //   }
    // }

    // // Default to debridge if no match found
    // console.log(`🚀 ~ SwapServiceFactory ~ No provider found supporting both chains (${sourceChainId} → ${destinationChainId}), defaulting to "debridge"`)
    // return 'debridge'
  }

  /**
   * Check if a specific provider is active for a chainId
   * @param {string} providerName - Provider name to check
   * @param {number} srcChainId - The source chain ID to check
   * @param {number} dstChainId - The destination chain ID to check (optional)
   * @returns {boolean}
   */
  async isProviderActive (providerName, srcChainId = null, dstChainId = null) {
    const activeProvider = await this.getActiveProvider(srcChainId, dstChainId)
    return activeProvider === providerName
  }

  /**
   * Get list of all available providers
   * @returns {Array<string>} Array of provider names
   */
  getAvailableProviders () {
    return Object.keys(SWAP_SERVICE_CONFIG.providers)
  }

  /**
   * Get supported chainIds for a specific provider
   * @param {string} providerName - Provider name
   * @returns {Array<number>} Array of chain IDs
   */
  async getSupportedChainIds (providerName) {
    const result = await BaseAPI.getApiSettingByKey('keyring_EXCHANGE_PROVIDER')
    let configExchangeProvider = result?.keyring_EXCHANGE_PROVIDER
    const typeofConfig = typeof configExchangeProvider
    if (typeofConfig !== 'object' && !!typeofConfig) {
      configExchangeProvider = JSON.parse(configExchangeProvider)
    }
    const providerConfig = configExchangeProvider[providerName]

    if (providerConfig && providerConfig.chainIds) {
      return providerConfig.chainIds
    }

    return []
  }

  /**
   * Clear cached service instances
   */
  clearCache () {
    this.serviceInstances = {}
    this.currentService = null
  }
}

// Export singleton instance
export default new SwapServiceFactory()
