import Config from 'react-native-config'
import { stringify } from 'query-string'
import KeysTurbo from 'react-native-keys'

// Default page cap for getFullTxHistoryOfWalletByChain: 100 pages = 10,000
// transactions.
//
// Deliberately set high enough to leave the existing behaviour intact — every
// wallet this app has seen fits well inside it, so callers still get the full
// history and no answer changes. It is a RUNAWAY GUARD, not a latency budget: it
// bounds the worst case on a whale address instead of letting the recursion walk
// forever. Lower it only if the recipient check ever needs a real time bound —
// and note the trade-off then, that a send older than the window starts reading
// as "first time".
const MORALIS_HISTORY_MAX_PAGES = 100

export default class MoralisService {
  // THROWS on failure — deliberately, unlike the other calls in this class.
  // Balances are the one response whose failure must stay distinguishable from
  // "this wallet holds nothing on this chain": TokenListV2 commits whatever it
  // gets back as the chain's new truth, so an error swallowed into [] wipes the
  // list (or leaves a freshly imported wallet showing $0 while it actually holds
  // funds). Callers catch this and fall back to another balance source.
  //
  // A partial failure throws too: pages already collected are dropped rather
  // than returned, because committing half a wallet looks exactly like the other
  // half being spent.
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

    // No try/catch: a network error, a non-2xx status and a malformed body all
    // have to reach the caller. Only an actually-empty `result` array means the
    // wallet is empty.
    const response = await fetch(
      `${Config.SERVICE_MORALIS_API}/wallets/${walletAddress}/tokens?` + stringify(query),
      params
    )
    if (!response.ok) {
      throw new Error(`Moralis balances: HTTP ${response.status} on chain ${blockchain}`)
    }

    const json = await response.json()
    if (!Array.isArray(json?.result)) {
      throw new Error(`Moralis balances: malformed response on chain ${blockchain}`)
    }

    listBalanceFinal = listBalanceFinal.concat(json.result)
    if (json?.cursor) {
      return this.getTokenBalanceByWallet(walletAddress, blockchain, json.cursor, listBalanceFinal)
    }
    return listBalanceFinal.map((item) => {
      return {
        blockchain,
        ...item
      }
    })
  }

  // Pages are fetched SEQUENTIALLY — each cursor only exists once the previous page
  // has answered — so latency grows linearly with the wallet's history: a 3000-tx
  // wallet is 30 round trips of a heavy, fully-decoded payload. `pagesLeft` bounds
  // that walk; it counts DOWN through the recursion, and <= 0 means no cap at all.
  // The default is high on purpose (see MORALIS_HISTORY_MAX_PAGES) — a caller that
  // wants a real time bound passes its own, smaller value.
  //
  // THROWS on failure, like getTokenBalanceByWallet above and for the same reason:
  // this endpoint has no counterparty filter, so callers decide "never sent" from
  // an EMPTY result — and a rate-limited request swallowed into [] is indis-
  // tinguishable from a genuinely empty history. Partial pages are dropped with it.
  static async getFullTxHistoryOfWalletByChain (address, blockchain, apiQueryParams = {}, history = [], pagesLeft = MORALIS_HISTORY_MAX_PAGES) {
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
      if (response?.message && !response?.result) {
        // Moralis reports rate limits and bad keys as a 4xx body with `message`
        // and no `result`. Reaching the map below would return [] and read as an
        // empty history.
        throw new Error(response.message)
      }
      history = history.concat(response?.result || [])
      const canFetchMore = pagesLeft <= 0 || pagesLeft > 1
      if (response?.cursor && canFetchMore) {
        return this.getFullTxHistoryOfWalletByChain(address, blockchain, { ...apiQueryParams, cursor: response.cursor }, history, pagesLeft - 1)
      }
      return history.map((item) => {
        return {
          blockchain,
          ...item
        }
      })
    } catch (error) {
      throw new Error(`Moralis tx history failed for ${blockchain}: ${error?.message || error}`)
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
