import { useCallback, useRef } from 'react'
import { MoralisService, readTokenUsdPrice } from 'keyring-agent-core'

// One instance for the whole app, built lazily — the same lazy singleton
// `useSpendableBalance` keeps, and for the same reason: the core's service holds
// no per-card state, so a second one per swap card would buy nothing.
let moralis = null
const getMoralis = () => {
  if (!moralis) moralis = new MoralisService()
  return moralis
}

/**
 * Re-read the RECEIVE side's USD price, on demand.
 *
 * The sell side needs no such hook: its price rides along with the balance
 * re-read (the wallet-balance row carries one), so `useSpendableBalance` already
 * returns it and Refresh updates it for free. The destination token is not held,
 * has no balance row, and so has to be asked for separately — which is exactly
 * why this is its own hook rather than a branch inside that one.
 *
 * ON DEMAND, like everything else on this card. The price the form opens with
 * came from the agent when it built the message; nothing here fires on mount or
 * on a timer, so re-entering a chat and scrolling past old swap cards costs no
 * network. `onRequote` is the only caller — the moment the user asks for current
 * numbers, and the moment the balance and the quote are made current too.
 *
 * The read lives in the CORE ({@link readTokenUsdPrice}) — the same function the
 * swap tool used to seed this form. That keeps one rule about what a usable
 * price is (native maps to the zero address; zero and non-finite are dropped as
 * "unknown", never shown as worthless) instead of one here and one there.
 *
 * A failed read resolves to `null` and CHANGES NOTHING, so the caller keeps the
 * price it already had. A price is a caption: losing it must never cost the user
 * their quote.
 *
 * @param {string} chain         Hex chain id the swap runs on.
 * @param {string} tokenAddress  `'native'` or the destination token's contract.
 * @returns {{ refreshToPrice: () => Promise<number|null> }}
 */
export default function useToTokenPrice ({ chain, tokenAddress }) {
  // One read at a time, so double-tapping Refresh cannot land two answers out
  // of order — the same guard the balance read keeps. No mounted-ref here,
  // unlike that hook: this one sets no state of its own, it just resolves a
  // value for the caller to merge, so an unmount has nothing to guard against.
  const inFlightRef = useRef(null)

  const refreshToPrice = useCallback(async () => {
    if (!chain || !tokenAddress) return null
    if (inFlightRef.current) return inFlightRef.current

    const run = (async () => {
      try {
        return await readTokenUsdPrice({ moralis: getMoralis(), tokenAddress, chain })
      } catch (e) {
        return null
      } finally {
        inFlightRef.current = null
      }
    })()

    inFlightRef.current = run
    return run
  }, [chain, tokenAddress])

  return { refreshToPrice }
}
