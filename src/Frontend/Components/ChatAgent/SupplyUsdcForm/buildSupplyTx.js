import { encodeFunctionData } from 'viem'
import BigNumber from 'bignumber.js'
import {
  AAVE_POOL_ABI,
  COMPOUND_COMET_ABI,
  MORPHO_VAULT_ABI,
  SPARK_ABI,
  SPARK_ETH_ABI
} from './abis'

// Unsigned-tx builders for supplying USDC to a lending market.
//
// A supply is up to TWO transactions: the market contract has to be allowed to
// pull the user's USDC (`approve`), and then the deposit itself. Each leg is
// built separately here and sent separately by `useSupplyFlow`, which reads the
// standing allowance first and skips the approval when it already suffices.
//
// The deposit call differs per protocol family; `market.type` selects it. Every
// signature is transcribed from the CoinPool app's own supply screens so an
// in-chat supply is byte-identical to one made there.

const ERC20_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' }
  ],
  outputs: [{ name: '', type: 'bool' }]
}]

/**
 * Human amount → smallest units, as a BigInt.
 *
 * Deliberately NOT viem's `parseUnits`: the amount arrives as a user-typed
 * decimal string, and going through JS numbers would round it. BigNumber keeps
 * it exact, and ROUND_DOWN means a supply can never be scaled UP past what the
 * user actually holds — the same floor-don't-round rule the balance-derived
 * amounts elsewhere in the app follow.
 */
export const toUnits = (amount, decimals) => {
  const bn = BigNumber(amount)
  if (!bn.isFinite() || bn.lte(0)) return 0n
  return BigInt(
    bn.times(BigNumber(10).pow(decimals)).integerValue(BigNumber.ROUND_DOWN).toFixed(0)
  )
}

/**
 * The deposit leg alone. `minShares` applies only to Spark (the one family whose
 * deposit takes slippage protection); everything else ignores it.
 */
const buildDepositTx = ({ market, asset, walletAddress, amountUnits, minShares = 0n }) => {
  const to = market.contract

  switch (market.type) {
    case 'aave-v3':
      return {
        to,
        data: encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: 'supply',
          // onBehalfOf = the user (they receive the aTokens); referralCode 0.
          args: [asset.address, amountUnits, walletAddress, 0]
        })
      }

    case 'compound-v3':
      return {
        to,
        data: encodeFunctionData({
          abi: COMPOUND_COMET_ABI,
          functionName: 'supply',
          // Comet credits the caller — no receiver argument exists.
          args: [asset.address, amountUnits]
        })
      }

    case 'spark':
      return {
        to,
        data: encodeFunctionData({
          abi: SPARK_ABI,
          functionName: 'deposit',
          args: [amountUnits, walletAddress, minShares, 0]
        })
      }

    case 'spark-ethereum':
      return {
        to,
        data: encodeFunctionData({
          abi: SPARK_ETH_ABI,
          functionName: 'deposit',
          args: [amountUnits, walletAddress, 0]
        })
      }

    case 'morpho-v2':
      return {
        to,
        data: encodeFunctionData({
          abi: MORPHO_VAULT_ABI,
          functionName: 'deposit',
          args: [amountUnits, walletAddress]
        })
      }

    default:
      // The core refuses unknown market types before emitting the form, so this
      // is unreachable in practice. Throwing (rather than returning a malformed
      // tx) keeps a future protocol from being silently mis-encoded into a
      // deposit the user has already approved USDC for.
      throw new Error(`Unsupported lending market type: ${market.type}`)
  }
}

/**
 * The approve leg on its own — allowing the market contract to pull exactly the
 * amount being supplied.
 *
 * NOT an unlimited allowance: a lending market only ever needs to pull what is
 * being deposited right now, and an exact approval leaves no standing allowance
 * behind once the deposit settles. Matches the reference implementation.
 *
 * Returned as a ONE-tx array because it is broadcast on its own — see
 * buildSupplyTxs for why approve and deposit are never sent together.
 */
export const buildApproveTxs = ({ market, asset, amount }) => [{
  to: asset.address,
  data: encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: 'approve',
    args: [market.contract, toUnits(amount, asset.decimals)]
  })
}]

/**
 * The deposit leg on its own.
 *
 * Approve and deposit are deliberately NOT returned as one `[approve, deposit]`
 * array: `postBaseSendTxs` maps the array through `Promise.all`, so the two
 * would be signed and broadcast IN PARALLEL, each reading the same
 * `getTransactionCount` and colliding on one nonce — and the deposit would in
 * any case reach the chain before the approval it depends on, and revert.
 * `useSendTx` also only tracks `results[0]`, so the second hash would be
 * invisible.
 *
 * So the form runs them as two sequential, separately-confirmed sends, the same
 * way the CoinPool app's supply screens do.
 */
export const buildSupplyTxs = ({ market, asset, walletAddress, amount, minShares = 0n }) => [
  buildDepositTx({
    market,
    asset,
    walletAddress,
    amountUnits: toUnits(amount, asset.decimals),
    minShares
  })
]
