import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import BigNumber from 'bignumber.js'
import { compareDecimal, mulDivFloor, weiToHuman } from 'keyring-agent-core'
import I18n, { resolveLocale } from 'assets/Lang'
import images from 'assets/Image'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import { Colors } from 'common/styles'
import { getChainIconByChain } from 'common/chain'
import { useX402FeeFor } from 'frontend/Hooks/useX402Fees'
import { formatFeeLabel } from '../x402FeeLabel'
import { applyFeeReserve } from '../x402FeeReserve'
import X402SignModal from '../X402SignModal'
import { runX402Gate, X402_PATH } from '../WalletActionForm/x402Gate'
import SwapStatusTimeline from '../SwapShared/SwapStatusTimeline'
import useSwapFlow, { SWAP_STEP, isBusyStep, fmtAmount } from '../SwapShared/useSwapFlow'
import { toChainId } from '../SwapShared/swapChecks'
import AutoFitAmountInput from 'frontend/Screen/TokenDetailScreen/Component/Exchange/Components/AutoFitAmountInput'
import FiatAmountInput, { MAX_DECIMAL_2USD } from './FiatAmountInput'
import useSwapQuote from './useSwapQuote'
import useSpendableBalance from './useSpendableBalance'
import useToTokenPrice from './useToTokenPrice'
import { toUsd } from './toUsd'
import styles from './styles'
import { useChatKeyboard } from '../KeyboardAware'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })
const tv = (key, locale, opts) => I18n.t(key, { ...(opts || {}), locale: resolveLocale(locale) })

// 50% and Max, as the app's own Exchange screen offers — not the four steps the
// old action-button picker used. Matching the swap screen matters more than the
// extra granularity: the field is right there for anything in between.
const PERCENTS = [50, 100]

/**
 * `SwapTokenForm` — the whole swap, in one card.
 *
 * ONE form serves every case the agent can reach it with. When the user named an
 * amount ("swap 10 USDC to USDT") it opens pre-filled and quoted on sight; when
 * they did not, it opens empty for them to size. Either way the amount stays
 * editable, the quote re-runs as it settles, and the button below SWAPS — there
 * is no second card to confirm on.
 *
 * That also fixes staleness by construction. The old confirm card was quoted
 * once by the agent and expired after 60s, sending the user back to ask again;
 * this quotes for the amount currently on screen, so what executes is always
 * what was just priced.
 *
 * Styled to read as the app's own Exchange screen — the sell/buy panels, the
 * arrow badge on the seam, the pill percentages, the auto-fitting amount input
 * are all its components and tokens, so a user who has swapped in the app
 * recognises this on sight.
 *
 * Two rules it exists to keep:
 *
 *   - Percentages are EXACT. Every fraction is `mulDivFloor` over the spendable
 *     balance — the core's own helper, floored and quantised to the token's
 *     decimals. Float math on a balance rounds UP, and a "Max" that rounds up is
 *     an amount the user does not have.
 *   - The balance is already SPENDABLE. For a native source the agent deducted
 *     the gas reserve before sending it, so Max still leaves gas for the swap.
 *
 * Execution reuses `useSwapFlow` and `SwapStatusTimeline` — the same approve →
 * swap sequence, x402 gate and timeline as the agent's own confirm card, so
 * there is one implementation of "how a swap runs", not two.
 */
/**
 * A token side's icon.
 *
 * The tool sends `logo` for anything it resolved through a balance or the token
 * search, but the NATIVE coin has no such entry — it is the chain itself, so its
 * icon is the chain's. Without this the sell panel renders the blank placeholder
 * for every ETH/BNB swap, which is the most common swap there is.
 */
const tokenIcon = (token, chainId) =>
  token?.logo || (token?.address === 'native' ? getChainIconByChain(chainId) : undefined)

export default function SwapTokenForm ({
  props,
  language,
  onResult,
  onStatusChange,
  onCopyHash,
  onPersist,
  onPropsUpdate,
  screenRef
}) {
  const t = useCallback((key, opts) => tt(key, language, opts), [language])
  const tApp = useCallback((key, opts) => tv(key, language, opts), [language])
  const { chain, fromToken, toToken, walletAddress, intent, initialAmount, txState } = props || {}

  const isBuy = intent === 'buy'
  const x402Path = isBuy ? X402_PATH.buyToken : X402_PATH.swapToken

  // The title names the token the REQUEST was about, which is a different side
  // per intent: "swap USDC" starts from what you hold, "buy PEPE" from what you
  // want. Falls back to the bare verb until that side's symbol is known, so the
  // header never reads "Swap undefined".
  const titleToken = isBuy ? toToken?.symbol : fromToken?.symbol
  const title = titleToken
    ? t(isBuy ? 'buyTitleWith' : 'swapTitleWith', { symbol: titleToken })
    : t(isBuy ? 'buyTitle' : 'swapTitle')
  const chainId = toChainId(chain?.hexId)
  const decimals = fromToken?.decimals ?? 18

  // The amount being sized. Seeded from a previous submit first (so returning to
  // the chat shows what was actually swapped rather than an empty field above a
  // completed transaction), then from the amount the user named to the agent.
  const [amount, setAmount] = useState(() => txState?.amount ?? initialAmount ?? '')
  // Which pill is active, so it reads as selected. Cleared the moment the user
  // types — a hand-typed figure is no longer "50%".
  const [activePercent, setActivePercent] = useState(null)

  // ─── The editable fiat side of the sell amount ─────────────────────────────
  // The sell panel has TWO fields for ONE amount: tokens above, the user's own
  // currency below. Either drives the other, exactly as the Exchange screen's
  // does — a user who thinks in dollars ("swap about $50 of this") should not
  // have to divide by a price in their head to name it.
  //
  // `fiatAmount` is the fiat-side TEXT (already × rate, 2 decimals) and is ONLY
  // read while that field is focused. `fiatEdited` records that the number
  // currently on screen was TYPED there rather than derived from the token
  // amount — which is what keeps a typed "1000" reading as 1000 instead of the
  // 999.96 a fiat → token → fiat round-trip returns. Both are cleared whenever
  // the token amount is set from anywhere else (typing, a pill, a restore).
  const [fiatAmount, setFiatAmount] = useState('')
  const [fiatEdited, setFiatEdited] = useState(false)
  // The USD→fiat rate the field is denominated in. Read here as well as inside
  // FiatAmountInput because the conversion back to a token amount happens on
  // this side — the field hands up what the user typed in THEIR currency.
  const fiatRate = useSelector((s) => s.fiatRateRedux)

  // What this swap costs in x402, from the backend's price list. Read HERE,
  // above the balance maths, because the fee is part of that maths: when the
  // charge is settled in the very token being sold, it comes out of the same
  // balance the amount is sized against. Also drives the "※ Fee" line and
  // whether the paid gate runs at all — see the gate wiring below.
  const { fee: x402Fee, isLoading: feesLoading } = useX402FeeFor(x402Path)

  // The wallet's balance of the sell token, human-readable. Derived from the
  // smallest-unit figure rather than trusting the display string, so the number
  // shown and the number the percentages divide are provably the same one.
  const grossSpendable = useMemo(() => {
    if (fromToken?.rawAmount == null) return fromToken?.amount ?? '0'
    try {
      return weiToHuman(BigInt(fromToken.rawAmount), decimals)
    } catch (e) {
      return fromToken?.amount ?? '0'
    }
  }, [fromToken?.rawAmount, fromToken?.amount, decimals])

  // The balance with the x402 fee already taken off — the figure Max divides and
  // the validator enforces.
  //
  // Selling a whole USDC balance while the fee is ALSO charged in USDC leaves
  // nothing to settle it: the swap is signed, the payment is not, and the user
  // is stopped at the approval sheet holding an amount the card itself proposed.
  // Reserving it up front is what makes Max mean "the most I can actually swap".
  // A different sell token or chain reserves nothing — see x402FeeReserve.
  const { spendable } = useMemo(
    () => applyFeeReserve(grossSpendable, x402Fee, { chainId, address: fromToken?.address }),
    [grossSpendable, x402Fee, chainId, fromToken?.address]
  )

  // ─── Validation ────────────────────────────────────────────────────────────
  // What is wrong with the amount on screen, as a translation KEY — or null when
  // nothing is. One function decides, and everything downstream reads its answer:
  // the message under the panels, whether the button may act, and (below) whether
  // it is worth quoting at all. Spreading the same judgement across those three
  // is how they drift apart and the card ends up disabled with nothing said, or
  // complaining under an armed button.
  //
  // Deliberately NOT reporting an empty or half-typed amount ('', '0.', '.'). The
  // card opens empty whenever the user did not name an amount, and opening
  // covered in red would be complaining about something they have not done yet.
  // The button is disabled by the absence of a quote, which needs no explaining.
  const amountErrorKey = useMemo(() => {
    if (!amount) return null
    // Exact decimal-string maths, the same helper the percentage pills use.
    // Float comparison is what this form exists to avoid: parsed as floats, the
    // very amount the Max pill produced can compare OVER the balance it was
    // taken from, blocking a spend the wallet can certainly afford. A
    // half-typed amount reads as 0 here rather than throwing, so the field
    // stays quiet until there is a real number to judge.
    if (compareDecimal(amount, '0') <= 0) return null
    // Only when a balance was actually read. The tool omits `rawAmount` when it
    // could not fetch one — the same case that hides the pills and the spendable
    // line — and an unread balance must never be reported as "not enough": the
    // user would be blocked by a number nobody has.
    if (fromToken?.rawAmount != null && compareDecimal(amount, spendable) > 0) {
      return 'insufficientBalance'
    }
    return null
  }, [amount, spendable, fromToken?.rawAmount])

  // An amount the router should not be asked about and the button must not act
  // on. Named for what it MEANS rather than for the check that produced it, so
  // the gates below read as intent.
  const amountInvalid = !!amountErrorKey

  // Did this card already SUCCEED in an earlier visit? Read from `txState` rather
  // than the flow's `step`, because the flow is built BELOW this hook and its
  // step is not available yet.
  //
  // Deliberately DONE only, not ERROR. A failed run still offers Retry, and
  // retrying needs fresh calldata — suppressing the quote there would leave a
  // Retry button that can never become enabled.
  const restoredDone = txState?.step === SWAP_STEP.DONE

  // A restored estimate belongs to the restored amount — pairing them is what
  // makes the receive panel correct on the first paint, for EVERY state the card
  // can come back in: quoted-but-not-sent, failed, or done. Re-entering the chat
  // must not cost a router call to redraw a number the user already saw.
  //
  // It is a DISPLAY seed only. It carries no calldata, so the hook keeps quoting
  // underneath it whenever `enabled` — which is what lets a FAILED card show its
  // last estimate immediately AND still arm Retry once the fresh quote lands.
  // The whole persisted quote is handed back, calldata included, for the amount
  // it was taken against. A quote still inside its TTL therefore comes back
  // EXECUTABLE — re-entering the chat costs no router call and presents no
  // Refresh, because the price on screen is the same live price the user left.
  // Past the TTL the same payload restores as display only and the card asks to
  // be re-priced, which is the one case that needs a router call.
  const restoredQuote = txState?.amount === amount ? txState?.quote : undefined
  const { quote, loading: quoting, error: quoteError, retry: requote, isRestored, isStale } = useSwapQuote({
    fromToken,
    toToken,
    amount,
    chainHexId: chain?.hexId,
    walletAddress,
    restoredQuote,
    // A completed swap is a record, not an offer: re-quoting would overwrite the
    // amounts it is reporting. A FAILED one still quotes, because its Retry needs
    // fresh calldata to run.
    enabled: !restoredDone,
    // An amount this card has already rejected is not worth a router call: the
    // button is blocked whatever the router answers, so pricing it spends a
    // request per keystroke on a receive figure the user cannot act on — and the
    // reason it is blocked is already on screen, which a provider's own wording
    // would only muddy.
    amountRejected: amountInvalid
  })

  // The balance re-read, armed but never fired on its own — `onRequote` below is
  // the only caller. Lives in the CORE so it is the same read (gas reserve and
  // all) the agent seeded this form with.
  const { refreshSpendable } = useSpendableBalance({
    chain: chain?.hexId,
    walletAddress,
    tokenAddress: fromToken?.address
  })

  // The RECEIVE side's price, re-read on the same Refresh. Its own hook because
  // the destination token is not held: the sell side's price arrives free with
  // the balance row above, this one has to be asked for.
  const { refreshToPrice } = useToTokenPrice({
    chain: chain?.hexId,
    tokenAddress: toToken?.address
  })

  // What each side is WORTH, for the fiat line under each amount — the same
  // thing the app's own Exchange screen shows there.
  //
  // The prices come FROM THE CORE, on the props: each side carries the
  // `usdPrice` the tool read when it built this form, the from-side lifted off
  // the very wallet-balance row the spendable figure came from. Nothing here
  // fetches a price, and nothing polls for one.
  //
  // That is deliberate, and it is the same rule the balance and the quote
  // already follow: this card costs no network on mount, so re-entering a chat
  // and scrolling past old swap cards stays free. The price refreshes with the
  // balance when the user taps Refresh — `onRequote` merges the re-read into
  // `fromToken`, price included — so the amount and the valuation beside it are
  // always numbers from the same moment. A price on its own timer would drift
  // against the balance under it, and the card could not say which was stale.
  //
  // This replaced the "Spendable: 1.23 USDC" line that used to sit under the
  // sell amount. The balance itself did not go anywhere: it still sizes the
  // percentage pills and still backs the insufficient-balance message, which is
  // where it actually does work. As a permanent line it was answering a question
  // the Max pill already answers with one tap, in the space where every other
  // swap surface in the app puts the value of what you are about to trade.
  const amountInUsd = useMemo(
    () => toUsd(amount, fromToken?.usdPrice),
    [amount, fromToken?.usdPrice]
  )

  // What the fiat field SHOWS when it is not being typed into.
  //
  // Normally that is just `amountInUsd` — the token amount priced. But when the
  // user typed the fiat value themselves, it is that value converted straight
  // back to USD (÷ rate) instead of round-tripped through price × amount: a
  // typed 1000 becomes 0.2891… tokens, and pricing those returns 999.96, so the
  // field the user was looking at would silently rewrite their own number the
  // moment they left it. Exchange keeps the typed value verbatim for exactly
  // this reason, and so does this.
  const amountInUsdForDisplay = useMemo(() => {
    if (fiatEdited && fiatAmount !== '' && !isNaN(Number(fiatAmount))) {
      return BigNumber(fiatAmount).div(fiatRate > 0 ? fiatRate : 1).toString()
    }
    return amountInUsd
  }, [fiatEdited, fiatAmount, amountInUsd, fiatRate])
  const amountOutUsd = useMemo(
    () => toUsd(quote?.estimatedOut, toToken?.usdPrice),
    [quote?.estimatedOut, toToken?.usdPrice]
  )

  // ─── x402 payment plumbing ─────────────────────────────────────────────────
  // The payment settles BEFORE anything is signed, so
  // an attempt can cost the fee and still fail. Remembering it keeps a retry
  // from charging twice for one swap.
  const [x402Req, setX402Req] = useState(null)
  // Keeps the sell panel above the keyboard while an amount is typed. No-op when
  // this card renders outside the chat thread.
  const { scrollInputIntoView } = useChatKeyboard()
  // Anchors for the sell side, one per editable row. Deliberately NOT the whole
  // panel: with the keyboard up the panel (header + percent chips + amount +
  // fiat row) is taller than what is left of the screen, and an anchor taller
  // than the visible window can only be pinned by one edge — which is exactly
  // how a field near the top ends up shoved under the header.
  //
  // Each row anchors itself instead. They sit directly above/below one another,
  // so bringing either fully into view leaves the other adjacent to it anyway.
  const sellAmountRowRef = useRef(null)
  const sellFiatRowRef = useRef(null)

  const x402ResolveRef = useRef(null)
  const handleX402Resolve = useCallback((signature) => {
    const resolve = x402ResolveRef.current
    x402ResolveRef.current = null
    setX402Req(null)
    resolve?.(signature)
  }, [])

  const [x402Paid, setX402Paid] = useState(!!txState?.x402Paid)
  const x402PaidRef = useRef(x402Paid)
  const markX402Paid = useCallback(() => {
    x402PaidRef.current = true
    setX402Paid(true)
  }, [])

  // The tokens as the flow wants them: the source carries what is being spent
  // (and the smallest-unit figure the quote was built against, which the
  // allowance check reads), the destination the quoted estimate.
  const flowFromToken = useMemo(
    () => ({ ...fromToken, amount, rawAmount: quote?.fromRawAmount }),
    [fromToken, amount, quote?.fromRawAmount]
  )
  const flowToToken = useMemo(
    () => ({ ...toToken, amount: quote?.estimatedOut, rawAmount: quote?.estimatedOutRaw }),
    [toToken, quote?.estimatedOut, quote?.estimatedOutRaw]
  )

  const gate = useCallback(({ verify, lendKey, noteFeeToken } = {}) => {
    if (x402PaidRef.current) return null
    return runX402Gate({
      verify,
      onPaid: (feeToken) => {
        markX402Paid()
        noteFeeToken?.(feeToken)
      },
      onKey: lendKey,
      path: x402Path,
      query: {
        chainId: chain?.hexId,
        from: walletAddress,
        to: quote?.swapTx?.to,
        fromToken: fromToken?.address,
        toToken: toToken?.address,
        amount,
        provider: quote?.provider
      },
      walletAddress,
      requestSignature: (request) => new Promise((resolve) => {
        x402ResolveRef.current = resolve
        // What this swap is about to SELL, so the sheet can set it aside before
        // judging whether the fee is covered — selling USDC while the fee is
        // also charged in USDC means one balance funds both, and `balanceOf`
        // alone would call it affordable right up until the facilitator refuses.
        //
        // The form already reserves the fee while sizing the amount (see
        // applyFeeReserve above), but that is the PUBLISHED price; this is the
        // sheet's own check against the real challenge, and it has to see the
        // sell side to make it. Without this the sheet showed the full balance
        // on a swap the form had already trimmed — two different Spendable
        // figures for one action.
        //
        // The NATIVE side carries the literal 'native' rather than a contract,
        // which can never match an ERC-20 fee; passing it through is harmless
        // (the sheet's own match rejects it) and keeps this one shape for both.
        setX402Req({
          ...request,
          spend: {
            chainId,
            assetAddress: fromToken?.address,
            amount
          }
        })
      })
    })
  }, [x402Path, chain?.hexId, chainId, walletAddress, quote?.swapTx?.to, quote?.provider, fromToken?.address, toToken?.address, amount, markX402Paid])

  const { step, approveHashes, swapHash, requestId, error, execute, reset, settledLive, restoredFromHistory } = useSwapFlow({
    fromToken: flowFromToken,
    toToken: flowToToken,
    swapTx: quote?.swapTx,
    // Every approval this swap needs, in order — two when the pay token has to
    // have its allowance zeroed first. `approveTx` is the single-approval shape
    // older persisted quotes carry; passed alongside so those still execute.
    approveTxs: quote?.approveTxs,
    approveTx: quote?.approveTx,
    // Which router priced this quote — carried through so the timeline can link
    // the protocol's own explorer beside the chain one. Display only; nothing in
    // the execution path reads it.
    swapProvider: quote?.provider,
    // Relay's id for the quote's swap step, needed post-receipt to register the
    // tx with Relay's indexer so its explorer page has content. Null for
    // deBridge, which resolves its order id after the fact instead.
    quoteRequestId: quote?.requestId ?? null,
    walletAddress,
    chainId,
    language,
    onResult,
    // The PRICE LIST is what switches the gate on — priced means charged,
    // unpriced (or unreachable) means this executes free, matching the fee line
    // above the button.
    gate: x402Fee ? gate : undefined,
    nfcProxy: screenRef?.nfcProxy,
    initialState: txState
  })

  // The router behind what the timeline is SHOWING. The live quote whenever there
  // is one; otherwise the one persisted with the run — a quote restored past its
  // TTL keeps only its estimate, so a completed swap re-opened from history would
  // lose the provider (and with it the protocol explorer link) without this.
  const swapProvider = quote?.provider ?? txState?.provider

  const isIdle = step === SWAP_STEP.IDLE
  const isChecking = step === SWAP_STEP.CHECKING
  const isFailed = step === SWAP_STEP.ERROR
  const isDone = step === SWAP_STEP.DONE
  const busy = isBusyStep(step)

  // "Still showing the form": nothing has been signed yet (IDLE), the pre-send
  // checks and the x402 payment are running (CHECKING), or a run failed and the
  // button is offering a Retry (ERROR). From the first signature onwards the
  // timeline below is what reports progress, so the button unmounts rather than
  // sitting there disabled above it — the same treatment WalletActionForm and
  // SupplyFormShell give theirs.
  const isPreSend = isIdle || isChecking || isFailed

  // Once anything has been signed the amount is history, not an input: editing
  // it would leave the field disagreeing with the transaction shown below.
  const locked = busy || isDone

  // Keep the field a positive decimal the token can represent: a typed comma
  // becomes a dot, and the fraction is capped to the token's decimals — digits
  // past that would be silently truncated at signing time.
  const onChangeAmount = useCallback((raw) => {
    const cleaned = String(raw).replace(/,/g, '.').replace(/[^0-9.]/g, '')
    const i = cleaned.indexOf('.')
    setAmount(i === -1
      ? cleaned
      : `${cleaned.slice(0, i)}.${cleaned.slice(i + 1).replace(/\./g, '').slice(0, decimals)}`)
    setActivePercent(null)
    // The token side is now the one being driven, so the fiat line goes back to
    // being derived from it — keeping the "typed verbatim" flag here would pin
    // the fiat field to a stale number while the tokens above it changed.
    setFiatEdited(false)
  }, [decimals])

  // The user types a FIAT amount — the mirror of the field above. Convert their
  // currency → USD → tokens using the sell token's price, and drive the token
  // field from the result.
  //
  // The USD figure is kept at FULL precision (no intermediate rounding); only
  // the token amount is quantised, and it is ROUNDED DOWN to the token's own
  // decimals. Down, always: rounding a fiat amount up produces a token amount
  // fractionally larger than what was asked for, and on a Max-sized entry that
  // is an amount the wallet does not have.
  //
  // An unpriced token has nothing to divide by, so the field is read-only there
  // and this can only be reached with a price in hand — but the guard stays,
  // since a price can drop out between renders.
  const onChangeFiat = useCallback((fiat) => {
    setFiatAmount(fiat)
    setFiatEdited(true)
    setActivePercent(null)

    const price = BigNumber(fromToken?.usdPrice || 0)
    if (!price.isFinite() || price.lte(0)) return

    const usd = BigNumber(fiat || 0).div(fiatRate > 0 ? fiatRate : 1)
    if (!usd.isFinite()) {
      setAmount('')
      return
    }

    const next = usd.dividedBy(price).decimalPlaces(decimals, BigNumber.ROUND_DOWN)
    // toFixed, not toString: BigNumber's toString switches to exponential
    // notation below 1e-7, and '1e-13' handed to the quote is not an amount.
    setAmount(next.isFinite() && next.gt(0) ? next.toFixed() : '')
  }, [fromToken?.usdPrice, fiatRate, decimals])

  // An exact fraction of the spendable balance, via the core's own helper — the
  // same one the agent uses when it sizes an amount itself, so a tap here and a
  // percentage resolved there produce byte-identical amounts.
  const onPickPercent = useCallback((p) => {
    setAmount(mulDivFloor(spendable, BigInt(p), 100n, decimals))
    setActivePercent(p)
    // Same reason as in onChangeAmount: the token side is driving again, so the
    // fiat line below must follow it rather than hold a previously typed figure.
    setFiatEdited(false)
  }, [spendable, decimals])

  // Persist what the card is showing, so returning to the chat redraws it as the
  // user left it rather than re-deriving it.
  //
  // This runs in IDLE too, which is the whole point: a card the user quoted and
  // then walked away from has no transaction behind it, but it DOES have an
  // amount and an estimate on screen, and re-entering the chat should show those
  // two numbers immediately instead of an empty receive panel that fills in half
  // a second later. Persisting only from CHECKING onwards is what made every
  // re-entry fire a fresh router call.
  //
  // An unquoted IDLE card is skipped: with no estimate yet there is nothing to
  // restore, and writing one would overwrite a previously persisted estimate
  // with `undefined` on the very first render after a remount.
  useEffect(() => {
    if (!x402Paid && isIdle && !quote?.estimatedOut) return
    onPersist?.({
      step,
      approveHashes,
      swapHash,
      // Persisted alongside the hashes for the same reason: it is what the
      // protocol explorer link is built from, and re-entering the chat must
      // redraw that link rather than lose it (the lookup that produced it only
      // runs once, right after the receipt).
      requestId,
      // The router that executed it, stored on its own rather than read back off
      // the restored quote: a quote restored past its TTL keeps only the estimate
      // (no calldata, no provider), which would leave a completed swap showing its
      // hash with the protocol link silently missing.
      provider: swapProvider,
      error,
      x402Paid,
      amount,
      // The whole quote, calldata and timestamp included — not just the figure
      // on screen. Storing only `estimatedOut` is what made every re-entry
      // either fire a router call or present a Refresh for a price taken
      // seconds earlier: the card could redraw the number but had nothing left
      // to execute it with. `quotedAt` rides along inside, so a restored quote
      // ages from when it was actually taken rather than from this mount.
      quote
    })
  }, [step, approveHashes, swapHash, requestId, swapProvider, error, isIdle, x402Paid, amount, quote, onPersist])

  // Let the host scroll to keep the latest status in view, on a REAL transition
  // only — never on a remount, which would drag the list down while the user is
  // reading an older message.
  const lastNotifiedStepRef = useRef(step)
  useEffect(() => {
    if (isIdle || isChecking) {
      lastNotifiedStepRef.current = null
      return
    }
    if (lastNotifiedStepRef.current === step) return
    lastNotifiedStepRef.current = step
    onStatusChange?.()
  }, [step, isIdle, isChecking, onStatusChange])

  const received = useMemo(() => (
    quote?.estimatedOut ? { amount: fmtAmount(quote.estimatedOut), symbol: toToken?.symbol } : null
  ), [quote?.estimatedOut, toToken?.symbol])

  // The one message under the panels. The user's own input outranks the router:
  // a provider explaining why an unaffordable amount could not be priced is noise
  // beside "you don't have that much", which is the thing they can act on.
  const errorMessage = amountErrorKey ? t(amountErrorKey) : quoteError

  // Ready to swap only with a quote for the amount currently on screen. While a
  // re-quote is in flight the button holds rather than executing calldata built
  // for the PREVIOUS amount.
  //
  // A quote is not a permission slip: routers price a trade without checking who
  // is asking, so one can come back perfectly valid for an amount the wallet
  // cannot cover. `amountInvalid` is what keeps that from arming the button and
  // failing at signing — after the x402 fee has already been charged.
  const canExecute = !!quote?.swapTx && !quoting && !busy && !feesLoading && !amountInvalid

  // A card restored from storage shows its old estimate but holds no calldata, so
  // it cannot swap on that price — it has to be re-quoted first. Rather than
  // present a dead button, the button RE-PRICES: one tap turns the stored figure
  // back into a live, executable quote, and the second tap swaps.
  //
  // The alternative — quoting automatically on mount — is what made re-entering
  // the chat fire a router call every time. This keeps re-entry free and moves
  // the call to the moment the user actually intends to act.
  //
  // A LIVE quote ages into the same state: past `QUOTE_TTL_MS` the price it was
  // built on has moved, so executing it risks a revert or a worse fill than the
  // one on screen. The estimate is left visible — only the button changes, from
  // swapping the stale price to fetching a current one.
  const needsRequote = (isRestored || isStale) && !busy && !isDone

  // Re-pricing also clears a previous failure. The error under a failed run
  // describes calldata that is about to be thrown away, so leaving it up would
  // report a failure beside a button that has stopped offering to retry it — and
  // would keep the timeline showing dead hashes below a fresh quote.
  //
  // Re-pricing also re-reads the BALANCE. The spendable figure the card opened
  // with was read when the agent built this message, and by the time a quote has
  // gone stale the wallet may have moved — a swap executed elsewhere, a transfer
  // in — so a Max sized off it can exceed what is actually there. Refresh is the
  // moment the user asks for current numbers, so both are made current together.
  //
  // Only here: nothing re-reads the balance on mount or on a timer, for the same
  // reason nothing re-quotes there — re-entering the chat must stay free.
  //
  // The two run CONCURRENTLY and are independent. The quote is what the button
  // is waiting on; the balance read only rewrites a label and the percentage
  // pills, so it is never awaited before re-pricing, and a balance read that
  // fails leaves the old figure standing rather than blanking it.
  const onRequote = useCallback(() => {
    reset()
    requote()
    refreshSpendable().then((next) => {
      if (next) onPropsUpdate?.({ fromToken: { ...fromToken, ...next } })
    })
    // The receive side's price, refreshed alongside. Separate from the balance
    // read (a token the wallet does not hold has no balance row to carry a price
    // on) but on the same tap, so both fiat lines describe the same moment as
    // the quote landing between them.
    //
    // Merged only when a price actually came back: a lookup that failed must
    // leave the price the card is showing alone rather than blank the line, the
    // same rule the balance patch follows.
    refreshToPrice().then((price) => {
      if (price) onPropsUpdate?.({ toToken: { ...toToken, usdPrice: price } })
    })
  }, [reset, requote, refreshSpendable, refreshToPrice, onPropsUpdate, fromToken, toToken])

  // A RETRY whose quote has expired. The failed run's calldata is 45s old, so
  // re-sending it risks a revert or a worse fill than the figure on screen — but
  // making the user tap Refresh and then Retry would be two taps to resume one
  // action they already asked for. So the retry re-prices FIRST and executes on
  // whatever comes back, as a single tap.
  //
  // `retry()` is fire-and-forget — it bumps the quote effect rather than
  // returning a promise — and `execute` closes over `swapTx`, so calling the two
  // in sequence would execute the calldata being replaced. Instead this arms a
  // flag and lets the effect below fire once the NEW calldata is actually on
  // hand.
  const pendingExecuteRef = useRef(false)

  // Mirrors the ref for RENDER. `onRequote` calls `reset()`, which moves the
  // step ERROR → IDLE, so `isFailed` drops the instant the re-price starts and
  // the label would fall through to "Refresh" mid-retry. The spinner happens to
  // cover it, but the label shouldn't depend on that: this keeps the button
  // reading "Retry" for the whole round-trip, which is what the tap promised.
  const [retryingStale, setRetryingStale] = useState(false)

  const onRetryStale = useCallback(() => {
    pendingExecuteRef.current = true
    setRetryingStale(true)
    onRequote()
  }, [onRequote])

  // Fires the armed execute the moment a fresh, executable quote lands.
  //
  // Disarmed on anything that means the swap is no longer the thing to do: a
  // quote that came back with an error, an amount the card rejects, or a run
  // that started by some other route. Without that, a failed re-price would
  // leave the flag set and fire on some later, unrelated quote.
  useEffect(() => {
    if (!pendingExecuteRef.current) return
    if (quoting) return
    if (quoteError || amountInvalid || busy || isDone) {
      pendingExecuteRef.current = false
      setRetryingStale(false)
      return
    }
    if (!quote?.swapTx) return
    pendingExecuteRef.current = false
    setRetryingStale(false)
    execute()
  }, [quote?.swapTx, quoting, quoteError, amountInvalid, busy, isDone, execute])

  // Cancel an armed auto-execute if the user edits the amount while the
  // re-price is in flight — the tap authorised the amount they were looking at,
  // not the one they have since typed.
  useEffect(() => {
    pendingExecuteRef.current = false
    setRetryingStale(false)
  }, [amount])

  // Three jobs on one button, in priority order:
  //   - a FAILED run always retries, re-pricing first when its quote has aged out
  //   - an un-run card whose quote aged out re-prices, and stops there
  //   - otherwise, execute
  const onPressAction = isFailed
    ? (needsRequote ? onRetryStale : execute)
    : needsRequote
      ? onRequote
      : execute

  return (
    <View style={styles.card}>
      <View style={[styles.formBox, locked && styles.submitted]}>
        {/* Header: what this form does + which chain it runs on. The same
            title-row/divider opening every other in-chat form uses, so this card
            sits in the conversation looking like one of them rather than like a
            screen that wandered in. */}
        <View style={styles.headerBlock}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <MyTextTicker variant='subTitle' fontWeight={700}>
                {title}
              </MyTextTicker>
            </View>
            {!!chain?.name && (
              <View style={styles.headerMeta}>
                <View style={styles.tag}>
                  <MyText variant='small' className='text-medium'>{chain.name}</MyText>
                </View>
              </View>
            )}
          </View>
          <View style={styles.divider} className='bg-box-small' />
        </View>

        <View style={styles.pairBlock}>
          {/* ─── Sell: the token being spent, and how much of it ─────────── */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <MyText fontWeight={700} className='text-medium' variant='subTitle'>
                {t(isBuy ? 'swapSideSell' : 'swapSideFrom')}
              </MyText>
              {/* Percentages need a balance to be a fraction OF. When the tool
                  couldn't read one it sends no `rawAmount`, and the pills are
                  dropped rather than sized against nothing. */}
              {!locked && !!fromToken?.rawAmount && (
                <View style={styles.panelOptions}>
                  {PERCENTS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      activeOpacity={1}
                      style={[styles.btnOption, activePercent === p && styles.btnOptionSelected]}
                      onPress={() => onPickPercent(p)}
                    >
                      <MyText variant='small' className='text-brand'>
                        {p === 100 ? tApp('v2.common.max') : `${p}%`}
                      </MyText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View ref={sellAmountRowRef} style={styles.panelBody}>
              <TokenIconWithChain chainId={chainId} tokenIconUri={tokenIcon(fromToken, chainId)} />
              <View style={styles.panelAmount}>
                {/* minScale={0}: no readability floor — a long amount keeps
                    shrinking until it fits. The default floor (≈fontSize('small'))
                    stops shrinking early and lets a pasted/typed long number paint
                    past the panel, over the symbol on its right. Matches the Send
                    drawer and EditSpendingCapDrawer. */}
                <AutoFitAmountInput
                  value={amount}
                  onChangeText={onChangeAmount}
                  disabled={locked}
                  keyboardType='decimal-pad'
                  minScale={0}
                  // The chat thread's window never pans for the keyboard, so an
                  // in-bubble field scrolls itself into view on focus.
                  onFocus={() => scrollInputIntoView(sellAmountRowRef)}
                  placeholder='0'
                  placeholderTextColor={Colors.WHITE}
                  textStyle={styles.input}
                />
              </View>
              <MyTextTicker fontWeight={700}>{fromToken?.symbol || ''}</MyTextTicker>
            </View>

            {/* What the sell amount is worth, in the user's own currency — and,
                on this side, the SECOND way to name it. Exchange's field, under
                Exchange's amount: typing here back-computes the token amount
                above from the sell token's price, so a user who thinks in
                dollars ("about $50 of this") never has to divide by a price in
                their head. Typing above still drives this, so the two fields are
                one amount seen two ways.

                Editable only while the form is still an input: once anything is
                signed (`locked`) the amount is a record, and an unpriced token
                has no rate to convert through — both fall back to the same
                read-only rendering the receive side uses.

                Hidden ONLY when the token has no price at all. That is a
                different statement from "$0" — which would claim the amount is
                worth nothing, when the truth is nobody priced it — so the test
                is on `fromToken.usdPrice`, the price itself, not on
                `amountInUsd`, which is also null for an amount yet to be typed.

                Either way the row keeps its height, so the receive panel below
                never moves. */}
            <View ref={sellFiatRowRef} style={[styles.fiatRow, !fromToken?.usdPrice && styles.fiatRowHidden]}>
              {locked || !fromToken?.usdPrice
                ? (
                  <MyTextTicker variant='default' className='text-medium'>
                    <FiatBalance className='text-medium' valueUSD={amountInUsdForDisplay || '0'} fractionDigits={MAX_DECIMAL_2USD} />
                  </MyTextTicker>
                )
                : (
                  <FiatAmountInput
                    value={fiatAmount}
                    usdForDisplay={amountInUsdForDisplay}
                    onChangeFiat={onChangeFiat}
                    onFocus={() => scrollInputIntoView(sellFiatRowRef)}
                  />
                )}
            </View>
          </View>

          {/* The direction badge, sitting on the seam between the panels. */}
          <View style={styles.arrowRow}>
            <View style={styles.arrowAnchor}>
              <View style={styles.arrowBadge}>
                <MyIcon variant='title' uri={images.UIV2.icons.goArrowDownMedium} />
              </View>
            </View>
          </View>

          {/* ─── Buy: the token being received, and the live estimate ────── */}
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <MyText fontWeight={700} className='text-medium' variant='subTitle'>
                {t(isBuy ? 'swapSideBuy' : 'swapSideTo')}
              </MyText>
            </View>

            <View style={styles.panelBody}>
              <TokenIconWithChain chainId={chainId} tokenIconUri={tokenIcon(toToken, chainId)} />
              <View style={styles.panelAmount}>
                <AutoFitAmountInput
                  // The receive side is quoted, never typed: this is EXACT_INPUT,
                  // so the amount out follows from the amount in.
                  value={quote?.estimatedOut ? fmtAmount(quote.estimatedOut) : ''}
                  onChangeText={() => {}}
                  disabled
                  minScale={0}
                  placeholder='0'
                  placeholderTextColor={Colors.TEXT_MEDIUM}
                  textStyle={styles.inputReadOnly}
                />
              </View>
              <MyTextTicker fontWeight={700}>{toToken?.symbol || ''}</MyTextTicker>
            </View>

            {/* The receive side's value, on the same reserved row as the sell
                side's — so both panels are the same height and the arrow badge
                stays centred on the seam whether or not a quote has landed. */}
            <View style={[styles.fiatRow, amountOutUsd == null && styles.fiatRowHidden]}>
              <MyTextTicker variant='default' className='text-medium'>
                <FiatBalance className='text-medium' valueUSD={amountOutUsd || '0'} fractionDigits={MAX_DECIMAL_2USD} />
              </MyTextTicker>
            </View>
          </View>
        </View>

        {/* Everything below the panels serves the BUTTON — the error it would
            explain, the fee it would charge, the button itself — so once the
            button goes, the lot goes with it. Kept as two separate blocks they
            left a reserved error slot and an empty submit block behind, and with
            the form box's 14px gap on either side that came to ~60px of blank
            card under the receive panel: the gap that made a finished swap look
            unlike every other finished form in the chat.

            Gated on `isPreSend`, not merely on "not finished": from the first
            signature onwards (APPROVING → SWAPPING) the fee is already paid and
            the run can no longer be re-submitted, so the button has nothing left
            to offer. Leaving it mounted-but-disabled parked a dead "Pay fee and
            execute" above the live timeline for the whole run. */}
        {isPreSend && (
          <>
            {/* Whatever is wrong right now — the amount, or the router's reason
                for refusing it — in one slot, already resolved to a single
                message above. The space is reserved whether or not anything is
                showing, so an error arriving under a settling amount never
                pushes the button down. The text is absolutely positioned INSIDE
                the slot: a reason that wraps to a second line overflows rather
                than relaying out the card, the same treatment WalletActionForm
                gives its field errors. */}
            <View style={styles.errorSlot}>
              {!!errorMessage && (
                <MyText variant='small' className='text-red-text' style={styles.errorText} numberOfLines={2}>
                  {errorMessage}
                </MyText>
              )}
            </View>

            <View style={styles.submitBlock}>
              {/* The fee line belongs with the button that charges it, and now
                  shares its lifetime: the enclosing `isPreSend` already drops
                  both together. Shown through a FAILED run too — that Retry will
                  pay the fee again, so hiding the price there would leave a
                  "Pay fee and execute" button with no price beside it. */}
              {!!x402Fee && (
                <MyText className='text-medium'>
                  {t('walletActionFeeNotice', { fee: formatFeeLabel(x402Fee, language) })}
                </MyText>
              )}

              {/* The swap button. This IS the action — there is no second card to
                  confirm on. Held while a re-quote is in flight so it can never
                  broadcast calldata built for an amount the user has since
                  changed. */}
              <MyButton
                className='w-full'
                activeOpacity={0.8}
                // A bad amount blocks BOTH of the button's jobs. `canExecute`
                // already covers the swap; the first term covers the other,
                // since a stale card would otherwise keep an enabled Refresh
                // that spends a router call re-pricing an amount that can never
                // be executed.
                isDisable={amountInvalid || (!needsRequote && !canExecute)}
                // Quoting and the pre-send checks both render as the button's
                // own spinner. It keeps its size while loading, so the card
                // never reflows — where a separate status line appearing and
                // vanishing under a settling amount made everything below it
                // jump.
                isLoading={quoting || feesLoading}
                variant='primary'
                onPress={onPressAction}
              >
                {/* `isFailed` outranks `needsRequote` here, the reverse of the
                    un-run card: once a run has failed the button's job is to
                    resume it, and an expired quote is an implementation detail
                    of doing so — it re-prices and executes on one tap, so
                    "Refresh" would understate what the tap does. On a card that
                    has never run, a stale quote genuinely does mean "fetch a
                    price", and it stops there. */}
                <MyTextTicker fontWeight={700}>
                  {isChecking
                    ? (x402Fee ? t('walletActionPayingFee') : t('walletActionChecking'))
                    : (isFailed || retryingStale)
                      ? t('retry')
                      : needsRequote
                        ? t('swapRefreshQuote')
                        : x402Fee
                          ? t('walletActionPayFeeAndExecute')
                          : t('walletActionExecute')}
                </MyTextTicker>
              </MyButton>
            </View>
          </>
        )}
      </View>

      {/* Two-leg status timeline, once something has actually been sent. Hidden
          through IDLE and CHECKING: nothing is broadcast yet, so "Sending" would
          be a lie, and a cancelled payment must leave the card untouched. */}
      {!isIdle && !isChecking && (
        <SwapStatusTimeline
          step={step}
          approveHashes={approveHashes}
          swapHash={swapHash}
          error={error}
          language={language}
          onCopyHash={onCopyHash}
          chainId={chainId}
          walletAddress={walletAddress}
          provider={swapProvider}
          requestId={requestId}
          received={received}
          animate={settledLive}
          animateIntro={!restoredFromHistory}
        />
      )}

      <X402SignModal
        request={x402Req}
        walletAddress={walletAddress}
        onResolve={handleX402Resolve}
        screenRef={screenRef}
      />
    </View>
  )
}
