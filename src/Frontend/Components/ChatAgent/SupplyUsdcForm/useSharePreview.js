import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { previewShares } from './supplyChecks'
import { receiptDecimals } from './receiptToken'

/**
 * Live share preview for an ERC-4626 vault: how many shares the typed amount
 * would mint right now.
 *
 * This is the ONE figure on a supply card that cannot be resolved when the
 * payload is built, because it is a function of the amount the user types —
 * `convertToShares(assets)` at the vault's current rate. Everything else the
 * card displays arrives in the payload, so this is the only read left.
 *
 * Debounced to one read per pause rather than one per keystroke.
 *
 * ## Why `enabled` matters
 *
 * The chat list unmounts offscreen cards and remounts them on scroll-back, and a
 * restored card seeds the amount field from what was persisted — so a preview
 * keyed only on "is there an amount" would re-read on every scroll past every
 * supply card the user ever made. It is also pointless once a card is settled:
 * the deposit already happened at whatever rate it happened at, and a fresh
 * quote would just overwrite the record with today's.
 *
 * So the caller passes `enabled` (the card is still actionable). Combined with
 * the empty-amount guard, a card that is merely opened, scrolled past, or
 * finished costs zero RPC.
 *
 * Shares are scaled by the RECEIPT token's decimals (18 for Spark's `sUSDC`),
 * not the deposited asset's 6 — using the asset's would overstate the figure by
 * 10^12.
 *
 * @returns Formatted share amount, or null while empty / unread.
 */
export default function useSharePreview ({ chainId, market, asset, amount, enabled = true }) {
  const [shares, setShares] = useState(null)

  useEffect(() => {
    // An emptied field has nothing to preview, so drop the stale figure. Being
    // disabled is different: a card that just went through submission keeps the
    // number it last showed rather than blanking to "0" as it settles.
    if (!amount) {
      setShares(null)
      return
    }
    if (!enabled) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const preview = await previewShares({ chainId, market, asset, amount })
      if (!cancelled) setShares(preview)
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, amount, chainId, market, asset])

  if (shares === null) return null
  return formatUnits(shares, receiptDecimals(market?.receiptToken, asset))
}
