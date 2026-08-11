import React, { useMemo } from 'react'
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

    return function VaultReceivedRow ({ amount, isEditable }) {
      const preview = useSharePreview({ chainId, market, asset, amount, enabled: isEditable })

      // A card restored from chat history mounts settled with no preview cached,
      // and re-quoting would print TODAY's rate against a deposit made at an
      // older one. Show what was actually supplied instead — a fact that does
      // not go stale — rather than a share count implying a precision we no
      // longer have.
      if (preview == null && !isEditable && amount) {
        return <ReceivedValue value={fmt(amount, asset?.decimals ?? 6)} unit={asset?.symbol || 'USDC'} />
      }

      return <ReceivedValue value={preview == null ? null : fmt(preview, decimals)} unit={unit} />
    }
  }, [chainId, market, asset])
}
