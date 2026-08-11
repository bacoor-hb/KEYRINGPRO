import Config from 'react-native-config'
import Keys from 'react-native-keys'

/**
 *
 * @returns object
 */
const settings = () => {
  return {
    server: {
      // .env holds these hosts without a trailing slash (consistent with the
      // other *_API vars). BaseAPI/NagemonAPI concatenate bare paths onto these,
      // so normalize to exactly one trailing slash here.
      api: `${(Config.KEYRING_API || '').replace(/\/+$/, '')}/`,
      nagemonAPI: `${(Config.NAGEMON_API || '').replace(/\/+$/, '')}/`,
      apiKeyringPool: Config.KEYRING_POOL_API,
      apiCoinPool: Config.COIN_POOL_API
    },
    // Paid Quicknode RPC per chainId — the primary RPC resolved by
    // getRpcUrlByChain; blockchainListRedux (from API) is the fallback and also
    // holds the rest of the chain metadata (scan links, backup RPCs).
    // EVM-only (V2): non-EVM chains (Solana/BTC) are display-only and make no
    // RPC/tx calls, so they have no entry here. The API key is injected at build
    // (Keys.secureFor); the URL template itself is not secret.
    rpcUrlByChainId: {
      1: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      56: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.bsc.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      137: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.matic.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      43114: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.avalanche-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}/ext/bc/C/rpc`,
      42161: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.arbitrum-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      10: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.optimism.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      8453: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.base-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      59144: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.linea-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      130: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.unichain-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      9745: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.plasma-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      999: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.hype-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}/evm`,
      5000: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.mantle-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      42220: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.celo-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      4326: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.megaeth-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      100: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.xdai.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      // 747474: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.katana-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`, // "error":"Network mismatch" from Quicknode, so we don't use this chain for now.
      143: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.monad-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      57073: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.ink-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      4217: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.tempo-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
      4663: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.robinhood-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`
    }
  }
}

export default settings
