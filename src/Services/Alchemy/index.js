import Config from 'react-native-config'
import KeysTurbo from 'react-native-keys'

// Alchemy Portfolio API — the balance fallback used when Moralis fails.
//
// Deliberately mirrors MoralisService.getTokenBalanceByWallet: same call shape,
// same "throws on failure" contract. The two are interchangeable behind
// TokenListV2's routing, and neither may report a failure as an empty wallet.
export default class AlchemyService {
  // THROWS on failure, exactly like the Moralis balance call — an error must stay
  // distinguishable from "this wallet holds nothing", or the caller commits the
  // empty result as the chain's new truth and wipes the list.
  //
  // `network` is an Alchemy slug (see SUPPORTED_CHAINS_BY_SERVICE_ALCHEMY). One
  // chain per call: the endpoint accepts up to 5 networks per request, but the
  // caller commits per chain progressively, and a single-network request also
  // sidesteps having to map the response's `network` back to a chainId — Alchemy
  // does not always echo the slug it was given (ask for `polygon-mainnet`, get
  // `matic-mainnet` back).
  static async getTokenBalanceByWallet (walletAddress, network, pageKey, listBalanceFinal = []) {
    const apiKey = KeysTurbo.secureFor('ALCHEMY_API_KEY')
    if (!apiKey) {
      throw new Error('Alchemy balances: missing API key')
    }

    const body = {
      addresses: [{ address: walletAddress, networks: [network] }],
      withMetadata: true,
      withPrices: true,
      includeNativeTokens: true,
      includeErc20Tokens: true,
      ...(pageKey ? { pageKey } : {})
    }

    // No try/catch: network errors, non-2xx and malformed bodies all have to
    // reach the caller. Only an actually-empty `tokens` array means empty wallet.
    const response = await fetch(
      `${Config.SERVICE_ALCHEMY_DATA_API}/${apiKey}/assets/tokens/by-address`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    )
    if (!response.ok) {
      throw new Error(`Alchemy balances: HTTP ${response.status} on ${network}`)
    }

    const json = await response.json()
    if (!Array.isArray(json?.data?.tokens)) {
      throw new Error(`Alchemy balances: malformed response on ${network}`)
    }

    listBalanceFinal = listBalanceFinal.concat(json.data.tokens)
    if (json.data?.pageKey) {
      return this.getTokenBalanceByWallet(walletAddress, network, json.data.pageKey, listBalanceFinal)
    }
    return listBalanceFinal
  }
}
