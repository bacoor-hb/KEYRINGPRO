import BigNumber from 'bignumber.js'
import I18n, { resolveLocale } from 'assets/Lang'
import { convertWeiToBalance } from 'common/function'
import { getNativeTokenSymbolByChain } from 'common/chain'
import AllChainServices from 'controller/AllChainServices'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import { CONVERT_TO_SHARES_ABI, VAULT_BALANCE_OF_ABI, VAULT_TYPES } from './abis'
import { buildApproveTxs, toUnits } from './buildSupplyTx'

// On-chain reads the supply flow depends on: the allowance that decides whether
// an approve leg is needed, the share preview behind "Est. Received", and the
// per-protocol safety questions.
//
// Same conventions as WalletActionForm/preCheck.js — reads go through ViemWeb3
// (so they inherit the app's fallback RPC handling), the hex chain id from the
// agent is normalized to a decimal, and a read that FAILS is never allowed to
// block a supply on its own.
//
// `checkVaultProtection` is the one check written to fail CLOSED, and it is
// currently NOT called by `supplyPreCheck` — see its docblock.
//
// `checkGasAffordable` simulates the APPROVE leg only — the deposit is budgeted
// against a flat ceiling because it cannot be simulated before the allowance it
// spends exists. So a deposit that would revert is still caught at broadcast,
// not before.

const tr = (key, language, opts) =>
  I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })

const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

const ERC20_ALLOWANCE_ABI = [{
  name: 'allowance',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ],
  outputs: [{ name: '', type: 'uint256' }]
}]

// Aave exposes its per-reserve pause/freeze flags through the pool's data
// provider rather than the pool itself; `getReserveData` on the protocol data
// provider is the read the app uses. Rather than depend on that extra address
// travelling from the core, the supply is simply attempted.
//
// Note this is NOT covered by `checkGasAffordable`: that simulates the APPROVE,
// which succeeds whether or not the reserve is paused. Only the deposit would
// revert, and it cannot be simulated before the allowance exists — so a paused
// reserve surfaces as a failed deposit after the approve has been paid for.

const client = (chainId) => {
  try {
    return ViemWeb3.getPublicClient(toChainId(chainId)) || null
  } catch (_err) {
    return null
  }
}

/**
 * Current USDC allowance the market holds, in smallest units. Returns null when
 * it cannot be read — the caller then assumes an approval IS needed, which is
 * the safe direction: a redundant approve costs gas, a missing one reverts the
 * deposit after the user has already signed.
 */
export const readAllowance = async ({ chainId, owner, asset, market }) => {
  const c = client(chainId)
  if (!c) return null
  try {
    const raw = await c.readContract({
      abi: ERC20_ALLOWANCE_ABI,
      address: asset.address,
      functionName: 'allowance',
      args: [owner, market.contract]
    })
    return BigInt(String(raw))
  } catch (_err) {
    return null
  }
}

/**
 * Whether the supply needs an `approve` leg in front of the deposit. True on an
 * unreadable allowance, for the reason in readAllowance.
 */
export const needsApprovalFor = async ({ chainId, owner, asset, market, amount }) => {
  const want = toUnits(amount, asset.decimals)
  if (want <= 0n) return false
  const allowance = await readAllowance({ chainId, owner, asset, market })
  if (allowance === null) return true
  return allowance < want
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Poll `allowance` until the market can actually pull `amount`.
 *
 * This is the supply flow's ONLY gate between the approve and the deposit — it
 * stands in for waiting on the approval's receipt, and covers strictly more:
 *
 *  - The receipt is fetched from one RPC (`getRpcUrlByChain`) while the deposit
 *    is built after reading through ViemWeb3's fallback pool of several. A node
 *    in that pool can be a block or two behind the one that returned the
 *    receipt and still report the OLD allowance; a deposit sent on that view
 *    reverts, having already charged the user for the approval.
 *  - Reading the allowance answers the question that actually matters ("can the
 *    market pull the funds?") instead of a proxy for it, so it also covers an
 *    allowance already in place for any other reason.
 *
 * Cheap — one `eth_call` per attempt — and it settles the moment the node
 * catches up, so the common case returns in a tick or two rather than after a
 * fixed wait. The window must therefore span the approve being MINED as well as
 * propagating: 40 × 1.5s ≈ 60s, comfortably past a slow Ethereum block while
 * still bounded.
 *
 * Returns true when the allowance covers the amount, false if it never did
 * within the window (the caller then reports the approval rather than sending a
 * deposit that would revert).
 */
export const waitForAllowance = async ({
  chainId,
  owner,
  asset,
  market,
  amount,
  attempts = 40,
  intervalMs = 1500
}) => {
  const want = toUnits(amount, asset.decimals)
  if (want <= 0n) return false

  for (let i = 0; i < attempts; i++) {
    const allowance = await readAllowance({ chainId, owner, asset, market })
    // `null` is an unreadable RPC, not a confirmed-zero allowance — keep trying
    // rather than declaring the approval failed on a transport hiccup.
    if (allowance !== null && allowance >= want) return true
    if (i < attempts - 1) await sleep(intervalMs)
  }
  return false
}

/**
 * ERC-4626 share preview: how many receipt-token shares `amount` would mint
 * right now. Only vault markets (Spark, Spark-ETH, Morpho) have it — Aave and
 * Compound credit 1:1, so they return null and the form shows the input amount.
 *
 * Null on any failure, so "Est. Received" simply shows nothing rather than a
 * fabricated figure.
 */
export const previewShares = async ({ chainId, market, asset, amount }) => {
  if (!VAULT_TYPES.includes(market.type)) return null
  const units = toUnits(amount, asset.decimals)
  if (units <= 0n) return null

  const c = client(chainId)
  if (!c) return null
  try {
    const raw = await c.readContract({
      abi: CONVERT_TO_SHARES_ABI,
      address: market.contract,
      functionName: 'convertToShares',
      args: [units]
    })
    return BigInt(String(raw))
  } catch (_err) {
    return null
  }
}

// A Morpho vault with no meaningful dead-share balance is vulnerable to the
// ERC-4626 inflation ("donation") attack, where the first depositor's shares can
// be rounded to zero by a donation to the vault. The CoinPool app refuses to
// deposit into such a vault; this mirrors that threshold exactly.
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD'
const MIN_REQUIRED_DEAD_SHARES = BigInt(1e12)

/**
 * Morpho only: the vault must hold burned "dead" shares, proving it is seeded
 * against the inflation attack.
 *
 * NOT CURRENTLY WIRED UP — `supplyPreCheck` no longer calls this, so a Morpho
 * supply proceeds without asking the question. Kept because nothing else can
 * answer it: an inflation-attackable deposit SUCCEEDS on-chain and silently
 * mints the user zero (or near-zero) shares, so there is no revert for the gas
 * check, the broadcast path, or a simulation to find. Re-add the call to
 * `supplyPreCheck` to restore the protection.
 *
 * Fails CLOSED when it does run — an unreadable result blocks the supply —
 * because staying permissive would defeat the point of asking.
 */
export const checkVaultProtection = async ({ chainId, market, language }) => {
  if (market.type !== 'morpho-v2') return null

  const c = client(chainId)
  if (!c) return tr('supplyVaultUnverified', language)
  try {
    const raw = await c.readContract({
      abi: VAULT_BALANCE_OF_ABI,
      address: market.contract,
      functionName: 'balanceOf',
      args: [DEAD_ADDRESS]
    })
    return BigInt(String(raw)) >= MIN_REQUIRED_DEAD_SHARES
      ? null
      : tr('supplyVaultUnprotected', language)
  } catch (_err) {
    return tr('supplyVaultUnverified', language)
  }
}

/**
 * USDC balance must cover the amount being supplied. Asks the token contract
 * rather than trusting the balance the agent resolved when the message was
 * built, which can be stale by submit time. Permissive on a failed read, like
 * the other balance checks in the app.
 */
export const checkUsdcBalance = async ({ chainId, from, asset, amount, language }) => {
  const want = BigNumber(amount)
  if (!want.isFinite() || want.lte(0)) return null

  const have = BigNumber(
    await ViemWeb3.getBalanceToken(toChainId(chainId), from, asset.address, true)
  )
  if (!have.isFinite() || have.lte(0)) return null
  if (have.gte(want)) return null

  return tr('walletActionNotEnoughBalance', language, {
    symbol: asset.symbol || 'USDC',
    balance: have.toFixed()
  })
}

// Same 10% headroom `useSendTx`'s pre-flight puts on a single tx, for the same
// reason: gas price moves between the estimate and the broadcast.
//
// This compounds with the 1.1x `getGasPrice` already applies by default, for an
// effective ~1.21x. That double-bump is exactly what `preflightTx` does, and it
// is kept rather than corrected so a supply and a plain send agree on whether
// the same wallet can afford the same chain.
const FEE_BUFFER = 1.1

// Gas budgeted for the SUPPLY leg alone, as a flat limit.
//
// Fixed rather than estimated because this leg cannot be measured before it is
// sendable: it spends an allowance that does not exist yet, so `estimateGas` on
// it reverts and would report "cannot be completed" for a supply that is
// perfectly fine. A flat ceiling sidesteps that entirely.
//
// 600k comfortably covers every deposit this form builds (Aave supply, Compound
// supply and ERC-4626 deposit land roughly 150k-250k) and is deliberately an
// over-estimate: being asked to top up slightly early beats paying for an
// approve and then stalling with no gas left for the deposit it exists to
// enable.
const SUPPLY_GAS_LIMIT = 600000

/**
 * Can this wallet actually pay the gas for the supply?
 *
 * The gap this closes: every other check here is about USDC and vault safety,
 * but a supply is paid for in the chain's native coin. Without this the flow
 * would sign and broadcast the approve, charge the user for it, and only then
 * discover there is nothing left to send the deposit with — leaving a standing
 * allowance and no position. `useSendTx` spares WalletActionForm exactly this
 * via `preflightTx`; the supply flow does not use that hook, so it checks here.
 *
 * The budget is the sum of both legs, since both are paid from the same native
 * balance: the approve's REAL estimate, plus the supply leg at a flat ceiling
 * (see SUPPLY_GAS_LIMIT) because it cannot be simulated before the allowance
 * exists.
 *
 * Simulating the approve also means a genuinely broken approve is caught here,
 * before anything is signed. It says nothing about the DEPOSIT though — that
 * leg is only ever budgeted, never simulated — so a paused reserve or a bad
 * deposit still surfaces at broadcast.
 *
 * Permissive on its OWN failures, matching `preflightTx`: an unreadable gas
 * price or balance means we cannot tell, and blocking a user who could have
 * sent is worse than letting the broadcast path report the real error.
 */
export const checkGasAffordable = async ({ chainId, from, market, asset, amount, language }) => {
  const id = toChainId(chainId)

  // The approve is the one leg that CAN be measured: it touches only the user's
  // own token balance and depends on nothing prior. Skipped entirely when the
  // standing allowance already covers the amount, because `useSupplyFlow` will
  // then skip the approve too — charging a repeat supply for a transaction it
  // won't make would tell a perfectly funded wallet to top up.
  const willApprove = await needsApprovalFor({ chainId, owner: from, asset, market, amount })

  let approveGas = 0
  if (willApprove) {
    const [approveTx] = buildApproveTxs({ market, asset, amount })
    approveGas = await AllChainServices.estimateGasTxs(id, {
      to: approveTx.to,
      from,
      data: approveTx.data || '0x'
    })

    // estimateGasTxs resolves to 0 both on revert and when no RPC answered, so
    // it cannot distinguish them — hence the non-committal copy, the same
    // wording `preflightTx` uses for the same ambiguity.
    if (!approveGas || BigNumber(approveGas).lte(0)) {
      return tr('walletActionEstimateFailed', language)
    }
  }

  const gasPrice = await AllChainServices.getGasPrice(id)
  // No gas price means the fee comparison is meaningless — everything is
  // "affordable" against a zero fee — so there is nothing to check.
  if (!gasPrice || BigNumber(gasPrice).lte(0)) return null

  // feeTotal = the measured approve fee + the supply leg at its flat ceiling.
  // Both legs are paid from the same native balance, so the wallet has to cover
  // their sum, not whichever is larger.
  const approveFee = BigNumber(gasPrice).multipliedBy(approveGas)
  const supplyFee = BigNumber(gasPrice).multipliedBy(SUPPLY_GAS_LIMIT)
  const requiredWei = approveFee.plus(supplyFee).multipliedBy(FEE_BUFFER)

  const balanceWei = BigNumber(
    await AllChainServices.getBalanceByChain(id, from, false)
  )
  // An unreadable balance also comes back as 0, which would look like "no
  // funds" and wrongly block someone who can pay.
  if (!balanceWei.isFinite() || balanceWei.lte(0)) return null
  if (balanceWei.gte(requiredWei)) return null

  // Shown in full, to every decimal the wei difference actually has. A rounded
  // figure here is worse than a long one: rounding DOWN would name a top-up that
  // still leaves the user short, and rounding UP asks for more than is owed.
  // `toFixed()` (no argument) also avoids the exponential notation `toString()`
  // would produce for the very small numbers this often is.
  const shortfall = BigNumber(
    convertWeiToBalance(requiredWei.minus(balanceWei).toFixed(0))
  ).toFixed()
  const symbol = getNativeTokenSymbolByChain(Number(id))
  // Symbol-less phrasing rather than a gap in the sentence when the chain is
  // not in the catalog (custom network, catalog not loaded yet).
  return symbol
    ? tr('walletActionNotEnoughFee', language, { amount: shortfall, symbol })
    : tr('walletActionNotEnoughFeeNoSymbol', language, { amount: shortfall })
}

/**
 * The supply flow's full pre-submit check, in the order that fails cheapest
 * first: the USDC balance the user can see, then the gas both legs will cost.
 *
 * Returns an error string to stop, or null to proceed. Run by `useSupplyFlow`
 * BEFORE the approval, so a supply that cannot succeed never leaves a pointless
 * allowance (and its fee) behind.
 *
 * `checkVaultProtection` is deliberately NOT part of this sequence — see its own
 * docblock for what that means for Morpho vaults.
 */
export const supplyPreCheck = async ({ chainId, from, market, asset, amount, language }) => {
  const balanceError = await checkUsdcBalance({ chainId, from, asset, amount, language })
  if (balanceError) return balanceError

  return checkGasAffordable({ chainId, from, market, asset, amount, language })
}
