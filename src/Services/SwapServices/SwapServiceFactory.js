import DebridgeAdapter from './DebridgeAdapter'
import RelayAdapter from './RelayAdapter'
import { SWAP_SERVICE_CONFIG } from 'common/constants/app'
import { PLATFORM_EXCHANGE } from 'common/constants/swap'
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
   * @param {Array} [chainSupport] - Chain support data from settingExchange (each chain has bridgeProvider array)
   * @returns {BaseSwapService} The active swap service
   */
  async getService (bridgeProvider = null) {
    // Return cached instance if available
    if (this.serviceInstances[bridgeProvider]) {
      return this.serviceInstances[bridgeProvider]
    }

    // Create new instance
    const service = this.createService(bridgeProvider)

    this.serviceInstances[bridgeProvider] = service

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
      case PLATFORM_EXCHANGE.deBridge:
        return new DebridgeAdapter(config)

      case PLATFORM_EXCHANGE.relay:
        return new RelayAdapter(config)

      default:
        return new RelayAdapter(config)
    }
  }

  /**
   * Get the name of the provider based on chainIds from Redux config
   * @param {number} srcChainId - The source chain ID to check
   * @param {number} dstChainId - The destination chain ID to check (optional)
   * @param {Array} [chainSupport] - Chain support data from settingExchange (each chain has bridgeProvider array)
   * @returns {string} Provider name ('debridge' or 'relay')
   */
  async getActiveProvider (srcChainId = null, dstChainId = null, chainSupport = null) {
    // Use chainSupport from settingExchange if provided — find a provider that supports BOTH chains
    if (chainSupport?.length > 0 && srcChainId != null && dstChainId != null) {
      const srcChain = chainSupport.find(c =>
        c.chainId?.toString() === srcChainId?.toString()
      )
      const dstChain = chainSupport.find(c =>
        c.chainId?.toString() === dstChainId?.toString()
      )

      if (srcChain?.bridgeProvider?.length > 0 && dstChain?.bridgeProvider?.length > 0) {
        const commonProviders = srcChain.bridgeProvider.filter(p =>
          dstChain.bridgeProvider.includes(p)
        )
        if (commonProviders.length > 0) {
          const provider = commonProviders[0]
          return provider
        }
      }
    }

    // Fall back to API-based config
    const result = await BaseAPI.getApiSettingByKey('keyring_EXCHANGE_PROVIDER')
    let configExchangeProvider = result?.keyring_EXCHANGE_PROVIDER
    const typeofConfig = typeof configExchangeProvider
    if (typeofConfig !== 'object' && !!typeofConfig) {
      configExchangeProvider = JSON.parse(configExchangeProvider)
    }

    if (!srcChainId || Object.keys(configExchangeProvider).length === 0) {
      return 'debridge'
    }

    const destinationChainId = dstChainId || srcChainId

    for (const [providerName, providerConfig] of Object.entries(configExchangeProvider)) {
      if (providerConfig.chainIds && Array.isArray(providerConfig.chainIds)) {
        const supportsSrcChain = providerConfig.chainIds.includes(srcChainId)
        const supportsDstChain = providerConfig.chainIds.includes(destinationChainId)

        if (supportsSrcChain && supportsDstChain) {
          return providerName
        }
      }
    }

    return 'debridge'
  }

  /**
   * Check if a specific provider is active for a chainId
   * @param {string} providerName - Provider name to check
   * @param {number} srcChainId - The source chain ID to check
   * @param {number} dstChainId - The destination chain ID to check (optional)
   * @returns {boolean}
   */
  async isProviderActive (providerName, srcChainId = null, dstChainId = null, chainSupport = null) {
    const activeProvider = await this.getActiveProvider(srcChainId, dstChainId, chainSupport)
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
