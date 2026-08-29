import { useMemo } from 'react'
import { useQuery } from 'react-query'
import BigNumber from 'bignumber.js'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { lowerCase } from 'common/function'
import {
  checkWithdrawFeeAffordable,
  loadWithdrawState,
  previewWithdrawShares,
  readSharesForAssetUnits
} from './withdrawChecks'
import { isVaultType, toUnits } from './buildWithdrawTx'
import { isOraclePricedType } from './abis'

// The two on-chain reads the withdraw form depends on, as react-query hooks.
//
// Both were hand-rolled `useState` + `useEffect` pairs before, each carrying its
// own loading flag, its own cancellation guard against a stale response landing
// after a newer one, and its own refetch call. react-query owns all three, so
// the form is left holding only what it actually renders.
//
// The market is passed WHOLE but never keyed on as an object: a fresh
// `lendingInfo` object arrives on every parent render, so keying on it would
// refetch endlessly. The keys below are the primitive facts a read depends on —
// chain, vault, owner — and the market rides along through the closure.

/**
 * The market as core resolved it — the identity a withdrawal is encoded from,
 * pulled out of the `lendingInfo` the drawer was opened with.
 *
 * `lendingInfo` carries display numbers (APY) alongside these identity fields;
 * this narrows it to just the four a call needs, so everything downstream —
 * the state read, the share preview, the flow that builds the tx — takes one
 * stable object instead of reaching into `lendingInfo` itself.
 *
 * Returns null when the position cannot be identified at all, which is what
 * disables the form.
 */
export const useWithdrawMarket = (lendingInfo, token) => {
  return useMemo(() => {
    if (!lendingInfo?.contract || !lendingInfo?.type) return null
    return {
      type: lendingInfo.type,
      contract: lendingInfo.contract,
      // Falls back to the token the screen is showing: that IS the receipt token
      // the wallet holds, which is how this market was found in the first place.
      receiptToken: lendingInfo.receiptToken || token?.contractAddress,
      asset: lendingInfo.asset || null
    }
  }, [lendingInfo, token])
}

/**
 * The position: withdrawable balance, share count, and the Aave health-factor
 * ceiling when one applies.
 *
 * Takes no price argument. When the position carries debt, `loadWithdrawState`
 * reads the price from AAVE'S OWN oracle on chain — the same valuation the pool
 * uses for the collateral and debt it reports — so the ceiling is computed
 * entirely from one consistent source instead of being blended with the app's
 * price API. It travels with the rest of the position on every refetch.
 */
export const useWithdrawState = ({ chainId, market, owner, enabled = true }) => {
  const { data, isLoading, isFetching, refetch } = useQuery(
    [
      REACT_QUERY_KEY.getWithdrawState,
      chainId,
      lowerCase(market?.contract || ''),
      lowerCase(market?.receiptToken || ''),
      lowerCase(owner || '')
    ],
    () => loadWithdrawState({ chainId, market, owner }),
    {
      enabled: !!enabled && !!chainId && !!market?.contract && !!owner,
      // A position accrues every block, so a cached figure goes stale quickly.
      // Re-read on every mount rather than showing a number from last visit.
      staleTime: 0,
      cacheTime: 0,
      retry: 1
    }
  )

  return {
    state: data || null,
    // `isFetching` too, so an explicit refetch (after a settled withdrawal) shows
    // the spinner instead of leaving the previous balance looking authoritative.
    loading: isLoading || isFetching,
    refetch
  }
}

/**
 * How many vault shares withdrawing `amount` of the underlying would burn — the
 * "Refund amount" row.
 *
 * `amount` MUST already be debounced by the caller: it is part of the query key,
 * so an un-debounced value would fire one RPC read per keystroke. Only
 * SHARE-BASED markets have a preview at all; Aave/Compound receipts are 1:1 with
 * the underlying and never reach here.
 *
 * `shareBalance` caps the result for the oracle-priced family, matching the cap
 * the swap applies — without it the row can quote a hair more than the position
 * holds when the user asks for everything.
 */
export const useWithdrawPreviewShares = ({ chainId, market, amount, decimals, shareBalance, enabled = true }) => {
  // Both kinds are share-based; they differ only in WHERE the figure comes from.
  // A vault previews against itself; cross-chain sUSDS has no such function and
  // is converted through the SSR oracle instead — the same helper the swap uses
  // to size `amountIn`, so the row can never disagree with what gets signed.
  const isOraclePriced = isOraclePricedType(market?.type)
  const isShareBased = isVaultType(market?.type) || isOraclePriced
  const hasAmount = !!amount && Number(amount) > 0 && decimals !== null

  const isEnabled = !!enabled && isShareBased && hasAmount && !!market?.contract

  const { data, isFetching } = useQuery(
    [
      REACT_QUERY_KEY.getWithdrawPreviewShares,
      chainId,
      lowerCase(market?.contract || ''),
      amount,
      decimals
    ],
    () => (isOraclePriced
      ? readSharesForAssetUnits({
        chainId,
        // For this family `contract` is the SSR oracle, not a vault.
        oracle: market.contract,
        shareToken: market.receiptToken,
        assetUnits: toUnits(amount, decimals),
        assetDecimals: decimals,
        capShares: shareBalance
      })
      : previewWithdrawShares({
        chainId,
        market,
        assetUnits: toUnits(amount, decimals)
      })),
    {
      enabled: isEnabled,
      staleTime: 0,
      cacheTime: 0,
      retry: 0
    }
  )

  return {
    shares: data ?? null,
    // True while the read is in flight — the row shows a spinner rather than a
    // figure computed from an older amount, which would otherwise sit there
    // looking authoritative for the length of the debounce plus the round-trip.
    loading: isEnabled && isFetching
  }
}

/**
 * "Can this wallet pay the gas at all?", asked as the drawer opens.
 *
 * Runs once the POSITION has loaded rather than on mount, and that ordering is
 * the whole design: the check simulates a full exit to get a real estimate, and
 * a full exit cannot be encoded without the balance (and, for a vault, the share
 * count) that `useWithdrawState` reads. Firing before those land would fall
 * straight through to the flat 600k ceiling every time and quote a top-up
 * several times larger than the withdrawal actually costs.
 *
 * The result is a MESSAGE or null — the same sentence the submit-time check
 * produces — so the form renders it in the one error slot it already has.
 *
 * Not refetched on focus or interval. It answers a question about the wallet's
 * native balance, which does not change while the drawer sits open, and a
 * warning that blinks in and out under the user costs more than the freshness
 * buys. The authority is still `checkTxFeeAffordable` at submit, measured
 * against the amount actually typed.
 */
export const useWithdrawFeeCheck = ({ chainId, market, owner, asset, state, enabled = true }) => {
  const balance = state?.balance ?? null
  const shares = state?.shares ?? null

  // Only worth asking about a position that has something in it: a zero balance
  // already disables the form for a reason the user can act on, and stacking a
  // gas warning on top of it names a second problem they do not have yet.
  const isEnabled =
    !!enabled && !!chainId && !!market?.contract && !!owner && BigNumber(balance || 0).gt(0)

  const { data, isFetching } = useQuery(
    [
      REACT_QUERY_KEY.getWithdrawFeeCheck,
      chainId,
      lowerCase(market?.contract || ''),
      lowerCase(owner || ''),
      // The balance is part of the key so the estimate is re-taken after a
      // settled withdrawal moves the position — the same refetch that updates
      // the balance line updates the fee warning with it.
      String(balance ?? '')
    ],
    () => checkWithdrawFeeAffordable({
      chainId,
      from: owner,
      market,
      asset,
      balance,
      // react-query serializes nothing here, but the share count is a bigint and
      // only matters for a vault's full exit; passed through as-is.
      shares
    }),
    {
      enabled: isEnabled,
      // The native balance is what this reads, and it does not move on its own
      // while a drawer is open. Cached for the drawer's life so re-renders (every
      // keystroke in the amount field) never re-run an RPC round-trip.
      staleTime: Infinity,
      cacheTime: 0,
      retry: 0,
      refetchOnWindowFocus: false
    }
  )

  return {
    // The message to show, or null when the wallet can pay / we cannot tell.
    feeError: data || null,
    loading: isEnabled && isFetching
  }
}
