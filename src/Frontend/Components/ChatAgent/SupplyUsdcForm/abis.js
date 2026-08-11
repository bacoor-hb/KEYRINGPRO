// Minimal ABI fragments for supplying USDC to a lending market — only the
// functions this flow actually calls, not the protocols' full ABIs.
//
// Each protocol family takes a DIFFERENT deposit call, which is the whole
// reason `market.type` travels from the core to the form. The signatures here
// are transcribed from the CoinPool app's own supply screens (coinpool-v2
// `SupplyUsdc/*`), so an in-chat supply encodes byte-identically to a supply
// made there.
//
// Spark and Spark-ETH OVERLOAD `deposit`; viem needs the overload it should
// pick to be unambiguous, so each fragment below declares exactly ONE variant —
// the same one the reference calls.

// Aave v3: supply(asset, amount, onBehalfOf, referralCode).
export const AAVE_POOL_ABI = [{
  name: 'supply',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'asset', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'onBehalfOf', type: 'address' },
    { name: 'referralCode', type: 'uint16' }
  ],
  outputs: []
}]

// Compound v3 (Comet): supply(asset, amount) — the market IS the USDC market,
// so there is no receiver argument; the caller is credited.
export const COMPOUND_COMET_ABI = [{
  name: 'supply',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'asset', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: []
}]

// Spark (non-Ethereum): deposit(assets, receiver, minShares, referralCode).
// `minShares` is real slippage protection — see SUPPLY_MIN_SHARES_BPS.
export const SPARK_ABI = [{
  name: 'deposit',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'assets', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'minShares', type: 'uint256' },
    { name: 'referral', type: 'uint16' }
  ],
  outputs: [{ name: 'shares', type: 'uint256' }]
}]

// Spark on Ethereum: deposit(assets, receiver, referralCode) — same vault
// family, one argument fewer, and NO minShares.
export const SPARK_ETH_ABI = [{
  name: 'deposit',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'assets', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'referral', type: 'uint16' }
  ],
  outputs: [{ name: 'shares', type: 'uint256' }]
}]

// Morpho v2 vaults are plain ERC-4626: deposit(assets, receiver).
export const MORPHO_VAULT_ABI = [{
  name: 'deposit',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'assets', type: 'uint256' },
    { name: 'receiver', type: 'address' }
  ],
  outputs: [{ name: 'shares', type: 'uint256' }]
}]

// ERC-4626 view shared by every vault market (Spark, Spark-ETH, Morpho): how
// many shares a deposit of `assets` mints right now. Drives the "Est. Received"
// line and Spark's `minShares` argument.
export const CONVERT_TO_SHARES_ABI = [{
  name: 'convertToShares',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'assets', type: 'uint256' }],
  outputs: [{ name: 'shares', type: 'uint256' }]
}]

// `balanceOf` on a vault share token — used for the Morpho dead-shares check.
export const VAULT_BALANCE_OF_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}]

/** Market families whose deposit is an ERC-4626 vault call (share-based). */
export const VAULT_TYPES = ['spark', 'spark-ethereum', 'morpho-v2']
