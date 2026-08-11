/**
 * Reading the receipt-token metadata the core puts in the supply payload.
 *
 * The core resolves the receipt token's real symbol and decimals when it builds
 * the payload (`market.receiptToken`), so the form never goes to chain just to
 * label or scale a figure it was handed. These helpers only pick the right
 * fallback when a field is missing — an older payload, or a read that failed
 * upstream.
 */

/** The receipt's decimals — 18 for a vault share like sUSDC, 6 for an aToken. */
export const receiptDecimals = (receipt, asset) =>
  receipt?.decimals ?? asset?.decimals ?? 6

/**
 * What to label the received figure with.
 *
 * Falls back to the supplied asset's symbol, which is right for the 1:1 markets
 * (an aToken tracks USDC) and merely imprecise for a vault — better than an
 * empty unit either way.
 */
export const receiptUnit = (receipt, asset) =>
  receipt?.symbol || asset?.symbol || 'USDC'
