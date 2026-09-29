
export const PLATFORM_EXCHANGE = {
  relay: 'relay',
  deBridge: 'deBridge'
}

// https://docs.debridge.com/dln-details/overview/deployed-contracts
export const CONTRACT_FEE_PROTOCOL = {
  [PLATFORM_EXCHANGE.deBridge]: {
    DEFAULT: '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'
    // Contract other
    // 4326: '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'

  }

}

export const CHAIN_ID_NO_GAS_PRICE_SWAP = {
  42220: 'celo'
}

export const CHAIN_ID_EXCLUDE_EVM = [
  // Tron: In DeBridge (originalChainId)
  728126428,
  // solana: In DeBridge (originalChainId)
  7565164
]

export const TOKEN_RECOMMEND_SWAP = {
  100000029: [
    {
      symbol: 'INJ',
      name: 'Injective',
      decimals: 18,
      address: '0x0000000000000000000000000000000000000000',
      iconUrl: 'https://tokens.debridge.finance/Logo/100000029/0x0000000000000000000000000000000000000000/small/token-logo.png'
    },
    {
      symbol: 'USDT',
      name: 'USDT',
      decimals: 6,
      address: '0x88f7f2b685f9692caf8c478f5badf09ee9b1cc13',
      iconUrl: 'https://tokens.debridge.finance/Logo/100000029/0x88f7f2b685f9692caf8c478f5badf09ee9b1cc13/small/token-logo.png'
    },
    {
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
      address: '0x2a25fbd67b3ae485e461fe55d9dbef302b7d3989',
      iconUrl: 'https://tokens.debridge.finance/Logo/100000029/0x2a25fbd67b3ae485e461fe55d9dbef302b7d3989/small/token-logo.svg'

    },
    {
      symbol: 'wINJ',
      name: 'Wrapped INJ',
      decimals: 18,
      address: '0x0000000088827d2d103ee2d9a6b781773ae03ffb',
      iconUrl: 'https://tokens.debridge.finance/Logo/100000029/0x0000000088827d2d103ee2d9a6b781773ae03ffb/small/token-logo.png'
    }
  ],
  1776: [
    {
      symbol: 'INJ',
      name: 'Injective',
      decimals: 18,
      address: '0x0000000000000000000000000000000000000000',
      iconUrl: 'https://ipfs.blockchhub.link/ipfs/QmbHB6uwNMkuqdzxxQRZEU6rmzcpqqojTpdZxnLKAjL6Nh?filename=0x0000000000000000000000000000000000000000.png'
    },
    {
      symbol: 'USDT',
      name: 'USDT',
      decimals: 6,
      address: '0x88f7f2b685f9692caf8c478f5badf09ee9b1cc13',
      iconUrl: 'https://ipfs.blockchhub.link/ipfs/QmaK3BJoB7ZHsGsHufjqFApHimD3C9tNYwReidoWjyE4CQ?filename=0x88f7f2b685f9692caf8c478f5badf09ee9b1cc13.png'
    },
    {
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
      coinGeckoId: 'usd-coin',
      address: '0x2a25fbd67b3ae485e461fe55d9dbef302b7d3989',
      iconUrl: 'https://ipfs.blockchhub.link/ipfs/QmY8UN7aoX1UvFwW6RzFFGnUcsUdZawGK7p7SkZzXG7QtU?filename=0x2a25fbd67b3ae485e461fe55d9dbef302b7d3989.png'

    },
    {
      symbol: 'wINJ',
      name: 'Wrapped INJ',
      decimals: 18,
      address: '0x0000000088827d2d103ee2d9a6b781773ae03ffb',
      iconUrl: 'https://ipfs.blockchhub.link/ipfs/QmbHB6uwNMkuqdzxxQRZEU6rmzcpqqojTpdZxnLKAjL6Nh?filename=0x0000000088827d2d103ee2d9a6b781773ae03ffb.png'
    }
  ]
}
