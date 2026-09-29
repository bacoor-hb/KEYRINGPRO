import { useCallback, useEffect, useRef, useState } from 'react'
import { MoralisService, readSpendableBalance } from 'keyring-agent-core'

// One instance for the whole app, built lazily. The core's service is stateless
// — a base URL and a Pantograph client — so a second one per card would buy
// nothing but another object. Defaults match the agent's own config, which sets
// no `moralis` block (see Frontend/Services/keyringAgent.js): the balance the
// form re-reads therefore comes from the SAME endpoint the tool seeded it from.
let moralis = null
const getMoralis = () => {
  if (!moralis) moralis = new MoralisService()
  return moralis
}

/**
 * Re-read the swap form's SPENDABLE source balance, on demand.
 *
 * ON DEMAND is the whole design. The figure the card opens with was resolved by
 * the agent when it built the form, and it is re-read only when the user asks
 * for it — by tapping Refresh, which is already the moment the card re-prices.
 * Nothing polls, nothing fires on mount: re-entering the chat stays free, for
 * the same reason the quote itself is not re-taken on mount.
 *
 * The read itself lives in the CORE ({@link readSpendableBalance}) — the same
 * function `SwapTokenTool` seeds the form with. That matters most for a native
 * source, where spendable is the balance MINUS a gas reserve: a balance read
 * here instead would be the raw one, and its "Max" would leave nothing to pay
 * gas with. This hook only calls it and hands back the result.
 *
 * A failed or empty read is reported as `null` and CHANGES NOTHING. "Holds
 * nothing" and "we couldn't ask" are indistinguishable from here, and neither is
 * worth replacing a figure the user is looking at with a zero — so the caller
 * keeps whatever it already had.
 *
 * The read also carries the token's USD PRICE, which the core lifts off the same
 * wallet-balance row as the balance. That is what keeps the card's fiat line
 * honest across a Refresh: the amount and the price it is valued at are re-read
 * in one call, so they always describe the same moment. A price fetched
 * separately — on a timer, or on mount — would drift against the balance beside
 * it, and the form has no way to say which of the two is the stale one.
 *
 * @param {string} chain          Hex chain id the swap runs on.
 * @param {string} walletAddress  The holder.
 * @param {string} tokenAddress   `'native'` or the source token's contract.
 * @returns {{ refreshSpendable: () => Promise<object|null>, refreshing: boolean }}
 *   `refreshSpendable` resolves to `{ amount, rawAmount, symbol, decimals, logo, usdPrice }`
 *   for the caller to merge into the token it is showing, or `null` to leave it be.
 */
export default function useSpendableBalance ({ chain, walletAddress, tokenAddress }) {
  const [refreshing, setRefreshing] = useState(false)
  // Survives the unmount a chat list can do at any time — resolving `setState`
  // on a card the user has scrolled away from is a no-op warning, not an update.
  const mountedRef = useRef(true)
  // One read at a time. Double-tapping Refresh should not put two balance reads
  // in flight whose answers can land out of order.
  const inFlightRef = useRef(null)
  useEffect(() => () => { mountedRef.current = false }, [])

  const refreshSpendable = useCallback(async () => {
    if (!chain || !walletAddress || !tokenAddress) return null
    if (inFlightRef.current) return inFlightRef.current

    setRefreshing(true)
    const run = (async () => {
      try {
        const bal = await readSpendableBalance({
          moralis: getMoralis(),
          walletAddress,
          tokenAddress,
          chain,
          // A swap is a router call (+ possible approval), so the native reserve
          // is sized against that gas limit — not a plain transfer's.
          kind: 'swap'
        })
        // No `rawAmount` means the core couldn't convert — it only omits it when
        // decimals are unknown, and a balance the percentage pills can't divide
        // is not worth overwriting a working one with.
        if (!bal?.rawAmount) return null
        // Only the keys actually READ are returned: the caller merges this over
        // the token it is already showing, so an `undefined` symbol or logo here
        // would blank out a good one the agent resolved when it built the form.
        const patch = { amount: bal.balanceFormatted, rawAmount: bal.rawAmount, decimals: bal.decimals }
        if (bal.symbol) patch.symbol = bal.symbol
        if (bal.logo) patch.logo = bal.logo
        // Only when the index actually priced it. The core already drops a zero
        // or non-finite price, so anything here is displayable — but a token it
        // could not price this time must not blank out a price the form opened
        // with, for the same reason an unread symbol doesn't blank the symbol.
        if (bal.usdPrice) patch.usdPrice = bal.usdPrice
        return patch
      } catch (e) {
        // Best-effort by design: a refresh that fails leaves the card exactly as
        // it was, and the re-quote beside it still runs.
        return null
      } finally {
        inFlightRef.current = null
        if (mountedRef.current) setRefreshing(false)
      }
    })()

    inFlightRef.current = run
    return run
  }, [chain, walletAddress, tokenAddress])

  return { refreshSpendable, refreshing }
}
