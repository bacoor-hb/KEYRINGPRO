import images from 'assets/Image'
import Keys from 'react-native-keys'
import Config from 'react-native-config'

// with layer 2 of certain chain. you shoud name it as full name of layer2 and the main token is also the main token of Layer1.
export const chainType = {
  tomo: 'tomo',
  ether: 'ether',
  btc: 'btc',
  bsc: 'bsc',
  one: 'one',
  heco: 'heco',
  matic: 'matic',
  avax: 'avax',
  fantom: 'fantom',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  solana: 'solana',
  okt: 'okt',
  base: 'base',
  linea: 'linea',
  unichain: 'unichain'
}

// List chain ids default
export const LIST_DEFAULT_CHAIN_ID = [1, 10, 56, 8453, 42161, 43114, 137, 130, 9745, 999, 988, 5000, 42220, 4326, 100, 747474, 143, 57073, 4217, 4663]

export const SUPPORTED_BLOCKCHAIN_DATA = {
  1: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://etherscan.io/tx/',
    linkScan: 'https://etherscan.io/address/',
    linkScanTokenHolding: 'https://etherscan.io/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    chainId: 1,
    icon: images.UIV2.defaultChains[1],
    name: 'Ethereum',
    status: false,
    chain: 'ether',
    chainCoingecko: 'ethereum',
    isSupportedChain: true
  },
  10: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://optimistic.etherscan.io/tx/',
    linkScan: 'https://optimistic.etherscan.io/address/',
    linkScanTokenHolding: 'https://optimistic.etherscan.io/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.optimism.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    chainId: 10,
    icon: images.UIV2.defaultChains[10],
    name: 'Optimism',
    status: false,
    chain: 'optimism',
    chainCoingecko: 'optimistic-ethereum',
    isSupportedChain: true
  },
  56: {
    nativeCurrency: { symbol: 'BNB' },
    linkScanHash: 'https://bscscan.com/tx/',
    linkScan: 'https://bscscan.com/address/',
    linkScanTokenHolding: 'https://bscscan.com/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.bsc.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    chainId: 56,
    icon: images.UIV2.defaultChains[56],
    name: 'Binance Smart Chain',
    status: false,
    chain: 'bsc',
    chainCoingecko: 'binance-smart-chain',
    isSupportedChain: true
  },
  137: {
    nativeCurrency: { symbol: 'POL' },
    linkScanHash: 'https://polygonscan.com/tx/',
    linkScan: 'https://polygonscan.com/address/',
    linkScanTokenHolding: 'https://polygonscan.com/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.matic.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    chainId: 137,
    icon: images.UIV2.defaultChains[137],
    name: 'Polygon',
    status: false,
    chain: 'matic',
    chainCoingecko: 'polygon-pos',
    isSupportedChain: true
  },
  42161: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://arbiscan.io/tx/',
    linkScan: 'https://explorer.arbitrum.io/address/',
    linkScanTokenHolding: 'https://arbiscan.io/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.arbitrum-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    chainId: 42161,
    icon: images.UIV2.defaultChains[42161],
    name: 'Arbitrum',
    status: false,
    chain: 'arbitrum',
    chainCoingecko: 'arbitrum-one',
    isSupportedChain: true
  },
  43114: {
    nativeCurrency: { symbol: 'AVAX' },
    linkScanHash: 'https://cchain.explorer.avax.network/tx/',
    linkScan: 'https://cchain.explorer.avax.network/address/',
    linkScanTokenHolding: 'https://snowtrace.io/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.avalanche-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}/ext/bc/C/rpc`,
    chainId: 43114,
    icon: images.UIV2.defaultChains[43114],
    name: 'Avalanche',
    status: false,
    chain: 'avax',
    chainCoingecko: 'avalanche',
    isSupportedChain: true
  },
  8453: {
    nativeCurrency: { symbol: 'ETH' },
    isSupportedChain: true,
    status: false,
    chainId: 8453,
    name: 'Base',
    chain: 'base',
    chainCoingecko: 'base',
    icon: images.UIV2.defaultChains[8453],
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.base-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    linkScanTokenHolding: 'https://basescan.org/address/',
    linkScan: 'https://basescan.org/address/',
    linkScanHash: 'https://basescan.org/tx/'
  },
  130: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://uniscan.xyz/tx/',
    linkScan: 'https://uniscan.xyz/address/',
    linkScanTokenHolding: 'https://uniscan.xyz/tokenholdings?a=',
    linkProvider: `https://${Config.SERVICE_QUICKNODE_ENDPOINT_NAME}.unichain-mainnet.quiknode.pro/${Keys.secureFor('SERVICE_QUICKNODE_API_KEY')}`,
    chainId: 130,
    icon: images.UIV2.defaultChains[130],
    name: 'Unichain',
    status: false,
    chain: 'unichain',
    chainCoingecko: 'unichain',
    isSupportedChain: true
  },
  9745: {
    nativeCurrency: { symbol: 'XPL' },
    linkScanHash: 'https://plasmascan.to/tx/',
    linkScan: 'https://plasmascan.to/address/',
    linkScanTokenHolding: 'https://plasmascan.to/address/',
    linkProvider: 'https://rpc.plasma.to',
    chainId: 9745,
    icon: images.UIV2.defaultChains[9745],
    name: 'Plasma',
    status: false,
    chain: 'plasma',
    chainCoingecko: 'plasma',
    isSupportedChain: true
  },
  999: {
    nativeCurrency: { symbol: 'HYPE' },
    linkScanHash: 'https://hyperevmscan.io/tx/',
    linkScan: 'https://hyperevmscan.io/address/',
    linkScanTokenHolding: 'https://hyperevmscan.io/address/',
    linkProvider: 'https://rpc.hyperliquid.xyz/evm',
    chainId: 999,
    icon: images.UIV2.defaultChains[999],
    name: 'HyperEVM',
    status: false,
    chain: 'hyperevm',
    chainCoingecko: 'hyperevm',
    isSupportedChain: true
  },
  988: {
    nativeCurrency: { symbol: 'USDT0' },
    linkScanHash: 'https://stablescan.xyz/tx/',
    linkScan: 'https://stablescan.xyz/address/',
    linkScanTokenHolding: 'https://stablescan.xyz/address/',
    linkProvider: 'https://rpc.stable.xyz',
    chainId: 988,
    icon: images.UIV2.defaultChains[988],
    name: 'Stable',
    status: false,
    chain: 'stable',
    chainCoingecko: 'stable',
    isSupportedChain: true
  },
  5000: {
    nativeCurrency: { symbol: 'MNT' },
    linkScanHash: 'https://mantlescan.xyz/tx/',
    linkScan: 'https://mantlescan.xyz/address/',
    linkScanTokenHolding: 'https://mantlescan.xyz/address/',
    linkProvider: 'https://rpc.mantle.xyz',
    chainId: 5000,
    icon: images.UIV2.defaultChains[5000],
    name: 'Mantle',
    status: false,
    chain: 'mantle',
    chainCoingecko: 'mantle',
    isSupportedChain: true
  },
  42220: {
    nativeCurrency: { symbol: 'CELO' },
    linkScanHash: 'https://celoscan.io/tx/',
    linkScan: 'https://celoscan.io/address/',
    linkScanTokenHolding: 'https://celoscan.io/address/',
    linkProvider: 'https://forno.celo.org',
    chainId: 42220,
    icon: images.UIV2.defaultChains[42220],
    name: 'Celo',
    status: false,
    chain: 'celo',
    chainCoingecko: 'celo',
    isSupportedChain: true
  },
  4326: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://megaeth.blockscout.com/tx/',
    linkScan: 'https://megaeth.blockscout.com/address/',
    linkScanTokenHolding: 'https://megaeth.blockscout.com/address/',
    linkProvider: 'https://mainnet.megaeth.com/rpc',
    chainId: 4326,
    icon: images.UIV2.defaultChains[4326],
    name: 'MegaETH',
    status: false,
    chain: 'megaeth',
    chainCoingecko: 'megaeth',
    isSupportedChain: true
  },
  100: {
    nativeCurrency: { symbol: 'xDAI' },
    linkScanHash: 'https://blockscout.com/xdai/mainnet/tx/',
    linkScan: 'https://blockscout.com/xdai/mainnet/address/',
    linkScanTokenHolding: 'https://blockscout.com/xdai/mainnet/address/',
    linkProvider: 'https://rpc.gnosischain.com',
    chainId: 100,
    icon: images.UIV2.defaultChains[100],
    name: 'Gnosis',
    status: false,
    chain: 'xdai',
    chainCoingecko: 'xdai',
    isSupportedChain: true
  },
  747474: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://explorer.katanarpc.com/tx/',
    linkScan: 'https://explorer.katanarpc.com/address/',
    linkScanTokenHolding: 'https://explorer.katanarpc.com/address/',
    linkProvider: 'https://rpc.katana.network',
    chainId: 747474,
    icon: images.UIV2.defaultChains[747474],
    name: 'Katana',
    status: false,
    chain: 'katana',
    isSupportedChain: true
  },
  143: {
    nativeCurrency: { symbol: 'MON' },
    linkScanHash: 'https://monadscan.com/tx/',
    linkScan: 'https://monadscan.com/address/',
    linkScanTokenHolding: 'https://monadscan.com/address/',
    linkProvider: 'https://rpc.monad.xyz',
    chainId: 143,
    icon: images.UIV2.defaultChains[143],
    name: 'Monad',
    status: false,
    chain: 'monad',
    chainCoingecko: 'monad',
    isSupportedChain: true
  },
  57073: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://explorer.inkonchain.com/tx/',
    linkScan: 'https://explorer.inkonchain.com/address/',
    linkScanTokenHolding: 'https://explorer.inkonchain.com/address/',
    linkProvider: 'https://rpc-gel.inkonchain.com',
    chainId: 57073,
    icon: images.UIV2.defaultChains[57073],
    name: 'INK',
    status: false,
    chain: 'ink',
    chainCoingecko: 'ink',
    isSupportedChain: true
  },
  4217: {
    nativeCurrency: { symbol: 'USD' },
    linkScanHash: 'https://explore.tempo.xyz/tx/',
    linkScan: 'https://explore.tempo.xyz/address/',
    linkScanTokenHolding: 'https://explore.tempo.xyz/address/',
    linkProvider: 'https://rpc.mainnet.tempo.xyz',
    chainId: 4217,
    icon: images.UIV2.defaultChains[4217],
    name: 'Tempo',
    status: false,
    chain: 'tempo',
    chainCoingecko: 'tempo',
    isSupportedChain: true
  },
  4663: {
    nativeCurrency: { symbol: 'ETH' },
    linkScanHash: 'https://robinhoodchain.blockscout.com/tx/',
    linkScan: 'https://robinhoodchain.blockscout.com/address/',
    linkScanTokenHolding: 'https://robinhoodchain.blockscout.com/address/',
    linkProvider: 'https://rpc.mainnet.chain.robinhood.com',
    chainId: 4663,
    icon: images.UIV2.defaultChains[4663],
    name: 'Robinhood',
    status: false,
    chain: 'robinhood',
    chainCoingecko: 'robinhood',
    isSupportedChain: true
  }
}

export const SUPPORTED_CHAINS_BY_SERVICE_MORALIS = {
  1: 'eth', // Ethereum Mainnet Mainnet |
  137: 'polygon', // Polygon Mainnet Mainnet |
  56: 'bsc', // Binance Smart Chain Mainnet Mainnet |
  42161: 'arbitrum', // Arbitrum Mainnet |
  8453: 'base', // Base Mainnet |
  10: 'optimism', // Optimism Mainnet |
  59144: 'linea', // Linea Mainnet |
  43114: 'avalanche', // Avalanche Mainnet |
  250: 'fantom', // Fantom Mainnet Mainnet |
  25: 'cronos', // Cronos Mainnet Mainnet |
  100: 'gnosis', // Gnosis Mainnet |
  88888: 'chiliz', // Chiliz Mainnet Mainnet |
  1284: 'moonbeam', // Moonbeam Mainnet |
  747: 'flow', // Flow Mainnet |
  2020: 'ronin', // Ronin Mainnet |
  1135: 'lisk', // Lisk Mainnet |
  369: 'pulse', // Pulsechain Mainnet |
  1329: 'sei', // Sei Mainnet |
  143: 'monad' // Monad Mainnet |
}

// Networks the Alchemy PORTFOLIO API (assets/tokens/by-address) accepts, keyed by
// chainId.
//
// Position in the routing (see balanceSourcesFor in Services/TokenListV2):
//   - chain ALSO in SUPPORTED_CHAINS_BY_SERVICE_MORALIS → Alchemy is the FALLBACK
//   - chain NOT in Moralis                              → Alchemy is the PRIMARY
//     source, replacing a per-token RPC scan with one API call.
//
// This is NOT the same set as ALCHEMY_ENDPOINT (common/constants/alchemy), which
// lists JSON-RPC NODE networks for the tx-history feature. The two are gated
// differently — measured on a live key: node URLs return 403 for any chain not
// enabled on the account, while the Portfolio API answers for every network
// regardless. So never derive one map from the other.
//
// EVERY entry below was verified against the live endpoint, on three axes,
// because a wrong slug here silently shows ANOTHER CHAIN'S balances:
//   1. the slug answers 200 (flow-, moonbeam- and sei-mainnet answer
//      `Unsupported network` despite Alchemy running nodes for them);
//   2. the chainId's name in the chain list matches the slug;
//   3. the chain's native symbol matches the Keyring token list's native entry —
//      the Alchemy path matches native BY SYMBOL, so a mismatch would bury the
//      user's native balance in the Hidden list.
//
// DELIBERATELY EXCLUDED — 16507. ALCHEMY_ENDPOINT maps it to `gensyn-mainnet`,
// but 16507 is **Genesys Network** (native GSYS, gchainexplorer.genesys.network)
// while Gensyn is an unrelated project. That mapping is wrong; copying it here
// would have priced one chain's wallet with another chain's balances. The
// tx-history feature still carries the bad entry — fix it there separately.
export const SUPPORTED_CHAINS_BY_SERVICE_ALCHEMY = {
  // Also served by Moralis → Alchemy is the fallback here.
  1: 'eth-mainnet',
  10: 'opt-mainnet',
  56: 'bnb-mainnet',
  100: 'gnosis-mainnet',
  137: 'polygon-mainnet',
  143: 'monad-mainnet',
  2020: 'ronin-mainnet',
  8453: 'base-mainnet',
  42161: 'arb-mainnet',
  43114: 'avax-mainnet',
  59144: 'linea-mainnet',

  // Not served by Moralis → Alchemy is the PRIMARY source. Before this, each of
  // these read one balance per LISTED token over RPC, which is what pushed the
  // paid RPC past its per-second limit.
  30: 'rootstock-mainnet',
  130: 'unichain-mainnet',
  // Alchemy lists this one as "DATA Network"; the app still calls it Story.
  // Same chain — native symbol DATA on both sides, explorer storyscan.xyz.
  1514: 'story-mainnet',
  232: 'lens-mainnet',
  324: 'zksync-mainnet',
  360: 'shape-mainnet',
  480: 'worldchain-mainnet',
  999: 'hyperliquid-mainnet',
  1868: 'soneium-mainnet',
  2741: 'abstract-mainnet',
  4663: 'robinhood-mainnet',
  33139: 'apechain-mainnet',
  42220: 'celo-mainnet',
  57073: 'ink-mainnet',
  80094: 'berachain-mainnet',
  81457: 'blast-mainnet',
  534352: 'scroll-mainnet',
  7777777: 'zora-mainnet'
}

// chainIds where the canonical Multicall3 contract (0xcA11bde05977b3631167028862bE2a173976CA11)
// is deployed — full list from https://www.multicall3.com/deployments
// (source: https://github.com/mds1/multicall deployments.json). Used to decide
// whether a chain can use the single-call multicall balance read; chains NOT in
// this set fall back to sequential per-token RPC reads (which work everywhere).
// Set dedups the few repeated ids in the source list.
export const MULTICALL3_CHAIN_IDS = new Set([
  1, 42, 4, 5, 3, 11155111, 17000, 1514, 1315, 112358, 16661, 1637450, 10, 69, 420,
  11155420, 42161, 42170, 421613, 421614, 421611, 23011913, 137, 80001, 80002, 1101,
  1442, 2442, 100, 10200, 43114, 43113, 4002, 250, 64240, 146, 56, 97, 5611, 204,
  1284, 1285, 1287, 11297108109, 11297108099, 1666600000, 25, 338, 89346162, 1729,
  122, 14, 19, 16, 114, 288, 1313161554, 592, 6038361, 3776, 66, 128, 1088, 599,
  59902, 54176, 541764, 30, 31, 9001, 9000, 108, 18, 42262, 23294, 42220, 44787,
  71402, 71401, 8217, 1001, 2001, 321, 106, 40, 1234, 7700, 7701, 4689, 32520, 2222,
  5003, 5001, 5000, 8082, 84531, 84532, 8453, 2358, 255, 1130, 1131, 138, 335, 53935,
  245022926, 59141, 59140, 59144, 11119, 57, 570, 5700, 57000, 943, 369, 7777777,
  999999999, 44, 46, 5555, 534353, 534351, 534352, 2415, 15557, 17777, 3737, 2000,
  4759, 7518, 974399131, 1444673419, 37084624, 1020352220, 1564830818, 2046399126,
  1482601649, 1350216234, 2021, 2020, 8131, 813, 35443, 35442, 35441, 245022934, 4201,
  83, 82, 58008, 424, 148, 710, 10243, 10242, 169, 167007, 167008, 314, 314159, 32659,
  46688, 47279324479, 3501, 3502, 88888, 88882, 1116, 1115, 1114, 61, 68840142, 42793,
  128123, 7001, 7000, 195, 94168, 199, 1029, 820, 462, 463, 42766, 34443, 168587773,
  81457, 660279, 7979, 3939, 728126428, 324, 280, 300, 1612127, 11124, 2741, 252, 2522,
  311, 5101, 9393, 12227330, 1996, 1992, 80094, 80069, 109, 13371, 13473, 12553, 2331,
  2710, 2810, 2818, 8899, 11235, 48899, 111188, 686868, 8822, 7070, 111557560, 88811,
  88819, 88817, 713715, 1329, 167009, 167000, 7560, 23451, 313313, 42299, 6699, 1030,
  11503, 6322, 98985, 196, 4061, 4062, 98867, 98866, 8911, 200901, 1135, 1625,
  5264468217, 60808, 53302, 499, 52164803, 123420000220, 9999999, 325000, 5851, 58,
  89, 88, 480, 747, 545, 55244, 1570, 1578, 33139, 1111, 41455, 656476, 132902, 3338,
  999, 998, 10143, 7869, 560048, 6342, 763373, 57073, 964, 5464, 9745, 1875, 3799,
  5845, 41923, 210425, 689, 1689, 28802, 24101, 43111, 743111, 3636, 3637, 223, 2345,
  130, 1868, 747474, 10088, 31612, 484, 185, 239, 143, 5888, 612055, 97477, 988
])

export const typeLiquidityPool = {
  uniswap: 'uniswap',
  pancakeswap: 'pancakeswap',
  raydium: 'raydium'
}
// Keyed by numeric chainId (EVM-only).
export const CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP = [
  1, // ether
  10, // optimism
  56, // bsc
  137, // matic
  43114, // avax
  42161, // arbitrum
  8453, // base
  130, // unichain
  4663 // robinhood
]
export const CHAINS_SUPPORT_LIQUIDITY_POOL_PANCAKESWAP = [
  1, // ether
  56, // bsc
  42161, // arbitrum
  // 59144, // linea
  8453 // base
]
// Keyed by numeric chainId (EVM-only).
export const LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_UNISWAP = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // ether
  56: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613', // bsc
  137: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // matic
  43114: '0x655C406EBFa14EE2006250925e54ec43AD184f8B', // avax
  42161: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // arbitrum
  10: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // optimism
  8453: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', // base
  130: '0x943e6e07a7e8e791dafc44083e54041d743c46e9', // unichain
  4663: '0x73991a25c818bf1f1128deaab1492d45638de0d3' // robinhood
}
export const LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_PANCAKESWAP = {
  1: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364', // ether
  56: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364', // bsc
  42161: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364', // arbitrum
  8453: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364' // base
  // 59144: '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364' // linea
}
