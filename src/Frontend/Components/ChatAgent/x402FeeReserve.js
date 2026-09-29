import BigNumber from 'bignumber.js'

/**
 * How much of a token an x402 fee will take out of the very balance the user is
 * about to spend — and therefore how much they can actually still size an amount
 * against.
 *
 * ── Why this exists ────────────────────────────────────────────────────────────
 * The fee and the transaction are two separate transfers, but when they are
 * denominated in the SAME token on the SAME chain they draw on ONE balance.
 * Sizing an amount against the full balance then produces a figure that cannot
 * execute: tapping Max on 10 USDC sends all 10, and the 0.05 USDC fee that has
 * to settle alongside it has nothing left to come from.
 *
 * That was previously only caught in the approval sheet (see `matchedSpendRaw` in
 * X402SignModal), which is AFTER the user has typed, tapped Max and committed —
 * it could report the shortfall but not prevent it. Deducting here, while the
 * amount is still being sized, is what makes Max mean "the most I can actually
 * send". The sheet's own check stays as the authoritative second pass, against
 * the real challenge rather than the published price.
 *
 * ── When nothing is deducted ───────────────────────────────────────────────────
 * Only an exact chain + contract match reserves anything. A different token, a
 * different chain, an unpriced route, or a spec that did not publish `x-asset`
 * all reserve ZERO — the two spends come from separate balances, or we do not
 * know enough to say they don't. Deducting on a guess would shrink a Max on a
 * token the fee never touches, which is the more damaging error: it silently
 * strands funds the user can plainly see.
 */

// The native coin has no contract address. Different corners of the chat flow
// spell that differently — the swap card uses the literal 'native', the transfer
// forms leave the contract field empty, and the usual zero/0xEeee sentinels turn
// up in agent-supplied data — so all of them are recognised here rather than in
// each caller. An x402 charge is settled in an ERC-20, so a native amount can
// never collide with it either way.
const NATIVE_SENTINELS = [
  '',
  'native',
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
]

const isNative = (address) =>
  NATIVE_SENTINELS.includes(String(address || '').toLowerCase())

// The contract of the token being spent, under either name it travels by.
//
// The wallet-action forms describe their outgoing transfer with a `spend`
// callback whose shape is fixed by the x402 approval sheet (`matchedSpendRaw`
// reads `assetAddress`), while the supply and swap cards hand this module a
// plain `{ chainId, address }` of their own. Reading BOTH keys is what lets one
// reserve helper serve every caller without forcing a shape change on the sheet
// — and getting this wrong is silent: an unread key looks exactly like a native
// spend, so the fee is quietly not reserved and Max goes back to overspending.
const contractOf = (token) => token?.address ?? token?.assetAddress

/**
 * Does this fee land on the token being spent?
 *
 * Chain ids are compared NUMERICALLY: the chat agent hands out hex ("0xa") while
 * the spec's CAIP-2 id parses to a decimal, and a string compare would call
 * those different and skip a deduction that is genuinely needed. Both sides must
 * parse to a real number first — `Number(null)` is 0, which would otherwise make
 * two unknown chains compare equal.
 *
 * @param {object|null} feeAsset  `fee.asset` — `{ chainId, address, decimals, amountRaw }`
 * @param {object|null} token     The token being spent: `{ chainId }` plus either
 *                                `address` or `assetAddress`
 */
export const isSameToken = (feeAsset, token) => {
  if (!feeAsset || !token) return false
  if (feeAsset.chainId == null || token.chainId == null) return false

  const feeChain = Number(feeAsset.chainId)
  const spendChain = Number(token.chainId)
  if (!Number.isFinite(feeChain) || !Number.isFinite(spendChain)) return false
  if (feeChain !== spendChain) return false

  // A native spend has no contract to match against an ERC-20 fee.
  const contract = contractOf(token)
  if (isNative(contract)) return false

  return String(contract).toLowerCase() === String(feeAsset.address).toLowerCase()
}

/**
 * The fee to set aside, as a HUMAN decimal string in the spent token's own unit
 * — or '0' when the fee draws on a different balance.
 *
 * Derived from `amountRaw` (smallest units, exactly as the server published it)
 * rather than from the USD price, so no rounding is introduced between what the
 * spec quotes and what is deducted.
 *
 * @param {object|null} fee    The price-list entry from `useX402FeeFor`
 * @param {object|null} token  The token being spent: `{ chainId }` plus either
 *                             `address` or `assetAddress` (see contractOf)
 * @returns {string} A non-negative decimal string; '0' when nothing is reserved.
 */
export const getFeeReserve = (fee, token) => {
  const asset = fee?.asset
  if (!isSameToken(asset, token)) return '0'

  const raw = BigNumber(String(asset.amountRaw))
  if (!raw.isFinite() || raw.lte(0)) return '0'

  return raw.shiftedBy(-Number(asset.decimals)).toFixed()
}

/**
 * The spendable balance with the x402 fee already taken off — the figure Max and
 * the percentage chips must divide, and the ceiling the amount is validated
 * against.
 *
 * Clamped at zero: a balance smaller than the fee cannot fund any amount at all,
 * and a negative ceiling would render as nonsense and make every amount "over
 * balance" with a confusing number attached. Zero says the same thing cleanly —
 * nothing can be sent — and the submit button stays disabled because no positive
 * amount fits under it.
 *
 * Returns the spendable UNCHANGED (not '0') when it is absent or unreadable:
 * "no balance was fetched" is a state the forms already handle by hiding the
 * chips and the spendable line entirely, and turning it into a number here would
 * make them render a ceiling nobody actually read.
 *
 * @param {string|number|null} spendable  The balance before the fee
 * @param {object|null} fee               The price-list entry from `useX402FeeFor`
 * @param {object|null} token             The token being spent: `{ chainId }` plus
 *                                        either `address` or `assetAddress`
 * @returns {{ spendable: string|null, reserve: string, reserved: boolean }}
 *   `spendable` net of the fee; `reserve` the amount taken off ('0' when none);
 *   `reserved` whether a deduction actually applied, so the UI can explain a
 *   figure that is lower than the wallet's own balance.
 */
export const applyFeeReserve = (spendable, fee, token) => {
  const reserve = getFeeReserve(fee, token)
  const reserveBn = BigNumber(reserve)
  const hasReserve = reserveBn.isFinite() && reserveBn.gt(0)

  const gross = BigNumber(String(spendable ?? ''))
  // Nothing readable to deduct FROM — hand back what we were given so the caller
  // keeps its existing "no balance" rendering rather than inventing a ceiling.
  if (spendable == null || !gross.isFinite()) {
    return { spendable: spendable ?? null, reserve, reserved: false }
  }

  if (!hasReserve) return { spendable: gross.toFixed(), reserve: '0', reserved: false }

  return {
    spendable: BigNumber.max(gross.minus(reserveBn), 0).toFixed(),
    reserve,
    reserved: true
  }
}
