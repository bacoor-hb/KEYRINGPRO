import BigNumber from 'bignumber.js'
import I18n from 'assets/Lang'
import { convertWeiToBalance } from 'common/function'
import { getNativeTokenSymbolByChain } from 'common/chain'
import AllChainServices from 'controller/AllChainServices'
import ViemWeb3 from 'src/Web3/ViemWeb3'
// The token list values a cross-chain sUSDS position with this exact function;
// the withdraw form sizes an exit against the same position, so it calls the
// same one rather than keeping a second copy of the arithmetic.
import { convertSusdsShares } from 'keyring-agent-core'
// The app's existing safe-max target (1.01). Imported rather than redeclared so
// this module and `useCalculateSafeMaxWithdraw` can never disagree.
import { TARGET_HEALTH_FACTOR } from 'frontend/Hooks/useCalculateSafeMaxWithdraw'
import {
  AAVE_ADDRESSES_PROVIDER_ABI,
  AAVE_GET_ASSET_PRICE_ABI,
  AAVE_GET_PRICE_ORACLE_ABI,
  AAVE_USER_ACCOUNT_DATA_ABI,
  CONVERT_TO_ASSETS_ABI,
  BPS_DENOMINATOR,
  ERC20_ALLOWANCE_ABI,
  ERC20_BALANCE_OF_ABI,
  ERC20_DECIMALS_ABI,
  MAX_WITHDRAW_ABI,
  PREVIEW_WITHDRAW_ABI,
  PSM3_PREVIEW_SWAP_EXACT_IN_ABI,
  PSM3_SLIPPAGE_BPS,
  RAY,
  SSR_CONVERSION_RATE_ABI,
  isOraclePricedType
} from './abis'
import { buildWithdrawTx, isVaultType } from './buildWithdrawTx'

// On-chain reads behind the withdraw form: how much can actually come out, and
// what it costs the user's borrow position to take it.
//
// Same conventions as the supply side (ChatAgent/SupplyUsdcForm/supplyChecks.js)
// — reads go through ViemWeb3 so they inherit the app's ordered/fallback RPC
// handling, and every read is written to degrade rather than throw. A failed
// read must never be the thing that blocks a withdrawal the user could actually
// make; it falls back to the wallet's own receipt-token balance instead.

const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

/**
 * The health factor a withdrawal is allowed to leave behind — a hair above
 * liquidation (1.0), matching Aave's own UI.
 *
 * Re-exported from the app's existing hook rather than redeclared, so the safe
 * max computed here can never drift from the one that hook computes.
 */
export { TARGET_HEALTH_FACTOR }

/** Aave reports base-currency amounts with 8 decimals and the health factor with 18. */
const AAVE_BASE_DECIMALS = 8
const WAD = BigNumber(10).pow(18)

const toBig = (value) => {
  const bn = BigNumber(String(value ?? '0'))
  return bn.isFinite() ? bn : BigNumber(0)
}

/**
 * The underlying's decimals, or null when core could not resolve them.
 *
 * MUST be used instead of `asset?.decimals ?? 18`. Core reports an unresolvable
 * asset as `{ address: <zero address>, decimals: NaN, symbol: null }` — and `??`
 * does NOT catch NaN, only null/undefined. Letting that NaN through scales every
 * amount by `10^NaN`, so the withdrawable balance renders as NaN; defaulting it
 * to 18 is worse still, because a 6-decimal USDC vault would then overstate the
 * position by a factor of 10^12.
 *
 * Null here means "we cannot size this position safely", which the form surfaces
 * rather than guessing — the same fail-closed rule core itself applies (see its
 * `Number.isFinite(asset.decimals)` guard).
 */
export const assetDecimalsOf = (asset) => {
  const raw = asset?.decimals
  // Checked BEFORE Number(): `Number(null)` and `Number('')` are both 0, which
  // would sail through the integer test below and be accepted as a real
  // 0-decimal token — turning a missing value into a valid-looking scale.
  if (raw === null || raw === undefined || raw === '') return null
  const decimals = Number(raw)
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null
  return decimals
}

/** Smallest units → human string, without going through a JS number. */
export const fromUnits = (units, decimals) =>
  toBig(units?.toString?.() ?? units)
    .div(BigNumber(10).pow(decimals ?? 18))
    .toFixed()

const readContract = async (chainId, call) => {
  try {
    return await ViemWeb3.readContract(toChainId(chainId), call)
  } catch (_err) {
    return null
  }
}

/**
 * The receipt-token balance the wallet holds, in smallest units.
 *
 * For Aave and Compound this IS the underlying balance — those receipts rebase,
 * so 1 aUSDC is always 1 USDC. For the ERC-4626 vaults it is a SHARE count,
 * worth more than its face value, and must be converted before being shown.
 */
export const readReceiptBalance = async ({ chainId, receiptToken, owner }) => {
  if (!receiptToken || !owner) return null
  const balance = await readContract(chainId, {
    address: receiptToken,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [owner]
  })
  return typeof balance === 'bigint' ? balance : null
}

/**
 * `shares × rate`, in smallest units of the UNDERLYING — the stand-in for
 * `convertToAssets` on a token that has none.
 *
 * Delegates to `convertSusdsShares` in keyring-agent-core rather than repeating
 * its arithmetic, so the withdraw form and the token list cannot disagree about
 * the same position — a drift here would be silent and wrong by exactly the
 * yield accrued. The core function is BigInt throughout (a ray divisor has no
 * exact float representation) and applies the decimals correction itself; see
 * its doc for why that correction matters even though sUSDS and USDS are both 18.
 *
 * Kept as a local wrapper for the named-argument shape: core takes the two
 * decimals POSITIONALLY as `(shareDecimals, assetDecimals)`, which is the one
 * pair in this file that silently misreports a position by orders of magnitude
 * if transposed. Naming them at every call site is what stops that.
 */
const convertByRate = (shares, rate, { assetDecimals, shareDecimals }) =>
  convertSusdsShares(shares, rate, shareDecimals, assetDecimals)

/**
 * How much of the UNDERLYING this position is worth right now, in smallest
 * units, alongside the raw receipt balance.
 *
 * The two differ for vault markets and are both needed: the amount drives what
 * the user may type, while the share balance is what a full exit redeems.
 *
 * For a vault the position's value is `convertToAssets(shares)` — what the
 * shares are worth in the underlying. That is the number the form is sized
 * against.
 *
 * `maxWithdraw(owner)` is consulted as a LIQUIDITY CAP on top, and only when it
 * is greater than zero. It is NOT authoritative on its own: real Morpho V2
 * vaults return 0 from it while holding a perfectly withdrawable balance (an
 * observed Base USDC vault reported `maxWithdraw = 0` against
 * `convertToAssets = 47083`), so taking its answer at face value reported a live
 * position as empty and disabled the form. Treating 0 as "no cap information"
 * rather than "nothing to withdraw" is what keeps that from happening, while a
 * genuine non-zero cap still narrows the ceiling for a vault that is temporarily
 * short of liquidity.
 *
 * If `convertToAssets` does not answer, the assets are reported as null rather
 * than falling back to the share balance. Shares are a different unit at a
 * different scale (vault decimals, usually 18, against USDC's 6), so
 * substituting one for the other misreports the position by orders of magnitude
 * — the caller shows "cannot read" instead, which is the honest answer.
 */
export const readWithdrawable = async ({ chainId, market, owner }) => {
  const receiptToken = market?.receiptToken
  const shares = await readReceiptBalance({ chainId, receiptToken, owner })

  if (shares === null) return { shares: null, assets: null }

  // Cross-chain sUSDS: share-based, but with no `convertToAssets` to ask. Its
  // value comes from the SSR oracle's ray-scaled rate instead. This must be
  // tested BEFORE the rebasing branch below — falling through to it would report
  // the raw share count as the underlying, understating the position by exactly
  // the yield it has accrued (1000 sUSDS shown as 1000 USDS rather than ~1106).
  if (isOraclePricedType(market?.type)) {
    if (shares === 0n) return { shares: 0n, assets: 0n }
    // `market.contract` is the SSR ORACLE for this family, not a vault — core
    // resolves it through PSM3 at discovery time, because the token names it
    // nowhere.
    const [rate, shareDecimals] = await Promise.all([
      readContract(chainId, {
        address: market.contract,
        abi: SSR_CONVERSION_RATE_ABI,
        functionName: 'getConversionRate'
      }),
      readContract(chainId, {
        address: receiptToken,
        abi: ERC20_DECIMALS_ABI,
        functionName: 'decimals'
      })
    ])
    // No rate → no honest figure. Same rule as the vault branch: the share
    // balance is a different quantity, not a stand-in for the value.
    if (typeof rate !== 'bigint' || rate <= 0n) return { shares, assets: null }
    return {
      shares,
      assets: convertByRate(shares, rate, {
        assetDecimals: Number(market?.asset?.decimals),
        shareDecimals: Number(shareDecimals)
      })
    }
  }

  if (!isVaultType(market?.type)) {
    // Rebasing receipt: balance is already denominated in the underlying.
    return { shares, assets: shares }
  }
  if (shares === 0n) return { shares: 0n, assets: 0n }

  const maxWithdraw = await readContract(chainId, {
    address: market.contract,
    abi: MAX_WITHDRAW_ABI,
    functionName: 'maxWithdraw',
    args: [owner]
  })

  const converted = await readContract(chainId, {
    address: market.contract,
    abi: CONVERT_TO_ASSETS_ABI,
    functionName: 'convertToAssets',
    args: [shares]
  })

  // Dev-only, and only when the position cannot be valued. A vault has three
  // numbers that are easy to confuse — the share balance, its face value, and
  // what the vault will pay out right now — held at two DIFFERENT scales (vault
  // decimals vs the underlying's), so when a figure looks wrong this says which
  // read produced it. Silent on the healthy path: a log on every open is noise.
  if (__DEV__ && typeof converted !== 'bigint') {
    console.log('[withdraw] vault position unreadable', {
      type: market?.type,
      vault: market?.contract,
      assetDecimals: market?.asset?.decimals,
      shares: shares?.toString(),
      maxWithdraw: maxWithdraw?.toString?.() ?? null,
      convertToAssets: converted?.toString?.() ?? null
    })
  }

  // The position's value comes from convertToAssets. Without it there is no
  // honest figure to show — see the docblock for why the share balance is not a
  // substitute.
  if (typeof converted !== 'bigint') return { shares, assets: null }

  // Apply maxWithdraw only as a cap, and only when it actually reports one.
  // A zero here means "no usable answer" (Morpho V2 vaults return 0 routinely),
  // NOT "the position is empty" — treating it as the latter is what showed a
  // live balance as 0.
  const hasCap = typeof maxWithdraw === 'bigint' && maxWithdraw > 0n
  const assets = hasCap && maxWithdraw < converted ? maxWithdraw : converted

  return { shares, assets }
}

/**
 * How many SHARES a typed underlying amount corresponds to, read and converted
 * in one place.
 *
 * The rate and the share scale both have to come from chain, and both are only
 * meaningful together — splitting them across the caller invites one being read
 * without the other. Null when either read fails, which the caller treats as
 * "cannot size the swap" rather than proceeding on a guess.
 */
export const readSharesForAssetUnits = async ({ chainId, oracle, shareToken, assetUnits, assetDecimals, capShares }) => {
  const [rate, shareDecimals] = await Promise.all([
    readContract(chainId, {
      address: oracle,
      abi: SSR_CONVERSION_RATE_ABI,
      functionName: 'getConversionRate'
    }),
    readContract(chainId, {
      address: shareToken,
      abi: ERC20_DECIMALS_ABI,
      functionName: 'decimals'
    })
  ])
  if (typeof rate !== 'bigint' || !Number.isInteger(Number(shareDecimals))) return null
  return assetUnitsToShares({
    assetUnits,
    rate,
    assetDecimals,
    shareDecimals: Number(shareDecimals),
    capShares
  })
}

/**
 * Underlying units → SHARES, the inverse of {@link convertByRate}.
 *
 * The user types an amount of USDS; `swapExactIn` takes sUSDS. Getting this
 * backwards would swap ~10% more of the position than was asked for, so the two
 * directions are written as a matched pair rather than derived ad hoc at the
 * call site.
 *
 * Rounds DOWN, matching `toUnits` and the floor-don't-round rule the rest of the
 * withdraw path follows: a partial exit must never be scaled up past what the
 * user actually holds. `capShares` is the position, applied because the rounding
 * and the rate tick can otherwise put a "maximum" request a few wei above the
 * balance, which `swapExactIn` would revert on.
 */
export const assetUnitsToShares = ({ assetUnits, rate, assetDecimals, shareDecimals, capShares }) => {
  if (typeof assetUnits !== 'bigint' || assetUnits <= 0n) return null
  if (typeof rate !== 'bigint' || rate <= 0n) return null
  if (!Number.isInteger(assetDecimals) || !Number.isInteger(shareDecimals)) return null
  if (assetDecimals < 0 || shareDecimals < 0) return null

  // Undo the decimal shift convertByRate applied, then divide by the rate.
  const exponent = assetDecimals - shareDecimals
  const rebased = exponent > 0
    ? assetUnits / 10n ** BigInt(exponent)
    : assetUnits * 10n ** BigInt(-exponent)

  const shares = (rebased * RAY) / rate
  if (shares <= 0n) return null
  return typeof capShares === 'bigint' && shares > capShares ? capShares : shares
}

/**
 * What a PSM3 exit would pay out, and whether the pool can actually pay it.
 *
 * Three facts the form needs before it lets a user sign, none of which can be
 * inferred from the position alone:
 *
 *   - `amountOut` — the exact proceeds at the current rate, from PSM3's own
 *     `previewSwapExactIn`. Used for the slippage floor, so the floor is derived
 *     from the same contract that will execute the swap rather than from a
 *     separately-read rate that could disagree with it.
 *   - `liquidity` — PSM3's balance of the asset being received. `swapExactIn`
 *     REVERTS when the pool cannot cover the payout, so this is a hard ceiling,
 *     not a hint. Reading it lets the form cap the amount instead of letting the
 *     user sign a transaction that is already doomed.
 *   - `allowance` — PSM3 pulls the sUSDS, so an approval is needed. Reading the
 *     existing one means an already-approved exit costs one transaction, not two.
 *
 * Every field is null on a failed read. The caller treats null liquidity as "no
 * cap information" and null quote as "cannot size the swap", which disables the
 * submit rather than guessing — the same rule the vault path follows.
 */
export const readPsmSwapState = async ({ chainId, psm, shareToken, assetOut, shares, owner }) => {
  const empty = { amountOut: null, liquidity: null, allowance: null }
  if (!psm || !shareToken || !assetOut || !owner) return empty
  if (typeof shares !== 'bigint' || shares <= 0n) return empty

  const [amountOut, liquidity, allowance] = await Promise.all([
    readContract(chainId, {
      address: psm,
      abi: PSM3_PREVIEW_SWAP_EXACT_IN_ABI,
      functionName: 'previewSwapExactIn',
      args: [shareToken, assetOut, shares]
    }),
    readContract(chainId, {
      address: assetOut,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [psm]
    }),
    readContract(chainId, {
      address: shareToken,
      abi: ERC20_ALLOWANCE_ABI,
      functionName: 'allowance',
      args: [owner, psm]
    })
  ])

  return {
    amountOut: typeof amountOut === 'bigint' ? amountOut : null,
    liquidity: typeof liquidity === 'bigint' ? liquidity : null,
    allowance: typeof allowance === 'bigint' ? allowance : null
  }
}

/** The PSM's current allowance over the user's shares, or null on a failed read. */
export const readPsmAllowance = async ({ chainId, shareToken, owner, psm }) => {
  if (!shareToken || !owner || !psm) return null
  const allowance = await readContract(chainId, {
    address: shareToken,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [owner, psm]
  })
  return typeof allowance === 'bigint' ? allowance : null
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Poll `allowance` until PSM3 can actually pull `shares`.
 *
 * The gate between the approve and the swap — and it has to be this, not the
 * approval's receipt, for the same reason the supply flow polls (see
 * `waitForAllowance` in ChatAgent/SupplyUsdcForm/supplyChecks.js):
 *
 *  - The receipt comes from whichever RPC `trackingTx` happened to use, while
 *    the swap is estimated and broadcast against ViemWeb3's fallback pool. A
 *    node in that pool can be a block behind and still report the OLD allowance;
 *    `swapExactIn` sent on that view reverts, after the user has already paid
 *    for the approval.
 *  - It answers the question that actually matters ("can the PSM pull the
 *    shares?") rather than a proxy for it.
 *
 * One `eth_call` per attempt, and it settles the moment the node catches up — so
 * the common case returns in a tick or two instead of after a fixed wait. The
 * window still has to span the approve being MINED as well as propagating:
 * 40 × 1.5s ≈ 60s, past a slow block while staying bounded.
 *
 * Returns true once the allowance covers `shares`, false if it never did within
 * the window. `isCancelled` is polled between attempts so a closed drawer stops
 * the loop instead of holding it for the full minute.
 */
export const waitForPsmAllowance = async ({
  chainId,
  shareToken,
  owner,
  psm,
  shares,
  attempts = 40,
  intervalMs = 1500,
  isCancelled
}) => {
  if (typeof shares !== 'bigint' || shares <= 0n) return false

  for (let i = 0; i < attempts; i++) {
    if (isCancelled?.()) return false
    const allowance = await readPsmAllowance({ chainId, shareToken, owner, psm })
    // `null` is an unreadable RPC, not a confirmed-zero allowance — keep trying
    // rather than declaring the approval failed on a transport hiccup.
    if (allowance !== null && allowance >= shares) return true
    if (i < attempts - 1) await sleep(intervalMs)
  }
  return false
}

/**
 * The slippage floor for a PSM3 swap: the quote less {@link PSM3_SLIPPAGE_BPS}.
 *
 * Null when there is no quote to base it on — which stops `buildPsmSwapTx`, whose
 * contract is that a floor of zero is never acceptable. Sizing the floor off the
 * live quote (rather than off a fixed rate) means it tracks whatever PSM3 will
 * actually pay, so the only thing it has to absorb is the SSR tick between
 * quoting and signing.
 */
export const psmMinAmountOut = (amountOut) => {
  if (typeof amountOut !== 'bigint' || amountOut <= 0n) return null
  const floor = (amountOut * (BPS_DENOMINATOR - PSM3_SLIPPAGE_BPS)) / BPS_DENOMINATOR
  // A quote so small the floor rounds to zero would be rejected by the builder.
  // Falling back to 1 keeps a dust-sized exit signable while still refusing the
  // "no protection at all" case.
  return floor > 0n ? floor : 1n
}

/**
 * How many shares withdrawing `assetUnits` would burn — the "Refund amount" the
 * form shows for a vault market. Null when the vault does not implement the
 * preview, in which case the row simply isn't rendered rather than guessed.
 */
export const previewWithdrawShares = async ({ chainId, market, assetUnits }) => {
  if (!isVaultType(market?.type) || !assetUnits || assetUnits <= 0n) return null
  const shares = await readContract(chainId, {
    address: market.contract,
    abi: PREVIEW_WITHDRAW_ABI,
    functionName: 'previewWithdraw',
    args: [assetUnits]
  })
  return typeof shares === 'bigint' ? shares : null
}

/**
 * The user's Aave account-wide position: collateral, debt and health factor.
 *
 * Only meaningful for `aave-v3`, and only interesting when the user has BORROWED
 * against the same pool — which is the case this whole module exists for. Null
 * for every other market type, and null when the read fails.
 */
export const readAaveAccountData = async ({ chainId, market, owner }) => {
  if (market?.type !== 'aave-v3' || !owner) return null

  const data = await readContract(chainId, {
    address: market.contract,
    abi: AAVE_USER_ACCOUNT_DATA_ABI,
    functionName: 'getUserAccountData',
    args: [owner]
  })
  if (!Array.isArray(data) || data.length < 6) return null

  const [totalCollateralBase, totalDebtBase, , currentLiquidationThreshold, , healthFactor] = data

  return {
    // Base currency (USD), 8 decimals.
    totalCollateral: toBig(totalCollateralBase).div(BigNumber(10).pow(AAVE_BASE_DECIMALS)),
    totalDebt: toBig(totalDebtBase).div(BigNumber(10).pow(AAVE_BASE_DECIMALS)),
    // Basis points → ratio (7800 → 0.78).
    liquidationThreshold: toBig(currentLiquidationThreshold).div(10000),
    // WAD-scaled. With no debt Aave returns type(uint256).max, which is not a
    // number worth carrying around — report it as null and let `hasDebt` say it.
    healthFactor: toBig(totalDebtBase).isZero() ? null : toBig(healthFactor).div(WAD),
    hasDebt: toBig(totalDebtBase).gt(0)
  }
}

/**
 * The asset's price according to AAVE'S OWN oracle, in the pool's base currency
 * (8 decimals), as a BigNumber. Null when any hop fails.
 *
 * Three reads: pool → `ADDRESSES_PROVIDER()` → `getPriceOracle()` →
 * `getAssetPrice(asset)`. Resolved from the pool rather than hardcoded per chain
 * so it works on every network the app supports, including ones added later.
 *
 * This price is not interchangeable with the app's own price API. Aave values
 * the collateral and debt in `getUserAccountData` with THIS oracle, so the USD
 * surplus computed from those figures has to be converted back into tokens with
 * the same one — mixing feeds produces a number the protocol never agrees with,
 * which is exactly how a "safe max" ends up rejected on chain.
 */
export const readAaveAssetPrice = async ({ chainId, market }) => {
  const pool = market?.contract
  const assetAddress = market?.asset?.address
  if (!pool || !assetAddress) return null

  const provider = await readContract(chainId, {
    address: pool,
    abi: AAVE_ADDRESSES_PROVIDER_ABI,
    functionName: 'ADDRESSES_PROVIDER'
  })
  if (!provider) return null

  const oracle = await readContract(chainId, {
    address: provider,
    abi: AAVE_GET_PRICE_ORACLE_ABI,
    functionName: 'getPriceOracle'
  })
  if (!oracle) return null

  const price = await readContract(chainId, {
    address: oracle,
    abi: AAVE_GET_ASSET_PRICE_ABI,
    functionName: 'getAssetPrice',
    args: [assetAddress]
  })
  if (typeof price !== 'bigint' || price <= 0n) return null

  return toBig(price.toString()).div(BigNumber(10).pow(AAVE_BASE_DECIMALS))
}

/**
 * The largest withdrawal that keeps an Aave position clear of liquidation.
 *
 * This is THE APP'S OWN formula, ported from `useCalculateSafeMaxWithdraw`
 * (`src/Frontend/Hooks`), which predates this drawer. That hook was written
 * against an Aave SDK shape (`userMarketData` / `dataReserve`) that nothing
 * feeds any more, so the arithmetic and its guards are reproduced here over the
 * on-chain readers above rather than the hook being called. Keep the two in step
 * if either changes.
 *
 * Steps, in the hook's order:
 *
 *   1. No debt        → withdraw everything (reported as `null`, "no constraint").
 *   2. HF below target→ zero. A position already at or under the target cannot
 *                       give anything back without crossing it.
 *   3. minCollateral  = debt × TARGET_HEALTH_FACTOR / liquidationThreshold
 *   4. surplus (base) = totalCollateral − minCollateral
 *   5. tokens         = surplus / assetPrice, clamped to the balance
 *   6. floor to the asset's decimals, ROUND_DOWN
 *
 * `assetPrice` must come from Aave's own oracle (`readAaveAssetPrice`), in the
 * pool's base currency. Every term then shares one valuation: the collateral and
 * debt come from `getUserAccountData`, which Aave values with that same oracle.
 * Mixing in the app's price API yields a ceiling the protocol does not agree
 * with — the mistake this function previously made, which is why a borrowing
 * position reported its whole balance as withdrawable.
 *
 * NOTE this REPLACES the balance rather than merely capping it: with debt
 * outstanding, what may be withdrawn is bounded by the collateral surplus, which
 * is usually far below the balance. It is still clamped to the balance, since
 * you cannot withdraw more than you supplied.
 *
 * Returns a BigNumber of the UNDERLYING, never more than `balance`, never below
 * zero. `null` means "no constraint" — caller should use the full balance.
 *
 * @param {object} accountData  From readAaveAccountData.
 * @param {BigNumber|string} balance   Withdrawable balance, human units.
 * @param {BigNumber} assetPrice Aave-oracle price of the underlying, base currency.
 * @param {number} [decimals]   Asset decimals; the result is floored to them.
 */
export const safeMaxWithdrawFor = ({ accountData, balance, assetPrice, decimals }) => {
  const bal = toBig(balance)
  // Step 1 — nothing borrowed against this collateral, so all of it can leave.
  if (!accountData || !accountData.hasDebt) return null
  if (bal.lte(0)) return BigNumber(0)

  const { totalCollateral, totalDebt, liquidationThreshold, healthFactor } = accountData

  // Step 2 — already at or below the target. The hook checks this BEFORE doing
  // any arithmetic: such a position has no surplus to give back, and the
  // subtraction below would only produce a negative number anyway. Aave reports
  // an infinite HF when there is no debt, which step 1 has already returned on.
  if (healthFactor !== null && healthFactor.isFinite() && healthFactor.lt(TARGET_HEALTH_FACTOR)) {
    return BigNumber(0)
  }

  // A zero threshold would divide by zero; treat an unreadable one as "cannot
  // size this safely" rather than inventing a number.
  if (liquidationThreshold.lte(0)) return BigNumber(0)

  // Steps 3–4.
  const minCollateral = totalDebt.times(TARGET_HEALTH_FACTOR).div(liquidationThreshold)
  const surplusBase = totalCollateral.minus(minCollateral)
  if (surplusBase.lte(0)) return BigNumber(0)

  const price = toBig(assetPrice)
  // Without a usable price the surplus cannot be converted into tokens.
  // Returning the full balance would be exactly the unsafe guess this function
  // exists to prevent, so report zero and let the UI explain why.
  //
  // (The hook defaults a missing price to 1, which is safe for the USDC market
  // it was written for but would overstate any asset worth more than a dollar —
  // an 18-decimal WETH position by ~3000×. Failing closed instead.)
  if (price.lte(0)) return BigNumber(0)

  // Step 5.
  const maxTokens = surplusBase.div(price)
  const clamped = maxTokens.gt(bal) ? bal : maxTokens

  // Step 6 — floor to the asset's own precision, so the figure the Max button
  // fills in is one the token can actually represent. ROUND_DOWN, never up.
  const dp = Number.isInteger(decimals) ? decimals : null
  return dp === null ? clamped : clamped.decimalPlaces(dp, BigNumber.ROUND_DOWN)
}

// Headroom on the estimated fee, matching `useSendTx`'s pre-flight and the
// supply form's `checkGasAffordable`: gas price moves between the estimate and
// the broadcast. Compounds with the 1.1x `getGasPrice` applies by default, for
// an effective ~1.21x — kept rather than corrected so a withdrawal and a plain
// send agree on whether the same wallet can afford the same chain.
const FEE_BUFFER = 1.1

// Headroom applied to a MEASURED estimate before it is signed with, matching
// `useSendTx`'s GAS_LIMIT_BUFFER and the supply form's.
//
// `eth_estimateGas` measures the tx against state as it is NOW, but the tx runs
// against state as it will be once mined, and the difference is paid in gas: a
// storage slot the estimate saw as non-zero costs 2.9k to update, while the same
// slot going 0 -> non-zero costs 20k. A lending market is precisely where that
// bites — it accrues interest every block and anyone else's tx can move a slot
// across that boundary — so the real cost lands ABOVE what was measured and the
// withdrawal reverts out of gas with the fee already spent.
//
// Not a cost to the user: the fee billed is `gasUsed x gasPrice`, so an unspent
// limit is never charged — unlike FEE_BUFFER above, which buffers the gas PRICE
// and is paid in full.
//
// Redeclared rather than imported from `useSendTx`: that module pulls in the
// Redux store (via `common/wallet`), which this one deliberately does not depend
// on. Keep the two numbers in step.
const GAS_LIMIT_BUFFER = 1.2

/** A node estimate plus GAS_LIMIT_BUFFER, or 0 when there is no usable estimate. */
const withGasBuffer = (estimate) => {
  const bn = BigNumber(estimate)
  if (!bn.isFinite() || bn.lte(0)) return 0
  return bn.multipliedBy(GAS_LIMIT_BUFFER).integerValue(BigNumber.ROUND_CEIL).toNumber()
}

/**
 * Ask the node what `tx` costs to run, the way both fee checks need it asked.
 *
 * Estimated WITHOUT a gasPrice, the same way `postBaseSendTxs` does it. With one
 * the node prepays the fee out of the simulated balance and reports a revert on
 * a wallet that is merely low — which is exactly the wallet these checks exist
 * to warn, so it would turn "you need 0.002 ETH" into "this cannot be done".
 *
 * `value` is forwarded only when the tx actually carries one: passing an
 * explicit `undefined`/empty is not the same as omitting the field to every RPC.
 *
 * Resolves to 0 on BOTH a revert and an unanswered RPC — `estimateGasTxs` cannot
 * tell those apart, and each caller decides what that zero means for it.
 */
const estimateTxGas = (chainId, from, tx) => AllChainServices.estimateGasTxs(chainId, {
  to: tx.to,
  from,
  data: tx.data || '0x',
  ...(tx.value != null && tx.value !== '' ? { value: tx.value } : {})
})

/**
 * What `gasLimit` costs at `gasPrice`, plus FEE_BUFFER — the one place the fee
 * arithmetic lives, so the open-time warning and the pre-sign block can never
 * price the same withdrawal differently.
 */
const feeForGasLimit = (gasPrice, gasLimit) =>
  BigNumber(gasPrice).multipliedBy(gasLimit).multipliedBy(FEE_BUFFER)

/**
 * Can this wallet pay the network fee for `tx`?
 *
 * The gap this closes: every other check in this module is about the POSITION,
 * but a withdrawal is paid for in the chain's native coin. Without it, a wallet
 * holding a lending position and no ETH signs, broadcasts, and gets back either
 * a bare RPC rejection or a generic "something went wrong" — with nothing
 * saying the missing piece is gas.
 *
 * Called per LEG, immediately before that leg is signed, and it measures ONLY
 * that leg. Nothing is budgeted ahead: the PSM3 exit's approve is checked
 * against the approve's own estimate, and the swap is checked separately, after
 * the approve has been mined and paid for — by which point the allowance exists,
 * so `swapExactIn` simulates for real rather than reverting. Every figure here
 * is therefore measured, never a flat ceiling standing in for one.
 *
 * The trade that ordering accepts: a wallet with just enough for the approve and
 * not the swap pays for the approve and is stopped at the swap. That is the
 * behaviour asked for, and it costs the user less than it sounds — the allowance
 * is on-chain and still stands, so a retry after topping up skips the approve
 * entirely and costs one transaction, not two.
 *
 * Permissive about its OWN failures, matching `preflightTx` and the supply
 * form: an unreadable gas price or balance means we cannot tell, and blocking
 * someone who could have paid is worse than letting the broadcast report the
 * real error. The one thing it does report is a failed ESTIMATE, which is a
 * positive signal that the call itself would revert.
 *
 * The copy is REUSED from `chatAgent.*` rather than restated under
 * `v2.withdrawToken`: "you need X more to cover the network fee" and "this
 * transaction cannot be completed" say exactly what this check means, and those
 * keys are already translated into all 16 languages — a withdraw-specific copy
 * of the same sentence would have shipped in two.
 *
 * One message for every leg, deliberately. Naming which transaction is short
 * would not change what the user does about it: the answer is the same top-up
 * either way, and the amount is right there in the sentence.
 *
 * ## The limit it hands back
 *
 * `onGasLimit` receives the BUFFERED estimate — the number this leg is meant to
 * be signed with — and everything below budgets against that same number rather
 * than the bare estimate. That identity is the point: the node rejects a
 * transaction whose `gasLimit x gasPrice` exceeds the balance no matter what it
 * would really have spent, so budgeting the estimate while signing 20% above it
 * would clear a thin wallet here and then fail it at broadcast with
 * "insufficient funds for gas * price + value". Handing it back also means the
 * caller signs without making `postBaseSendTxs` estimate the same tx twice.
 *
 * @param {number|string} chainId
 * @param {string} from        The signer, whose native balance pays the fee.
 * @param {object} tx          `{ to, data, value }`, as built for postBaseSendTxs.
 * @param {Function} [onGasLimit] Called with the buffered gas limit this leg
 *   should be signed with, when one could be measured.
 * @returns {Promise<string|null>} An error to show, or null to proceed.
 */
export const checkTxFeeAffordable = async ({ chainId, from, tx, onGasLimit }) => {
  const id = toChainId(chainId)
  if (!from || !tx?.to) return null

  const gas = await estimateTxGas(id, from, tx)

  // `estimateGasTxs` resolves to 0 both on revert and when no RPC answered, so
  // it cannot tell the two apart — hence the non-committal copy, matching the
  // wording `preflightTx` uses for the same ambiguity.
  if (!gas || BigNumber(gas).lte(0)) return I18n.t('chatAgent.walletActionEstimateFailed')

  // The limit this leg will actually be SIGNED with. A lending withdrawal is
  // exactly the case GAS_LIMIT_BUFFER exists for: these markets accrue interest
  // every block, so a tx landing between the estimate and the mine can move a
  // storage slot from zero to non-zero (20k gas instead of 2.9k) and the bare
  // estimate reverts out of gas with the fee already spent. Costs the user
  // nothing when unused — the fee billed is `gasUsed x gasPrice`, so an unspent
  // limit is never charged.
  const signedGasLimit = withGasBuffer(gas)
  if (signedGasLimit > 0) onGasLimit?.(signedGasLimit)

  const gasPrice = await AllChainServices.getGasPrice(id)
  // No gas price makes the comparison meaningless — every fee is zero — so
  // there is nothing to check.
  if (!gasPrice || BigNumber(gasPrice).lte(0)) return null

  const requiredWei = feeForGasLimit(gasPrice, signedGasLimit || gas)

  // Same sentence, same arithmetic as the open-time warning — see
  // `feeShortfallMessage`, which is shared so the two can never disagree about
  // whether this wallet can pay.
  return feeShortfallMessage({ chainId: id, from, requiredWei })
}

// The limit a withdrawal is BUDGETED at when its own estimate is unavailable.
//
// The open-time check (below) runs before the user has typed anything, so there
// is no real amount to simulate and `eth_estimateGas` on a zero-amount call
// reverts on most of these markets — an Aave withdraw of 0 reverts outright.
// A flat ceiling sidesteps that: it answers "could this wallet pay for a
// withdrawal at all", which is the only question worth asking at open.
//
// 600k matches the supply form's SUPPLY_GAS_LIMIT and is deliberately generous
// — every withdrawal this form builds (Aave withdraw, Compound withdraw,
// ERC-4626 withdraw/redeem, the PSM3 approve + swap pair) lands well under it.
// Being told to top up slightly early beats letting someone fill in an amount,
// tap Withdraw, and only then learn the wallet cannot pay.
//
// Budget only — it is NEVER the limit anything is signed with. Every leg is
// estimated for real by `checkTxFeeAffordable` immediately before it is signed.
export const WITHDRAW_GAS_LIMIT_FALLBACK = 600000

/**
 * "You need X more to cover the network fee", or null when the balance covers
 * `requiredWei`.
 *
 * Shared by both fee checks so the open-time warning and the pre-sign block are
 * the same sentence with the same arithmetic behind them — a drawer that opens
 * clean and then refuses at submit (or the reverse) reads as a broken form.
 *
 * ## Zero balance vs. unreadable balance
 *
 * These are opposite answers and must not be collapsed. A wallet holding no
 * native coin is the EXACT case this check exists for — it can never pay a fee,
 * so it must be told. A balance that could not be read means we cannot tell, and
 * blocking someone who could have paid is worse than letting the broadcast
 * report the real error.
 *
 * `getBalanceByChain` distinguishes them by TYPE, which is the only signal there
 * is: a successful read returns a decimal STRING (`0n.toString()` -> `'0'` for a
 * genuinely empty wallet), while its `catch` returns the NUMBER `0`. Treating
 * every zero as unreadable — the bug this replaced — let an empty wallet through
 * both the open-time warning and the pre-sign block, which is precisely the
 * wallet neither was allowed to miss.
 */
const feeShortfallMessage = async ({ chainId, from, requiredWei }) => {
  const rawBalance = await AllChainServices.getBalanceByChain(chainId, from, false)

  // The read failed → we cannot tell, so do not block. See the docblock: only
  // the NUMBER 0 means this, and it is the one shape a successful read never
  // produces.
  if (typeof rawBalance !== 'string') return null

  const balanceWei = BigNumber(rawBalance)
  // Unparseable is the same "cannot tell" as above.
  if (!balanceWei.isFinite() || balanceWei.lt(0)) return null
  if (balanceWei.gte(requiredWei)) return null

  // Shown to every decimal the wei difference actually has. Rounding DOWN would
  // name a top-up that still leaves the user short; rounding UP asks for more
  // than is owed. `toFixed()` with no argument also avoids the exponential
  // notation `toString()` produces for the very small numbers this usually is.
  const shortfall = BigNumber(
    convertWeiToBalance(requiredWei.minus(balanceWei).toFixed(0))
  ).toFixed()
  const symbol = getNativeTokenSymbolByChain(Number(chainId))

  // Symbol-less phrasing rather than a gap in the sentence when the chain isn't
  // in the catalog (custom network, catalog not loaded yet).
  return symbol
    ? I18n.t('chatAgent.walletActionNotEnoughFee', { amount: shortfall, symbol })
    : I18n.t('chatAgent.walletActionNotEnoughFeeNoSymbol', { amount: shortfall })
}

/**
 * Can this wallet pay for a withdrawal AT ALL? Asked once, as the drawer opens.
 *
 * The gap this closes: `checkTxFeeAffordable` is the authority, but it only runs
 * after the user has sized an amount and tapped Withdraw. A wallet holding a
 * lending position and no native coin therefore gets the whole form — balance,
 * Max button, refund preview — before being told the one thing that was true
 * from the start. This says it up front, in the same slot and the same words the
 * submit-time check uses.
 *
 * ## Why it estimates rather than always using the flat limit
 *
 * A real estimate is worth having when one can be had: 600k over-budgets an Aave
 * withdraw by roughly 4x, which on a busy L1 is the difference between "you need
 * 0.002 ETH more" and a warning shown to a wallet that could have paid. So it
 * simulates the withdrawal the user is most likely to make — the FULL position,
 * built exactly as `useWithdrawFlow` would build it — and only falls back to
 * WITHDRAW_GAS_LIMIT_FALLBACK when that cannot be measured.
 *
 * The fallback is not an edge case: the PSM3 exit's swap spends an allowance
 * that does not exist yet and reverts under simulation, an empty position has
 * nothing to encode, and any RPC hiccup lands here too. In all of those the
 * question is still worth answering, just against a ceiling.
 *
 * ## What it deliberately does NOT do
 *
 * It never blocks on a failed estimate. `checkTxFeeAffordable` reports one as
 * "this transaction cannot be completed" because by then it is a positive signal
 * that the exact call the user asked for would revert — but here the call is a
 * guess at an amount they have not chosen yet, so a revert says nothing about
 * the withdrawal they are about to size. Falling back to the flat limit is the
 * honest reading.
 *
 * @param {number|string} chainId
 * @param {string} from      The signer, whose native balance pays the fee.
 * @param {object} market    Resolved market, for building the probe tx.
 * @param {object} asset     Underlying: `{ address, decimals }`.
 * @param {string} balance   The position's withdrawable balance, human-readable.
 * @param {bigint} [shares]  Receipt-token balance, for a full vault exit.
 * @returns {Promise<string|null>} A message to show, or null when the wallet can pay.
 */
export const checkWithdrawFeeAffordable = async ({
  chainId,
  from,
  market,
  asset,
  balance,
  shares
}) => {
  const id = toChainId(chainId)
  if (!from || !market?.contract) return null

  // The gas price is read FIRST because it is the one value that can make the
  // whole question moot: with no price every fee is zero and nothing is
  // unaffordable, so there is no reason to spend an estimate round-trip.
  const gasPrice = await AllChainServices.getGasPrice(id)
  if (!gasPrice || BigNumber(gasPrice).lte(0)) return null

  // The probe: a full exit, which is both the most expensive withdrawal the user
  // can make and the one the Max button is one tap away from. Wrapped because
  // `buildWithdrawTx` THROWS on an unsupported type or a missing address —
  // conditions the drawer already handles by disabling itself, and which must
  // not take this check down with them.
  let probeTx = null
  try {
    if (BigNumber(balance || 0).gt(0)) {
      probeTx = buildWithdrawTx({
        market,
        asset,
        walletAddress: from,
        amount: balance,
        isWithdrawAll: true,
        shareBalance: shares ?? 0n
      })
    }
  } catch (e) {
    probeTx = null
  }

  let gasLimit = 0
  if (probeTx?.to) {
    // Buffered to the limit the leg would really be SIGNED with, so this warning
    // and the submit-time block budget the same number. A 0 here — revert or
    // unanswered RPC alike — is the fallback's cue.
    gasLimit = withGasBuffer(await estimateTxGas(id, from, probeTx))
  }

  // No usable estimate → the flat ceiling. See WITHDRAW_GAS_LIMIT_FALLBACK.
  if (gasLimit <= 0) gasLimit = WITHDRAW_GAS_LIMIT_FALLBACK

  return feeShortfallMessage({
    chainId: id,
    from,
    requiredWei: feeForGasLimit(gasPrice, gasLimit)
  })
}

/**
 * Everything the form needs to size and validate a withdrawal, in one call.
 *
 * Deliberately tolerant: any individual read may come back null (RPC down, a
 * vault that implements neither preview), and the form still works off whatever
 * did resolve. Only a completely unreadable balance is reported as such.
 */
export const loadWithdrawState = async ({ chainId, market, owner }) => {
  // The scale every amount below is read at. Resolved BEFORE any read, because
  // without it a raw balance cannot be turned into a figure worth showing —
  // reporting it against a guessed scale is how a 6-decimal USDC vault ends up
  // displaying 10^12 times the real position.
  const decimals = assetDecimalsOf(market?.asset)
  if (decimals === null) {
    return {
      shares: null,
      assets: null,
      balance: null,
      accountData: null,
      safeMax: null,
      hasDebt: false,
      assetUnresolved: true
    }
  }

  const [{ shares, assets }, accountData] = await Promise.all([
    readWithdrawable({ chainId, market, owner }),
    readAaveAccountData({ chainId, market, owner })
  ])

  const balance = assets === null ? null : fromUnits(assets, decimals)

  // The oracle price is only needed to size a DEBT-constrained ceiling, so the
  // three extra reads are skipped entirely for the common case of a position
  // with nothing borrowed against it.
  const assetPrice = accountData?.hasDebt
    ? await readAaveAssetPrice({ chainId, market })
    : null

  const safeMax = balance === null
    ? null
    : safeMaxWithdrawFor({ accountData, balance, assetPrice, decimals })

  return {
    /** Receipt-token balance in smallest units — what a full vault exit redeems. */
    shares,
    /** Withdrawable underlying in smallest units. */
    assets,
    /** Same, human-readable. Null when the balance could not be read at all. */
    balance,
    /** Aave collateral/debt snapshot, or null. */
    accountData,
    /**
     * Health-factor-capped ceiling, human-readable, or null when unconstrained
     * (no debt / not Aave) in which case `balance` is the ceiling.
     */
    safeMax: safeMax === null ? null : safeMax.toFixed(),
    /** True when the position is collateral for a loan — the form warns about it. */
    hasDebt: !!accountData?.hasDebt,
    /** Core could not identify the underlying — the form must not offer a size. */
    assetUnresolved: false
  }
}
