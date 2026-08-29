// Minimal ABI fragments for withdrawing from a lending market — only the
// functions this flow actually calls, not the protocols' full ABIs.
//
// Same convention as the supply side (ChatAgent/SupplyUsdcForm/abis.js): each
// protocol family takes a DIFFERENT withdraw call, which is why `market.type`
// travels from `useGetLendingTokenInfo` down to the encoder. Every signature
// below is transcribed from the CoinPool app's own withdraw screens (coinpool-v2
// `WithdrawUsdc/*`), so a withdrawal made here encodes byte-identically to one
// made there.
//
// The vault families OVERLOAD `withdraw`/`redeem`; viem needs the overload it
// should pick to be unambiguous, so each fragment declares exactly ONE variant —
// the same one the reference calls.

// Aave v3: withdraw(asset, amount, to) → the pool burns the caller's aTokens and
// sends the underlying to `to`. Passing `type(uint256).max` as amount means
// "all", which is how a full exit avoids leaving dust behind (see MAX_UINT256).
export const AAVE_POOL_WITHDRAW_ABI = [{
  name: 'withdraw',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'asset', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'to', type: 'address' }
  ],
  outputs: [{ name: '', type: 'uint256' }]
}]

// Compound v3 (Comet): withdraw(asset, amount) — the caller is debited and
// credited, so there is no receiver argument. `type(uint256).max` means "all".
export const COMPOUND_COMET_WITHDRAW_ABI = [{
  name: 'withdraw',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'asset', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: []
}]

// ERC-4626 `withdraw(assets, receiver, owner)` — shared verbatim by Spark,
// Spark-ETH and Morpho. Takes an amount of the UNDERLYING and burns however many
// shares that costs.
export const VAULT_WITHDRAW_ABI = [{
  name: 'withdraw',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'assets', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'owner', type: 'address' }
  ],
  outputs: [{ name: 'shares', type: 'uint256' }]
}]

// ERC-4626 `redeem(shares, receiver, owner)` — the mirror of the above: burns an
// exact number of SHARES for whatever underlying they are worth. This is the
// call a full exit uses, for the reason spelled out in buildWithdrawTx.
export const VAULT_REDEEM_ABI = [{
  name: 'redeem',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'shares', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'owner', type: 'address' }
  ],
  outputs: [{ name: 'assets', type: 'uint256' }]
}]

// Spark's NON-Ethereum vaults add a `minAssets` floor to `redeem` — real
// slippage protection, the redeem-side counterpart of the `minShares` its
// deposit takes. Ethereum's Spark vault and Morpho both use the plain 3-arg
// form above.
export const SPARK_REDEEM_ABI = [{
  name: 'redeem',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'shares', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'owner', type: 'address' },
    { name: 'minAssets', type: 'uint256' }
  ],
  outputs: [{ name: 'assets', type: 'uint256' }]
}]

// ERC-20 `balanceOf` — the receipt-token balance, which IS the share count for
// vault families and the (rebasing) underlying balance for Aave / Compound.
export const ERC20_BALANCE_OF_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}]

// The receipt token's own scale. Needed where a share balance is converted by a
// RATE rather than by the vault (see ORACLE_PRICED_TYPES): the rate cancels only
// the ray, leaving the share/asset scale difference to be applied explicitly.
export const ERC20_DECIMALS_ABI = [{
  name: 'decimals',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'uint8' }]
}]

// Most withdrawals need no allowance — the pool burns the caller's own receipt
// token. The PSM3 exit is the exception: it PULLS the user's sUSDS, so it must be
// approved first, exactly like a deposit.
export const ERC20_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: [{ name: '', type: 'bool' }]
}]

// Current allowance, so an exit that is already approved skips straight to the
// swap instead of costing the user a redundant transaction.
export const ERC20_ALLOWANCE_ABI = [{
  name: 'allowance',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ],
  outputs: [{ name: '', type: 'uint256' }]
}]

// ERC-4626 `convertToAssets(shares)` — what a share balance is worth in the
// underlying right now. Turns a vault's share balance into the withdrawable
// figure the form shows.
export const CONVERT_TO_ASSETS_ABI = [{
  name: 'convertToAssets',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'shares', type: 'uint256' }],
  outputs: [{ name: 'assets', type: 'uint256' }]
}]

// ERC-4626 `maxWithdraw(owner)` — the most the vault will actually let this
// owner take out right now, already accounting for its own liquidity. Preferred
// over convertToAssets when it answers, since a vault can be solvent but
// temporarily illiquid.
export const MAX_WITHDRAW_ABI = [{
  name: 'maxWithdraw',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'owner', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}]

// ERC-4626 `previewWithdraw(assets)` — how many shares withdrawing `assets`
// would burn. Drives the "Refund amount" row for vault markets.
export const PREVIEW_WITHDRAW_ABI = [{
  name: 'previewWithdraw',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'assets', type: 'uint256' }],
  outputs: [{ name: 'shares', type: 'uint256' }]
}]

// Aave v3 pool: getUserAccountData(user) → the account-wide collateral / debt /
// health-factor snapshot. This is what makes a withdrawal safe to size when the
// user ALSO borrows against the same pool — see withdrawChecks.
export const AAVE_USER_ACCOUNT_DATA_ABI = [{
  name: 'getUserAccountData',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [
    { name: 'totalCollateralBase', type: 'uint256' },
    { name: 'totalDebtBase', type: 'uint256' },
    { name: 'availableBorrowsBase', type: 'uint256' },
    { name: 'currentLiquidationThreshold', type: 'uint256' },
    { name: 'ltv', type: 'uint256' },
    { name: 'healthFactor', type: 'uint256' }
  ]
}]

// Aave v3 pool → its addresses provider → its price oracle. Three hops, because
// the price a withdrawal has to be sized against is AAVE'S OWN, not any other
// feed: `getUserAccountData` reports collateral and debt valued by this oracle,
// so dividing that surplus by a price from somewhere else mixes two valuations
// and lands on a figure the protocol never agrees with.
export const AAVE_ADDRESSES_PROVIDER_ABI = [{
  name: 'ADDRESSES_PROVIDER',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'address' }]
}]

export const AAVE_GET_PRICE_ORACLE_ABI = [{
  name: 'getPriceOracle',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'address' }]
}]

// Quoted in the pool's base currency with 8 decimals — the same scale
// `getUserAccountData` uses, which is what makes the division below exact.
export const AAVE_GET_ASSET_PRICE_ABI = [{
  name: 'getAssetPrice',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'asset', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}]

/** Market families whose position is share-based (ERC-4626 vaults). */
export const VAULT_TYPES = ['spark', 'spark-ethereum', 'morpho-v2']

/**
 * Cross-chain sUSDS on an L2 — share-based like a vault, but NOT ERC-4626.
 *
 * Bridging sUSDS moves only the share token; the vault holding the USDS stays on
 * Ethereum. So the token on Base/Arbitrum/Optimism/Unichain implements no
 * `convertToAssets`, no `maxWithdraw`, no `previewWithdraw` and no `redeem` —
 * it is an ERC-20 that appreciates, and its value is published by the SSR oracle
 * instead ({@link SSR_CONVERSION_RATE_ABI}).
 *
 * Kept OUT of {@link VAULT_TYPES} deliberately: every branch keyed on that list
 * calls a 4626 function on `market.contract`, all of which revert here. It is
 * also out of {@link SUPPORTED_WITHDRAW_TYPES}, because exiting the position is
 * a PSM3 swap (approve + `swapExactIn` with a slippage bound), not the
 * single-transaction burn this flow is built for. The position is therefore
 * displayed accurately and the submit button stays disabled — see
 * `readWithdrawable` and `withdrawUnavailableReason`.
 */
export const ORACLE_PRICED_TYPES = ['spark-l2-susds']

/** True for a position valued by an external rate oracle rather than by its own contract. */
export const isOraclePricedType = (type) => ORACLE_PRICED_TYPES.includes(type)

/** Share-based in the sense of "balanceOf is not the underlying" — vault or oracle-priced. */
export const isShareBasedType = (type) => VAULT_TYPES.includes(type) || isOraclePricedType(type)

/**
 * Every protocol family this withdraw flow can encode a call for.
 *
 * {@link ORACLE_PRICED_TYPES} is included, but it exits through a PSM3 SWAP
 * rather than a vault redemption — see `buildPsmSwapTx`. That difference is why
 * it is not in {@link VAULT_TYPES}: every branch keyed on that list calls a 4626
 * function, all of which revert on a bridged sUSDS token.
 */
export const SUPPORTED_WITHDRAW_TYPES = ['aave-v3', 'compound-v3', ...VAULT_TYPES, ...ORACLE_PRICED_TYPES]

/**
 * Spark PSM3 — the L2 swap between USDC, USDS and sUSDS, and the only way out of
 * a cross-chain sUSDS position.
 *
 * `swapExactIn` REVERTS when the PSM lacks the balance to pay out, so the form
 * reads the pool's holding of the target asset and caps the amount against it
 * rather than letting the transaction fail after signing.
 *
 * `previewSwapExactIn` quotes the exact output at the current rate, with no fee
 * and no slippage — verified on Base: 1000 sUSDS previewed 1106.522783 USDS and
 * a simulated swap returned 1106.522783. The `minAmountOut` floor still matters,
 * because the SSR rate ticks up every second and the quote is read before the
 * user signs.
 */
export const PSM3_SWAP_EXACT_IN_ABI = [{
  name: 'swapExactIn',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'assetIn', type: 'address' },
    { name: 'assetOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'referralCode', type: 'uint256' }
  ],
  outputs: [{ name: 'amountOut', type: 'uint256' }]
}]

export const PSM3_PREVIEW_SWAP_EXACT_IN_ABI = [{
  name: 'previewSwapExactIn',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'assetIn', type: 'address' },
    { name: 'assetOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' }
  ],
  outputs: [{ name: 'amountOut', type: 'uint256' }]
}]

/** PSM3's own getters for the three assets it swaps between. */
export const PSM3_ASSETS_ABI = [
  { name: 'susds', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'usds', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { name: 'usdc', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] }
]

/**
 * No referral program is in use here, and 0 is PSM3's documented "none" value.
 * Named rather than inlined so the argument at the call site reads as a
 * deliberate choice instead of an unexplained zero.
 */
export const PSM3_NO_REFERRAL = 0n

/**
 * Slippage floor for a PSM3 swap, in basis points of the quoted output.
 *
 * PSM3 charges no fee and has no price impact — the quote and the executed
 * amount matched to the last unit when simulated on Base. The only thing that
 * moves between quoting and signing is the SSR rate, which ticks UPWARD, so the
 * realistic risk is receiving slightly MORE, not less.
 *
 * A floor is still applied because `minAmountOut: 0` would sign away every
 * guarantee for no benefit, and a card-signed transaction can sit unsigned for
 * minutes. 10 bps is far wider than the rate can plausibly move against the user
 * in that window while still rejecting a genuinely broken quote.
 */
export const PSM3_SLIPPAGE_BPS = 10n

/** Basis-point denominator. */
export const BPS_DENOMINATOR = 10000n

/**
 * Spark's SSR oracle — `getConversionRate()` returns the sUSDS→USDS rate as a
 * ray (27 decimals). The only source of a cross-chain sUSDS position's value,
 * since the token itself reports nothing.
 */
export const SSR_CONVERSION_RATE_ABI = [{
  name: 'getConversionRate',
  type: 'function',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ name: '', type: 'uint256' }]
}]

/** The ray scale SSR rates are quoted in. Integer maths only — never a float. */
export const RAY = 10n ** 27n

/**
 * `type(uint256).max`, the "withdraw everything" sentinel Aave and Compound both
 * accept. Kept as a literal BigInt rather than importing viem's `maxUint256` so
 * the ABI module has no runtime dependency.
 */
export const MAX_UINT256 = (1n << 256n) - 1n
