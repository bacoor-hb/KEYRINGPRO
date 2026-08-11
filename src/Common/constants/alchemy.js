import { abstract, apeChain, arbitrum, avalanche, base, berachain, blast, bsc, celo, genesys, gnosis, ink, lens, linea, mainnet, optimism, polygon, ronin, rootstock, scroll, shape, soneium, unichain, worldchain, zksync, zora } from 'viem/chains'

export const ALCHEMY_ENDPOINT = {
  // chain common
  [mainnet.id]: 'eth-mainnet',
  [optimism.id]: 'opt-mainnet',
  [bsc.id]: 'bnb-mainnet',
  [base.id]: 'base-mainnet',
  [arbitrum.id]: 'arb-mainnet',
  [avalanche.id]: 'avax-mainnet',
  [polygon.id]: 'polygon-mainnet',
  [unichain.id]: 'unichain-mainnet',
  999: 'hyperliquid-mainnet',
  [celo.id]: 'celo-mainnet',
  [gnosis.id]: 'gnosis-mainnet',
  143: 'monad-mainnet',
  [ink.id]: 'ink-mainnet',
  4663: 'robinhood-mainnet',

  // more chain
  [linea.id]: 'linea-mainnet',
  [scroll.id]: 'scroll-mainnet',
  [worldchain.id]: 'worldchain-mainnet',
  [abstract.id]: 'abstract-mainnet',
  [zksync.id]: 'zksync-mainnet',
  [shape.id]: 'shape-mainnet',
  [berachain.id]: 'berachain-mainnet',
  [lens.id]: 'lens-mainnet',
  [soneium.id]: 'soneium-mainnet',
  [rootstock.id]: 'rootstock-mainnet',
  [ronin.id]: 'ronin-mainnet',
  [genesys.id]: 'gensyn-mainnet',

  42018: 'mythos-mainnet',
  [zora.id]: 'zora-mainnet',
  [blast.id]: 'blast-mainnet',
  [apeChain.id]: 'apechain-mainnet'
}
