import { useCallback, useEffect, useRef, useState } from 'react'
import {
  swapProviderFactory,
  humanToWei,
  weiToHuman,
  encodeFunctionData,
  erc20Abi,
  extractOutRaw,
  extractQuoteError,
  DEFAULT_PROVIDER
} from 'keyring-agent-core'
import { zeroAddress } from 'viem'
import { toChainId } from '../SwapShared/swapChecks'

// How long the amount sits still before it is quoted.
//
// A quote is a network round-trip to the router, so quoting every keystroke would
// fire one request per digit and race them against each other. 500ms is long
// enough that typing "0.125" is ONE quote rather than five, and short enough
// that the estimate feels attached to the number the user just entered.
const DEBOUNCE_MS = 500

// How long a quote stays executable.
//
// A quote is a price the router promised at a moment in time; past ~45s it has
// drifted enough that broadcasting it risks a revert or a materially worse fill.
// The same 45s the agent's own confirm cards expire on (`ConfirmAddLiquidityTx`),
// so "how long a price lasts" reads the same everywhere in the chat.
//
// Nothing is discarded when it lapses — the estimate stays on screen; only the
// button changes, from executing the old price to fetching a new one.
export const QUOTE_TTL_MS = 45 * 1000

/**
 * Live swap quoting for the in-chat amount form.
 *
 * This is the whole reason the form can exist: `keyring-agent-core` is imported
 * IN-PROCESS by the app, so the same `swapProviderFactory` the agent's tools use
 * is reachable straight from the FE. Sizing an amount therefore costs a router
 * call, not an agent turn — which is what makes changing your mind free.
 *
 * The quote is built with `route: 'userSwap'` and `isCrossChain: false` to match
 * `SwapTokenTool`/`BuyTokenTool` exactly. Quoting on a different route would read
 * a different affiliate config and hand back a trade the tools never promised.
 *
 * Returns the estimate plus everything needed to EXECUTE it — `swapTx` and, when
 * an allowance is required, `approveTxs` — so confirming runs the existing
 * `useSwapFlow` with no further backend involvement.
 *
 * @param {object}  fromToken   Source side: `{ address, symbol, decimals }`.
 * @param {object}  toToken     Destination side, same shape.
 * @param {string}  amount      Human amount the user has typed/picked. '' → idle.
 * @param {string}  chainHexId  Chain the swap executes on.
 * @param {string}  walletAddress Sender and recipient.
 * @param {object}  [restoredQuote] The whole quote persisted on an earlier visit,
 *   for the amount restored alongside it — calldata and `quotedAt` included.
 *   Adopted on mount so leaving the chat and coming back costs no router call.
 *
 *   Its `quotedAt` decides what it is worth. Still inside `QUOTE_TTL_MS` and it
 *   is adopted WHOLE: the card comes back executable on the very price the user
 *   left, and goes stale later on the ordinary timer. Past the TTL only
 *   `estimatedOut` survives as a display seed — the panel is never blank, but
 *   with no `swapTx` the card asks to be re-priced rather than broadcasting
 *   calldata built against a price that has since moved.
 * @param {boolean} [enabled=true] Whether to quote at all. False for a swap that
 *   already COMPLETED — the card is then a record of what happened, and a fresh
 *   quote would overwrite the amounts it reports. A failed swap keeps quoting,
 *   since its Retry needs new calldata to run.
 * @param {boolean} [amountRejected=false] The amount on screen failed the card's
 *   own validation (over the spendable balance, say). Also stops quoting, but —
 *   unlike `enabled` — CLEARS the estimate rather than freezing it: an amount the
 *   card refuses must not sit above a payout figure quoted for a different one.
 */
export default function useSwapQuote ({
  fromToken,
  toToken,
  amount,
  chainHexId,
  walletAddress,
  restoredQuote,
  enabled = true,
  amountRejected = false
}) {
  // Is the persisted quote still executable?
  //
  // Captured ONCE, at mount, from the stamp the quote itself carries — not
  // recomputed as the card sits there. A quote restored with 3s left is armed
  // now and goes stale on the ordinary TTL timer below, exactly as a quote taken
  // this session does; re-deriving this per render would instead flip the card
  // between armed and not while the user is looking at it.
  const [restoredLive] = useState(
    () => !!restoredQuote?.swapTx && !!restoredQuote?.quotedAt &&
      Date.now() - restoredQuote.quotedAt < QUOTE_TTL_MS
  )

  // The restored quote IS the quote when it is still live — calldata included —
  // so a card the user left and came back to can execute the very price they
  // last saw. Past the TTL only the estimate survives: the figure is redrawn so
  // the receive panel is never blank, but with no `swapTx` the card cannot act
  // on a price that has since moved, and asks to be re-quoted instead.
  const [quote, setQuote] = useState(() => {
    if (!restoredQuote) return null
    return restoredLive ? restoredQuote : { estimatedOut: restoredQuote.estimatedOut }
  })

  // The display-only seed, and the amount it stands in for.
  //
  // Only ever set for an EXPIRED restore — a live one is a real quote and needs
  // none of this. Two jobs. It is the fallback when a re-quote FAILS, so a router
  // hiccup surfaces as the error line alone rather than as a receive panel that
  // blanks out. And it SUPPRESSES the quote effect, so re-entering the chat
  // redraws a number already on record instead of spending a router call to
  // arrive at one the user must confirm anyway.
  //
  // The suppression lasts until the user touches the amount. Editing makes the
  // seed stale, and every amount from then on is quoted for real.
  const seedRef = useRef(
    !restoredLive && restoredQuote?.estimatedOut && amount
      ? { amount, estimatedOut: restoredQuote.estimatedOut }
      : null
  )
  // The amount a `retry` is currently fetching THROUGH its own display seed.
  // Without it the seed `retry` plants would suppress the very fetch it wants.
  const retryAmountRef = useRef(null)

  const clearQuote = useCallback((currentAmount) => {
    const seed = seedRef.current
    setQuote(seed && seed.amount === currentAmount ? { estimatedOut: seed.estimatedOut } : null)
  }, [])

  // The seed dies with the amount it belonged to. Once the user types a different
  // figure the persisted estimate prices a trade they are no longer asking for,
  // and must never be shown again — not even as the fallback for a later failure
  // that happens to land back on the old amount.
  useEffect(() => {
    if (seedRef.current && seedRef.current.amount !== amount) seedRef.current = null
    // The retry marker belongs to the same amount and dies with it. Left behind,
    // it would wave a LATER quote for that amount straight past the suppression
    // branch — harmless today, but only by accident.
    if (retryAmountRef.current !== null && retryAmountRef.current !== amount) retryAmountRef.current = null
  }, [amount])

  // A live restore is suppressed the same way, and for the same reason: the
  // quote is already on screen and executable, so quoting again on mount would
  // spend a router call to replace a price with an equivalent one. Cleared as
  // soon as the amount changes, after which every amount is quoted for real.
  const restoredAmountRef = useRef(restoredLive ? amount : null)
  useEffect(() => {
    if (restoredAmountRef.current != null && restoredAmountRef.current !== amount) {
      restoredAmountRef.current = null
    }
  }, [amount])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  // Bumped by `retry` purely to re-run the quote effect. The run counter alone
  // cannot: it is a ref, so changing it schedules no render.
  const [retryTick, setRetryTick] = useState(0)

  // True once the quote on screen has outlived `QUOTE_TTL_MS`.
  //
  // Driven by a timer rather than by reading the clock at render: a card sitting
  // untouched renders nothing on its own, so a purely computed age would stay
  // reported as fresh until some unrelated state change happened to repaint it.
  // The timer is what makes the button flip to Refresh while the user is just
  // looking at the card.
  const [isStale, setIsStale] = useState(false)

  // Age is measured from `quotedAt`, which a restored quote carries with it — so
  // a price restored with 10s of life left goes stale in 10s, not in a fresh 45.
  const quotedAt = quote?.quotedAt
  useEffect(() => {
    // No live quote to age: an expired restore is display only and already
    // handled as `isRestored`, so it must not also report itself stale.
    if (!quotedAt) {
      setIsStale(false)
      return
    }
    const remaining = quotedAt + QUOTE_TTL_MS - Date.now()
    if (remaining <= 0) {
      setIsStale(true)
      return
    }
    setIsStale(false)
    const timer = setTimeout(() => setIsStale(true), remaining)
    return () => clearTimeout(timer)
  }, [quotedAt])

  // Every quote run is stamped, and only the LATEST stamp may write state. Two
  // requests can be in flight when the user keeps typing through a slow router
  // call, and they can settle out of order — without this, a stale response
  // would overwrite the estimate for the amount currently on screen.
  const runRef = useRef(0)
  // Cleared on unmount so a settling request can't setState on a gone component.
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  // The latest quote and amount, readable from `retry` without making it depend
  // on either — `retry` is handed to the card as a stable callback, and taking
  // them as dependencies would rebuild it on every keystroke and every quote.
  const quoteRef = useRef(quote)
  quoteRef.current = quote
  const amountRef = useRef(amount)
  amountRef.current = amount

  const fromAddress = fromToken?.address
  const toAddress = toToken?.address
  const fromDecimals = fromToken?.decimals

  useEffect(() => {
    const run = ++runRef.current
    const isCurrent = () => mountedRef.current && runRef.current === run

    // Nothing to quote for: the swap is running or settled, so the figures on
    // screen describe a trade already committed to. They are LEFT standing —
    // clearing them here would blank the amounts the card is reporting.
    if (!enabled) {
      setLoading(false)
      return
    }

    // Nothing worth quoting: the amount on screen is one the card has already
    // rejected. Unlike the branch above, the estimate must NOT survive — it was
    // quoted for a different, valid amount, and leaving it under an invalid one
    // states a payout the user would not receive. Cleared to `null` rather than
    // to the seed, since an amount the card refuses has no figure to fall back
    // on.
    if (amountRejected) {
      setQuote(null)
      setError(null)
      setLoading(false)
      return
    }

    // A live restored quote is already on screen, calldata and all, for exactly
    // this amount. Nothing to fetch: quoting would spend a router call to replace
    // a price the user can act on right now with an equivalent one. It ages out
    // on the ordinary TTL timer, at which point the card offers a Refresh.
    if (restoredAmountRef.current === amount) {
      setLoading(false)
      setError(null)
      return
    }

    // Still showing an EXPIRED restore, whose estimate the seed just painted.
    // Also nothing to fetch — but for the opposite reason: this one is display
    // only, so the card cannot execute on it and presents a Refresh instead.
    // Broadcasting calldata quoted in a previous session is exactly the
    // staleness this form was built to avoid, and quoting automatically here is
    // what made every re-entry cost a router call.
    //
    // Unless the user just ASKED for this quote. `retry` plants a seed of its
    // own to keep the previous estimate on screen through the round-trip, and
    // that seed must not then suppress the fetch it exists to cover.
    if (retryAmountRef.current === amount) {
      retryAmountRef.current = null
    } else if (seedRef.current && seedRef.current.amount === amount) {
      setLoading(false)
      setError(null)
      return
    }

    // No amount yet — idle, not an error. Clearing the estimate here is what
    // stops a stale figure hanging under an emptied input.
    if (!amount || !fromAddress || !toAddress || !chainHexId || !walletAddress) {
      setQuote(null)
      setError(null)
      setLoading(false)
      return
    }

    const decimals = fromDecimals ?? 18
    const rawAmount = humanToWei(String(amount), decimals)
    // Not a positive amount the token can represent (a lone "0", or a value that
    // truncates to nothing at this token's precision). Nothing to quote.
    if (!rawAmount) {
      setQuote(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const timer = setTimeout(async () => {
      if (!isCurrent()) return
      try {
        const numericChainId = toChainId(chainHexId)
        // Providers want a concrete address for the native side; both accept zero.
        const srcTokenAddress = fromAddress === 'native' ? zeroAddress : fromAddress
        const dstTokenAddress = toAddress === 'native' ? zeroAddress : toAddress

        const service = await swapProviderFactory.getService({
          route: 'userSwap',
          srcChainId: numericChainId
        })
        const res = await service.getQuote({
          srcChainId: numericChainId,
          srcTokenAddress,
          srcTokenAmount: rawAmount.toString(),
          dstChainId: numericChainId,
          dstTokenAddress,
          recipientAddress: walletAddress,
          senderAddress: walletAddress,
          slippage: 'auto',
          isCrossChain: false
        })
        if (!isCurrent()) return

        if (!res?.success || !res?.tx?.to || typeof res.tx.data !== 'string') {
          clearQuote(amount)
          setError(extractQuoteError(res))
          setLoading(false)
          return
        }

        const estimatedOutRaw = extractOutRaw(res)
        const estimatedOut = estimatedOutRaw != null && toToken?.decimals != null
          ? weiToHuman(BigInt(estimatedOutRaw), toToken.decimals)
          : undefined

        const swapTx = {
          chainId: chainHexId,
          to: res.tx.to,
          data: res.tx.data,
          value: res.tx.value ?? '0',
          from: walletAddress
        }

        // Allowance is checked against the SAME provider that produced the quote —
        // re-routing between quote and approval would approve the wrong spender.
        const approveTxs = fromAddress === 'native'
          ? []
          : await buildApproveTxs({
            chainHexId,
            walletAddress,
            fromAddress,
            decimals,
            rawAmount: rawAmount.toString(),
            quote: res
          })
        if (!isCurrent()) return

        // The fresh quote replaces whatever was on screen, so any display seed
        // standing in for it — a `retry` carrying the old estimate through the
        // round-trip, or an expired restore — has done its job and must go.
        // Leaving it would keep `isRestored` true beside an executable quote,
        // i.e. a button still offering to Refresh a price it could now swap on.
        seedRef.current = null

        setQuote({
          // The source amount in smallest units. Returned rather than recomputed
          // by the caller because the approve leg and the allowance re-check at
          // submit time must use the exact figure this quote was built against.
          fromRawAmount: rawAmount.toString(),
          estimatedOut,
          estimatedOutRaw,
          provider: res.provider,
          swapTx,
          approveTxs,
          // Relay's own id for this quote's swap step. Carried through so the
          // settled swap can be registered with Relay's indexer — without it
          // Relay's explorer page for the hash loads empty. deBridge has no
          // equivalent at quote time; its order id only exists post-receipt
          // (`resolveDeBridgeRequestId`).
          requestId: res.raw?.requestId ?? null,
          // When this quote was built. The confirm card expires a quote by AGE,
          // and a live-quoted one is only as old as its last run — not as old as
          // the agent's message, which may be many edits ago.
          quotedAt: Date.now()
        })
        setLoading(false)
      } catch (e) {
        if (!isCurrent()) return
        clearQuote(amount)
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [amount, fromAddress, toAddress, fromDecimals, toToken?.decimals, chainHexId, walletAddress, enabled, amountRejected, retryTick, clearQuote])

  // Re-price on demand. Drops the seed first: while it stands the effect
  // short-circuits, so bumping the run counter alone would re-enter the
  // suppression branch and fetch nothing. This is what the card calls when the
  // user asks to act on a restored estimate.
  //
  // The estimate on screen SURVIVES the round-trip, as a display-only value.
  // Discarding it here — the obvious reading of "re-quote" — emptied the receive
  // panel for the debounce plus a router call, so tapping Refresh read as the
  // number resetting to nothing and then coming back. The old figure is the best
  // available answer to "what will I receive" until a better one lands, and it
  // is within a slippage of it: prices move by fractions between quotes, not to
  // zero.
  //
  // What it must NOT survive as is something executable. Only `estimatedOut` is
  // carried over — no `swapTx`, so the button cannot broadcast the old price —
  // and it is carried in the SEED, which is already the mechanism for "a figure
  // shown but not actable" and is already cleared the moment the user edits the
  // amount. `isRestored` then keeps the button on Refresh until the fresh quote
  // arms it, exactly as it does for a quote restored from storage.
  const retry = useCallback(() => {
    const shown = quoteRef.current?.estimatedOut
    // The seed both DISPLAYS the old figure and suppresses the quote effect, so
    // it can't simply be left standing — the effect would short-circuit on it
    // and never fetch. `retryAmountRef` marks this amount as one to quote
    // THROUGH the seed: the effect skips the suppression branch once, and the
    // figure stays on screen while the request runs.
    seedRef.current = shown && amountRef.current ? { amount: amountRef.current, estimatedOut: shown } : null
    retryAmountRef.current = seedRef.current ? amountRef.current : null
    // Both suppressions drop here — the display seed and the live restore — so
    // the effect stops short-circuiting and actually fetches.
    restoredAmountRef.current = null
    setQuote(shown ? { estimatedOut: shown } : null)
    setIsStale(false)
    runRef.current++
    setRetryTick((n) => n + 1)
  }, [])

  // True while the estimate on screen came from storage rather than from a quote
  // taken this session. The card uses it to offer a re-price instead of a
  // disabled button — the same treatment `isStale` gets once a live quote ages
  // past `QUOTE_TTL_MS`.
  const isRestored = !!seedRef.current && seedRef.current.amount === amount

  return { quote, loading, error, retry, isRestored, isStale }
}

/**
 * The approve transactions this swap needs, in the order they must be sent —
 * empty when the router is already allowed.
 *
 * Usually ONE. Two when the pay token refuses to overwrite a non-zero allowance:
 * USDT on Ethereum is the canonical one, whose `approve` carries
 * `require(!((_value != 0) && (allowed[owner][spender] != 0)))`, so a standing
 * allowance has to be zeroed before a new one can be granted — `approve(spender, 0)`
 * and then `approve(spender, amount)`, both of which must be sent.
 *
 * Both providers reach here through the CORE's `swapProviderFactory` (the same
 * one the agent's tools use, imported in-process — see the note at the top of
 * this file), never through `src/Services/SwapServices/`, which is the older
 * Exchange screens' path and is left alone. Each states the approvals its own
 * way, and `checkApproval` normalizes both onto `approvals`:
 *
 *   - Relay quotes every approval as its own `approve` step, so the pair arrives
 *     as two entries — read back off the quote, which keeps the spender and the
 *     calldata exactly as Relay intends them.
 *   - deBridge bundles nothing, so it reports only the spender and the calldata
 *     is built by the core's `buildApprovals`, which decides whether the zeroing
 *     leg is needed by asking the chain (an `eth_call` of the approve itself)
 *     rather than from a hard-coded token list — so every token that behaves this
 *     way is covered, not just the ones already reported.
 */
const buildApproveTxs = async ({ chainHexId, walletAddress, fromAddress, decimals, rawAmount, quote }) => {
  const wrap = (tx) => ({
    chainId: chainHexId,
    to: tx.to,
    data: tx.data,
    value: tx.value ?? '0',
    from: walletAddress
  })

  try {
    const service = swapProviderFactory.getServiceByProvider(quote.provider ?? DEFAULT_PROVIDER)
    const approval = await service.checkApproval({
      chain: chainHexId,
      userAddress: walletAddress,
      tokenAddress: fromAddress,
      amount: rawAmount,
      tokenDecimals: decimals,
      quoteData: quote
    })
    if (!approval?.isNeeded) return []

    // The full ordered list, whenever the provider gave one — this is Relay's
    // path, and the whole point of reading `approvals` rather than `approvalData`:
    // the latter is only ever the FIRST leg, so a token quoted as
    // zero-then-approve would send the zeroing approve and swap on an allowance
    // of 0.
    const ready = (approval.approvals || []).filter(tx => tx?.to && typeof tx.data === 'string')
    if (ready.length > 0) return ready.map(wrap)

    // A provider that hands back a single ready-made approval instead of a list
    // is taken at its word.
    if (approval.approvalData?.to && typeof approval.approvalData.data === 'string') {
      return [wrap(approval.approvalData)]
    }

    // Neither shape came back, only a spender: encode the plain approve, which
    // is what this flow sent before either provider reported a list. No zeroing
    // leg is inferred here — deciding that needs the chain, and the providers
    // already do it (see `buildApprovals` in the core).
    const spender = approval.contractAddress
    if (!spender) return []
    return [wrap({
      to: fromAddress,
      data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [spender, BigInt(rawAmount)] }),
      value: '0'
    })]
  } catch (e) {
    // An unreadable allowance must not block the quote: the swap flow re-checks
    // it at submit time and adds the approve legs then if they are still needed.
    return []
  }
}
