import { CHAIN_SUPPORT_PAY } from './constants/walletConnectPay'
import { getConnectorV2 } from './walletconnect'

class WalletConnectPay {
  static async isSupport () {
    try {
      const connectorV2 = await getConnectorV2()
      return !!connectorV2.pay
    } catch (error) {
      return false
    }
  }

  static getEpiAddress (address = []) {
    const result = []

    address.forEach(address => {
      Object.keys(CHAIN_SUPPORT_PAY).forEach(chainId => {
        result.push(`eip155:${chainId}:${address}`)
      })
    })
    return result
  }

  static async getPaymentOptions (paymentLink, address = []) {
    try {
      const connectorV2 = await getConnectorV2()
      const accounts = this.getEpiAddress(address)
      const options = await connectorV2.pay.getPaymentOptions({
        paymentLink,
        accounts,
        includePaymentInfo: true
      })
      return options
    } catch (error) {
      return []
    }
  }

  static async getRequiredPaymentActions (paymentId, optionId) {
    try {
      const connectorV2 = await getConnectorV2()
      const actions = await connectorV2.pay.getRequiredPaymentActions({
        paymentId,
        optionId
      })
      return actions
    } catch (error) {
      return []
    }
  }

  /**
   * Check if the payment actions contain an eth_sendTransaction — meaning the
   * user must perform that transaction themselves (the app does not auto-sign it).
   * @param {Array} actions - List of payment actions
   * @returns {boolean}
   */
  static hasSendTransactionAction (actions = []) {
    return actions?.some(action => action?.walletRpc?.method === 'eth_sendTransaction') || false
  }

  /**
   * Confirm payment
   * @param {string} paymentId
   * @param {string} optionId
   * @param {string[]} signatures
   * Example: ["0x"]
   * @param {object} collectedData
   * Example: {}
   * @returns {Promise<object>}
   */
  static async confirmPayment ({ paymentId, optionId, signatures, collectedData }) {
    const connectorV2 = await getConnectorV2()
    const actions = await connectorV2.pay.confirmPayment({
      paymentId,
      optionId,
      signatures,
      collectedData
    })
    return actions
  }
}

export default WalletConnectPay
