import { encodeFunctionData, getAddress } from 'viem'
import BigNumber from 'bignumber.js'
import {
  AAVE_POOL_WITHDRAW_ABI,
  COMPOUND_COMET_WITHDRAW_ABI,
  ERC20_APPROVE_ABI,
  MAX_UINT256,
  PSM3_NO_REFERRAL,
  PSM3_SWAP_EXACT_IN_ABI,
  SPARK_REDEEM_ABI,
  VAULT_REDEEM_ABI,
  VAULT_WITHDRAW_ABI,
  VAULT_TYPES
} from './abis'

// Unsigned-tx builder for withdrawing from a lending market.
//
// Unlike a supply, a withdrawal is a SINGLE transaction: the receipt token is
// burned by the pool/vault itself, from the caller's own balance, so there is no
// ERC-20 `approve` leg to run first. (The CoinPool web app checks an allowance
// on its Aave withdraw path; that check is vestigial — Aave v3's `withdraw`
// burns aTokens via an internal call that needs no allowance — so it is
// deliberately not reproduced here. One tx, one signature.)
//
// What DOES differ per family is the call itself, selected by `market.type`.
// Every signature is transcribed from the CoinPool app's own withdraw screens.

/**
 * Human amount → smallest units, as a BigInt.
 *
 * Deliberately NOT viem's `parseUnits`: the amount arrives as a user-typed
 * decimal string, and going through JS numbers would round it. BigNumber keeps
 * it exact, and ROUND_DOWN means a withdrawal can never be scaled UP past what
 * the user actually holds — the same floor-don't-round rule the supply side and
 * the balance-derived amounts elsewhere in the app follow.
 */
export const toUnits = (amount, decimals) => {
  const bn = BigNumber(amount)
  if (!bn.isFinite() || bn.lte(0)) return 0n
  return BigInt(
    bn.times(BigNumber(10).pow(decimals)).integerValue(BigNumber.ROUND_DOWN).toFixed(0)
  )
}

/** True for the ERC-4626 vault families, whose balance is denominated in SHARES. */
export const isVaultType = (type) => VAULT_TYPES.includes(type)

/**
 * Checksum an address, tolerating the casing differences these values arrive in
 * (core lowercases, Redux may not). Returns null rather than throwing, so a
 * malformed address is caught by the caller as a missing field instead of
 * blowing up mid-encode.
 */
const asAddress = (value) => {
  try {
    return getAddress(String(value || '').trim())
  } catch (_err) {
    return null
  }
}

/**
 * The ERC-20 approval PSM3 needs before it can pull the user's sUSDS.
 *
 * Exactly the amount being swapped, never unlimited — the same rule the supply
 * side's approve leg follows, and it leaves no standing allowance behind.
 *
 * Returned on its own because it MUST be broadcast and confirmed before the
 * swap: `postBaseSendTxs` maps its array through `Promise.all`, so an
 * `[approve, swap]` batch would be signed in parallel, collide on one nonce, and
 * the swap would reach the chain before the allowance it depends on.
 */
export const buildPsmApproveTx = ({ psm, shareToken, shares }) => {
  const spender = asAddress(psm)
  const token = asAddress(shareToken)
  if (!spender) throw new Error('Missing PSM contract')
  if (!token) throw new Error('Missing share token address')
  if (typeof shares !== 'bigint' || shares <= 0n) throw new Error('Missing swap amount')

  return {
    to: token,
    data: encodeFunctionData({
      abi: ERC20_APPROVE_ABI,
      functionName: 'approve',
      args: [spender, shares]
    })
  }
}

/**
 * The PSM3 swap that exits a cross-chain sUSDS position.
 *
 * ## Why this is a swap and not a redemption
 *
 * Bridged sUSDS has no vault on its chain — the USDS backing it stays on
 * Ethereum — so there is nothing to `redeem` against. PSM3 is the contract that
 * exchanges it, and it settles at the SSR rate with no fee and no price impact.
 *
 * ## What is denominated in what
 *
 * This is the part that must not be got wrong. `amountIn` is in sUSDS SHARES,
 * while the amount the user typed is in the UNDERLYING (USDS). The two differ by
 * the exchange rate — currently ~1.1065 — so passing the typed amount straight
 * through as `amountIn` would swap ~10.65% more of the position than the user
 * asked for. The caller converts to shares first and passes `shares` here; this
 * function never sees a human amount and so cannot make that mistake.
 *
 * A full exit passes the entire share balance, which empties the position
 * exactly — shares are the stored unit and do not drift with the rate, so there
 * is no dust race of the kind the vault families' `redeem` path avoids.
 *
 * @param {string} psm          PSM3 address for the chain.
 * @param {string} shareToken   sUSDS address (`assetIn`).
 * @param {string} assetOut     Underlying to receive (USDS).
 * @param {bigint} shares       Amount of sUSDS to swap, in share units.
 * @param {bigint} minAmountOut Slippage floor, in `assetOut` units.
 * @param {string} walletAddress Receiver of the proceeds.
 */
export const buildPsmSwapTx = ({ psm, shareToken, assetOut, shares, minAmountOut, walletAddress }) => {
  const to = asAddress(psm)
  const assetIn = asAddress(shareToken)
  const out = asAddress(assetOut)
  const receiver = asAddress(walletAddress)

  if (!to) throw new Error('Missing PSM contract')
  if (!assetIn) throw new Error('Missing share token address')
  if (!out) throw new Error('Missing underlying asset address')
  if (!receiver) throw new Error('Missing wallet address')
  if (typeof shares !== 'bigint' || shares <= 0n) throw new Error('Missing swap amount')
  // A zero floor would sign away the only protection this call has. The caller
  // derives it from the live quote; refusing here means a caller that forgot
  // cannot silently produce an unprotected swap.
  if (typeof minAmountOut !== 'bigint' || minAmountOut <= 0n) throw new Error('Missing slippage floor')

  return {
    to,
    data: encodeFunctionData({
      abi: PSM3_SWAP_EXACT_IN_ABI,
      functionName: 'swapExactIn',
      args: [assetIn, out, shares, minAmountOut, receiver, PSM3_NO_REFERRAL]
    })
  }
}

/**
 * The withdraw transaction for one market.
 *
 * ## Why "withdraw all" is encoded differently
 *
 * Asking for an exact amount is only safe when it is LESS than the position.
 * A full exit sized as an exact amount is a race the user loses: these positions
 * accrue interest every block, so the figure read a moment ago is already stale
 * — ask for it and a few wei of yield stay behind (dust that shows as a
 * permanent $0.00 row), ask for a hair more and the call reverts.
 *
 * So a full exit switches to the "all" form of each family's call:
 *
 *   - Aave / Compound take `type(uint256).max` as the amount, which both
 *     protocols read as "the caller's entire balance, whatever it is now".
 *   - The ERC-4626 vaults have no such sentinel, so they `redeem` the exact
 *     SHARE balance instead of `withdraw`ing an asset amount. Shares are the
 *     unit the vault actually stores, and they do NOT drift with the exchange
 *     rate, so burning all of them empties the position exactly.
 *
 * @param {object} market        Resolved market: `{ type, contract }`.
 * @param {object} asset         Underlying: `{ address, decimals }`.
 * @param {string} walletAddress Signer, and the receiver of the underlying.
 * @param {string} amount        Human-readable amount of the UNDERLYING.
 * @param {boolean} isWithdrawAll Take the whole position (see above).
 * @param {bigint} shareBalance  Receipt-token balance, REQUIRED for a full vault
 *   exit because that is what gets redeemed. Ignored otherwise.
 * @param {bigint} minAssets     Slippage floor for Spark's 4-arg `redeem`.
 */
export const buildWithdrawTx = ({
  market,
  asset,
  walletAddress,
  amount,
  isWithdrawAll = false,
  shareBalance = 0n,
  minAssets = 0n
}) => {
  const to = asAddress(market?.contract)
  const receiver = asAddress(walletAddress)
  const assetAddress = asAddress(asset?.address)

  if (!to) throw new Error('Missing lending market contract')
  if (!receiver) throw new Error('Missing wallet address')

  const amountUnits = toUnits(amount, asset?.decimals ?? 18)

  switch (market?.type) {
    case 'aave-v3':
      // The pool needs to know WHICH reserve is being withdrawn — the underlying,
      // not the aToken. Without it the call cannot be built at all.
      if (!assetAddress) throw new Error('Missing underlying asset address')
      return {
        to,
        data: encodeFunctionData({
          abi: AAVE_POOL_WITHDRAW_ABI,
          functionName: 'withdraw',
          args: [assetAddress, isWithdrawAll ? MAX_UINT256 : amountUnits, receiver]
        })
      }

    case 'compound-v3':
      if (!assetAddress) throw new Error('Missing underlying asset address')
      return {
        to,
        data: encodeFunctionData({
          abi: COMPOUND_COMET_WITHDRAW_ABI,
          functionName: 'withdraw',
          // Comet debits and credits the caller — no receiver argument exists.
          args: [assetAddress, isWithdrawAll ? MAX_UINT256 : amountUnits]
        })
      }

    case 'spark':
    case 'spark-ethereum':
    case 'morpho-v2': {
      if (!isWithdrawAll) {
        return {
          to,
          data: encodeFunctionData({
            abi: VAULT_WITHDRAW_ABI,
            functionName: 'withdraw',
            // owner === receiver: the user redeems their own shares to themselves.
            args: [amountUnits, receiver, receiver]
          })
        }
      }

      // Full exit → burn the exact share balance (see the docblock above).
      // Spark's non-Ethereum vaults carry a `minAssets` floor; the other two
      // take the plain 3-arg redeem.
      if (market.type === 'spark') {
        return {
          to,
          data: encodeFunctionData({
            abi: SPARK_REDEEM_ABI,
            functionName: 'redeem',
            args: [shareBalance, receiver, receiver, minAssets]
          })
        }
      }

      return {
        to,
        data: encodeFunctionData({
          abi: VAULT_REDEEM_ABI,
          functionName: 'redeem',
          args: [shareBalance, receiver, receiver]
        })
      }
    }

    default:
      // The form refuses unknown market types before it renders a submit button,
      // so this is unreachable in practice. Throwing (rather than returning a
      // malformed tx) keeps a future protocol from being silently mis-encoded
      // into a call against the user's funds.
      throw new Error(`Unsupported lending market type: ${market?.type}`)
  }
}

export default buildWithdrawTx
