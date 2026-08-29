import React, { useEffect, useMemo } from 'react'
import ReceivedValue from './ReceivedValue'
import useSharePreview from './useSharePreview'
import { fmt } from './SupplyFormShell'
import { receiptDecimals, receiptUnit } from './receiptToken'

/**
 * Builds the "Est. Received" row for an ERC-4626 vault market.
 *
 * A vault mints SHARES at its current rate rather than 1:1, so the figure is a
 * live `convertToShares` preview rather than the amount typed, denominated in
 * the vault's own share token (Spark's `sUSDC` is 18 decimals against USDC's 6).
 *
 * Returned as a component so the preview hook runs against the amount the user
 * is typing, which is state the shell owns.
 *
 * The preview is the only on-chain read left in the card, and it fires only when
 * there is an amount — a card that is merely opened, scrolled past and returned
 * to costs nothing.
 */
export default function useVaultReceivedRow ({ chainId, market, asset }) {
  return useMemo(() => {
    const unit = receiptUnit(market?.receiptToken, asset)
    // Shares carry the receipt's own precision (18), so the displayed figure is
    // truncated at that rather than the asset's 6 — otherwise a small deposit
    // would round away to "0".
    const decimals = receiptDecimals(market?.receiptToken, asset)

    return function VaultReceivedRow ({ amount, isEditable, estimate, onEstimate }) {
      const preview = useSharePreview({ chainId, market, asset, amount, enabled: isEditable })
      const shown = preview == null ? null : fmt(preview, decimals)

      // Hand each resolved quote up to the shell, which persists it with the
      // message. The row cannot keep it itself: the chat list unmounts offscreen
      // cards, so anything held in local state here dies on scroll.
      //
      // Reported only while the card can still be edited. Once it is settled the
      // preview is disabled and `shown` is null, and pushing that up would erase
      // the very figure being preserved.
      useEffect(() => {
        if (!isEditable || shown == null) return
        // Compared before storing: the quote re-resolves to the same string on
        // every debounce tick the rate has not moved, and a fresh object each
        // time would re-render and re-persist the card for no change.
        onEstimate?.((prev) =>
          prev?.amount === shown && prev?.symbol === unit ? prev : { amount: shown, symbol: unit }
        )
      }, [isEditable, shown, onEstimate])

      // A settled card shows the LAST estimate it quoted, restored from the
      // message. It stays an estimate — the label above it still reads "Est." —
      // and the figure actually minted is reported separately by the timeline,
      // parsed from the deposit's receipt.
      //
      // Deliberately not re-quoted: `convertToShares` today would print today's
      // rate against a deposit made at an older one.
      if (!isEditable && estimate?.amount) {
        return <ReceivedValue value={estimate.amount} unit={estimate.symbol || unit} />
      }

      // Settled with no estimate to restore — a card from before estimates were
      // persisted, or one submitted before a quote ever resolved. Show what was
      // actually supplied rather than a share count whose rate we no longer have.
      if (preview == null && !isEditable && amount) {
        return <ReceivedValue value={fmt(amount, asset?.decimals ?? 6)} unit={asset?.symbol || 'USDC'} />
      }

      return <ReceivedValue value={shown} unit={unit} />
    }
  }, [chainId, market, asset])
}
