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
    // EVM-only (V2). Keyed by numeric chainId (matches the app's chainId-only
    // architecture). Non-EVM chains (Solana/BTC) are display-only and make no
    // RPC/tx calls, so they have no entry here. Scan links live in
    // blockchainListRedux (from API) — the only field read from here is
    // linkProvider (getRpcUrlByChain): a paid Quicknode endpoint used as the
    // primary RPC. The API key is injected at build (Keys.secureFor); the URL
    // template itself is not secret. blockchainListRedux is the fallback.
    // The `chainId` field is kept because some consumers iterate Object.values()
    // and read it (keyringAgent, ViemWeb3) rather than using the key.
    web3Link: {
      1: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 1
      },
      56: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.bsc.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 56
      },
      137: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.matic.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 137
      },
      43114: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.avalanche-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}/ext/bc/C/rpc`,
        chainId: 43114
      },
      42161: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.arbitrum-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 42161
      },
      10: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.optimism.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 10
      },
      8453: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.base-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 8453
      },
      59144: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.linea-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 59144
      },
      130: {
        linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.unichain-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
        chainId: 130
      }
    }
  }
}

export default settings
