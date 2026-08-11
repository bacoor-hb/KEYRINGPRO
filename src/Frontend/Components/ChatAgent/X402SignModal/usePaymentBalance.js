import BigNumber from 'bignumber.js'
import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import ViemWeb3 from 'src/Web3/ViemWeb3'

// Raw (smallest-unit) balance as a string, or null when it could not be read.
//
// Unlike useGetBalanceToken, a failure must NOT collapse to '0': "holds nothing"
// and "we couldn't ask" lead to opposite decisions here — the first should block
// the payment, the second must not. So the error path returns null and the hook
// reports 'unknown'.
const getData = async ({ queryKey }) => {
  const [, chainId, addressUser, addressToken] = queryKey
  // isConvertBalance = false → smallest units, the same scale as amountRaw, so
  // the comparison below needs no decimal maths.
  const raw = await ViemWeb3.getBalanceToken(chainId, addressUser, addressToken, false)
  // A failed multicall entry yields undefined rather than throwing.
  return raw == null ? null : String(raw)
}

/**
 * Reads the payer's balance of the token the x402 charge is denominated in, and
 * says whether it covers the price.
 *
 * Compared in the token's SMALLEST unit (`display.amountRaw` vs the raw
 * balance): the human-readable amount is already rounded for display, so
 * comparing those would call a wallet holding exactly the price "not enough" (or
 * the reverse) on a sub-cent rounding boundary.
 *
 * `reservedRaw` is an amount of this SAME token already committed to the
 * transaction being authorized — the case being a token send whose fee happens
 * to be charged in the token being sent. Both draw on one balance, so the fee
 * has to be judged against what is left AFTER the transfer, not the whole
 * holding: sending exactly 100 of 100 USDC leaves nothing for a USDC fee, yet
 * the raw balance alone says "plenty". Subtracted before the comparison and
 * reflected in the displayed `balance`, so the Spendable line states what the
 * fee can actually draw on.
 *
 * Best-effort by design. The facilitator is still the authority — it rejects an
 * underfunded payment with `invalid_exact_evm_insufficient_balance` — but only
 * AFTER the user has signed. Checking here turns that into an upfront, readable
 * "not enough" instead of an opaque post-signature failure. When the balance
 * can't be read (unknown chain, RPC down) `status` is 'unknown' and the approve
 * button is left enabled, so a transient RPC failure never blocks a payment the
 * user could actually afford.
 *
 * @param {object} display        The challenge's display info (asset, amountRaw, …)
 * @param {string} walletAddress  The payer
 * @param {string} [reservedRaw]  Smallest-unit amount of the same token already
 *                                spoken for by the transaction (see above)
 * @returns {{ status: 'loading'|'ok'|'insufficient'|'unknown', balance: string|null, reserved: boolean }}
 *          `balance` is human-readable and net of `reservedRaw`, for display;
 *          null when unread. `reserved` says whether a deduction was applied,
 *          so the sheet can explain a shortfall that the gross balance
 *          contradicts.
 */
export default function usePaymentBalance (display, walletAddress, reservedRaw) {
  // The core resolves the chain from the challenge — whichever protocol version
  // (and therefore whichever network format) the server spoke — so nothing here
  // parses `display.network` itself.
  const { assetAddress, amountRaw, decimals, chainId } = display || {}

  // Without a chain, a token, a payer, or a known scale there is nothing to
  // compare — `decimals: null` means the core could not read the token, so the
  // raw amount can't be turned into a comparable balance either.
  const enabled = !!chainId && !!assetAddress && !!walletAddress && amountRaw != null && decimals != null

  const { data, isLoading, isError } = useQuery(
    [REACT_QUERY_KEY.getRawBalanceToken, chainId, walletAddress, assetAddress],
    getData,
    {
      enabled,
      // A sheet the user is deciding on should show what the wallet holds NOW,
      // not a figure cached from an earlier payment in the same session.
      staleTime: 0,
      refetchOnMount: 'always',
      retry: 1
    }
  )

  if (!enabled) return { status: 'unknown', balance: null, reserved: false }
  if (isLoading) return { status: 'loading', balance: null, reserved: false }

  const grossBn = BigNumber(String(data ?? ''))
  const priceBn = BigNumber(String(amountRaw))
  if (isError || !grossBn.isFinite() || !priceBn.isFinite()) {
    return { status: 'unknown', balance: null, reserved: false }
  }

  // Take the committed amount off the top. Only a positive, readable figure
  // counts — a missing or malformed `reservedRaw` must leave the balance alone
  // rather than silently under-report what the user can spend.
  const reservedBn = BigNumber(String(reservedRaw ?? ''))
  const hasReserved = reservedBn.isFinite() && reservedBn.gt(0)
  // Clamped at zero: sending MORE than the wallet holds makes this negative, and
  // a negative spendable would render as nonsense on the Spendable line. It's
  // still short of the price either way, so the verdict doesn't change — and
  // that overspend is the send's own pre-check to report, not this sheet's.
  const balanceBn = hasReserved
    ? BigNumber.max(grossBn.minus(reservedBn), 0)
    : grossBn

  return {
    status: balanceBn.gte(priceBn) ? 'ok' : 'insufficient',
    balance: balanceBn.shiftedBy(-decimals).toFixed(),
    reserved: hasReserved
  }
}
