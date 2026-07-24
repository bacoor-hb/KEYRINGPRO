import Config from 'react-native-config'
import { stringify } from 'query-string'
import KeysTurbo from 'react-native-keys'

export default class MoralisService {
  static async getTokenBalanceByWallet (walletAddress, blockchain, nextPageCursor, listBalanceFinal = []) {
    const params = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': KeysTurbo.secureFor('SERVICE_MORILIS_API_KEY')
      }
    }

    const query = {
      chain: blockchain,
      limit: 100,
      exclude_spam: false,
      exclude_unverified_contracts: false,
      exclude_native: false,
      cursor: nextPageCursor
    }

    try {
      const response = await (
        await (fetch(`${Config.SERVICE_MORALIS_API}/wallets/${walletAddress}/tokens?` + stringify(query), params))
      ).json()
      listBalanceFinal = listBalanceFinal.concat(response?.result || [])
      if (response?.cursor) {
        return this.getTokenBalanceByWallet(walletAddress, blockchain, response.cursor, listBalanceFinal)
      }
      return listBalanceFinal.map((item) => {
        return {
          blockchain,
          ...item
        }
      })
    } catch (error) {
      return []
    }
  }

  static async getFullTxHistoryOfWalletByChain (address, blockchain, apiQueryParams = {}, history = []) {
    if (!address || !blockchain) {
      return []
    }

    const params = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': KeysTurbo.secureFor('SERVICE_MORILIS_API_KEY')
      }
    }

    const query = {
      chain: blockchain,
      order: 'DESC',
      limit: 100,
      nft_metadata: false,
      include_internal_transactions: true,
      ...apiQueryParams
    }

    try {
      const response = await (
        await (fetch(`${Config.SERVICE_MORALIS_API}/wallets/${address}/history?` + stringify(query), params))
      ).json()
      history = history.concat(response?.result || [])
      if (response?.cursor) {
        return this.getFullTxHistoryOfWalletByChain(address, blockchain, { ...apiQueryParams, cursor: response.cursor }, history)
      }
      return history.map((item) => {
        return {
          blockchain,
          ...item
        }
      })
    } catch (error) {
      return []
    }
  }

  static async getHistoryByAddress (address, chain, options = {}) {
    if (!address || !chain) {
      return []
    }

    const params = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': KeysTurbo.secureFor('SERVICE_MORILIS_API_KEY')
      }
    }

    const query = {
      chain: chain,
      order: 'DESC',
      limit: 100,
      nft_metadata: false,
      ...options
    }

    try {
      const response = await (
        await (fetch(`${Config.SERVICE_MORALIS_API}/wallets/${address}/history?` + stringify(query), params))
      ).json()

      const data = response.result

      const historyFilterList = (data || []).filter(e => !(e.possible_spam || false))

      return historyFilterList
    } catch (error) {
      return []
    }
  }

  static async getSendReceivedTokenHistoryByAddress (address, chain) {
    if (!address || !chain) {
      return []
    }

    const params = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': KeysTurbo.secureFor('SERVICE_MORILIS_API_KEY')
      }
    }

    const query = {
      chain: chain,
      order: 'DESC',
      limit: 100
    }

    try {
      const response = await (
        await (fetch(`${Config.SERVICE_MORALIS_API}/${address}/erc20/transfers?` + stringify(query), params))
      ).json()
      const data = response.result

      const historyFilterList = (data || []).filter(e => !(e.possible_spam || false))

      return historyFilterList
    } catch (error) {
      return []
    }
  }
}
