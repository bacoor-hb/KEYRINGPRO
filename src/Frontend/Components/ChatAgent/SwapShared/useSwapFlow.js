import { useCallback, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { getRpcUrlByChain, formatWeb3Error } from 'common/function'
import { isNativeToken } from 'common/tokens'
import I18n, { resolveLocale } from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'
import { resolvePrivateKey, withGasBuffer } from 'frontend/Hooks/useSendTx'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { zeroAddress } from 'viem'
import {
  checkSwapBalance,
  decodeApprove,
  pendingApprovals,
  toChainId,
  waitForAllowanceValue
} from './swapChecks'
import { toPlatformExchange, resolveDeBridgeRequestId, indexRelayTransaction } from './protocolExplorer'
import { PLATFORM_EXCHANGE } from 'common/constants/swap'

// One tap, every transaction.
//
// Swapping an ERC-20 needs the router to be allowed to pull it before the swap
// can execute — transactions the user should not have to drive separately. This
// hook runs the whole sequence from a single press:
//
//   check balance
//     → [approve → wait until the allowance is VISIBLE on-chain] × N
//     → swap → wait for receipt → done
//
// That second wait — re-reading `allowance` rather than trusting the approval's
// receipt — is what keeps the swap from being sent against a node that has not
// caught up yet. See `waitForAllowanceValue` in swapChecks.
//
// N is normally 1, and 2 for a pay token that refuses to overwrite a non-zero
// allowance. USDT on Ethereum is the canonical one: its `approve` carries
// `require(!((_value != 0) && (allowed[owner][spender] != 0)))`, so a standing
// allowance has to be zeroed before a new one can be granted, and the quote
// carries `approve(spender, 0)` followed by `approve(spender, amount)`. Running
// only the first would leave the router allowed to pull NOTHING and the swap
// would revert with the approval already paid for.
//
// Approve legs are SKIPPED when they are already satisfied, so a repeat swap (or
// a retry after a swap that failed AFTER its approvals landed) sends only what is
// still missing. A native source never approves at all. See `pendingApprovals`.
//
// The legs are deliberately sent one after the other rather than as one array:
// `postBaseSendTxs` maps its array through `Promise.all`, so batching would sign
// them against the same nonce and the swap would reach the chain before the
// approval it depends on. This mirrors useSupplyFlow exactly.

export const SWAP_STEP = {
  IDLE: 'IDLE',
  CHECKING: 'CHECKING',
  APPROVING: 'APPROVING',
  APPROVED: 'APPROVED',
  SWAPPING: 'SWAPPING',
  DONE: 'DONE',
  ERROR: 'ERROR'
}

/** Steps in which something is in flight and the card must not be re-submitted. */
export const isBusyStep = (step) =>
  step === SWAP_STEP.CHECKING ||
  step === SWAP_STEP.APPROVING ||
  step === SWAP_STEP.APPROVED ||
  step === SWAP_STEP.SWAPPING

const tr = (key, language, opts) =>
  I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })

/**
 * Wait for a broadcast tx to be mined and report whether it succeeded.
 * Mirrors `useSendTx`'s own waiter: 1 confirmation, 3-minute ceiling. A chain
 * with no configured RPC cannot be polled, so it optimistically returns true —
 * the same trade-off the shared hook makes.
 */
const waitForReceipt = async (hash, chainId, timeout = 180000) => {
  const rpcUrl = getRpcUrlByChain(toChainId(chainId))
  if (!rpcUrl) return true
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const receipt = await provider.waitForTransaction(hash, 1, timeout)
  return receipt?.status === 1
}

const isEvmAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim())

/**
 * Re-read every balance a completed swap moved.
 *
 * A swap touches up to four tokens, and only two are on the obvious path:
 *
 *   - the NATIVE coin — gas, on the swap chain, always, even for an ERC-20 swap
 *     (and twice over when the approve leg ran)
 *   - the SOURCE token — what left the wallet
 *   - the DESTINATION token — what arrived, often a balance the list has never
 *     seen before (the whole point of a buy)
 *   - the FEE token — what the x402 charge was settled in
 *
 * The fee is what forces this to be multi-chain: the backend prices its call in
 * its own token on its own chain, so a swap on Optimism can be paid for in USDC
 * on Base — a chain nothing else in this flow would think to refresh.
 *
 * Targets are therefore grouped BY CHAIN and one refresh is issued per chain:
 * `refreshAccountTokens` only takes the targeted RPC path (immediate, no indexer
 * lag) when given exactly one chain id, so a combined call would silently fall
 * back to the slow full refresh — the opposite of what a just-mined tx needs.
 *
 * The native coin rides along on the SWAP chain only. On a separate fee chain
 * nothing native moves — x402 settles as a signed transfer authorization the
 * facilitator broadcasts and pays the gas for — so that chain is refreshed for
 * its fee token alone. Mirrors refreshSupplyBalances.
 */
const refreshSwapBalances = ({ walletAddress, chainId, fromAddress, toAddress, feeToken }) => {
  const swapChainId = Number(chainId)
  if (!walletAddress || !Number.isFinite(swapChainId)) return

  // chainId → Set of token addresses. Addresses are normalized on the way in so
  // the Set actually dedupes: they arrive from three different sources (the
  // agent's payload, the quote, the x402 challenge), so the same contract can be
  // checksummed in one and lowercase in another, and the native coin has several
  // spellings (the zero address, `0xeee…`, a per-chain token address, the literal
  // 'native') that `refreshTokenBalances` folds onto one key anyway.
  const byChain = new Map()
  const add = (targetChainId, address, seedNative = false) => {
    const key = Number(targetChainId)
    if (!Number.isFinite(key)) return
    if (!byChain.has(key)) byChain.set(key, new Set(seedNative ? [zeroAddress] : []))
    if (!isEvmAddress(address)) {
      // Not an address — but the literal 'native' still names the coin, which the
      // seeded zeroAddress already covers on a native-seeded chain.
      return
    }
    byChain.get(key).add(isNativeToken(address, key) ? zeroAddress : String(address).trim().toLowerCase())
  }

  // The swap chain always gets an entry — its seeded native is what paid the gas.
  add(swapChainId, null, true)
  add(swapChainId, fromAddress, true)
  add(swapChainId, toAddress, true)
  // Folds into the entry above when the fee was charged on the swap chain;
  // otherwise opens a new one holding just the fee token.
  if (feeToken) add(feeToken.chainId, feeToken.assetAddress)

  setTimeout(() => {
    byChain.forEach((addresses, targetChainId) => {
      refreshAccountTokens(walletAddress, {
        chainIds: [targetChainId],
        tokenAddress: [...addresses]
      })
    })
  }, 1500)
}

/**
 * Drives the approve → swap sequence and exposes the state the timeline renders.
 *
 * Used by `SwapTokenForm`, which serves both framings of the one transaction: a
 * swap spends a token the user already holds, a buy spends a wallet token to
 * acquire a named one. The form normalizes either into the `fromToken`/`toToken`
 * pair below.
 *
 * @param {object}   fromToken      Source: `{ address, symbol, decimals, amount, rawAmount }`.
 *   `address` is an ERC-20 contract or the literal 'native'.
 * @param {object}   toToken        Destination, same shape (its `amount` is the estimate).
 * @param {object}   swapTx         The unsigned swap the agent built.
 * @param {string}   [swapProvider] Which router priced this swap ('relay' /
 *   'debridge'), straight off the quote. Only used to link the PROTOCOL's own
 *   explorer beside the chain one — it never affects execution, so an unknown or
 *   missing provider simply means no protocol link.
 * @param {object[]} [approveTxs]   Unsigned ERC-20 approvals to run first, IN
 *   ORDER. Empty when the source is native or the allowance already sufficed at
 *   quote time; two entries when the pay token needs its allowance zeroed before
 *   the real approve (see the note at the top of this file).
 * @param {object}   [approveTx]    The single-approval shape this hook took
 *   before `approveTxs`. Accepted so a run restored from an older chat message
 *   still executes; ignored when `approveTxs` is given.
 * @param {string}   walletAddress  Signer and receiver.
 * @param {string|number} chainId   Chain to broadcast on.
 * @param {string}   language       Locale for the error strings.
 * @param {Function} onResult       Called once, when the SWAP settles.
 * @param {Function} [gate]         Backend authorization run AFTER the balance
 *   check and BEFORE the key is read — the x402-paid call (see `runX402Gate`).
 *   Called with `{ verify, lendKey, noteFeeToken }`, resolving to an error string
 *   to abort or null to proceed. Deliberately last of the pre-send steps and
 *   deliberately ahead of the approval: the user is never asked to pay for a swap
 *   that could not have executed, and a declined payment must not leave a
 *   dangling allowance behind.
 *
 *   `lendKey` lets the gate hand back the key it read to sign the x402 payment.
 *   It matters more here than almost anywhere else: this flow signs TWO
 *   transactions, so without it one swap would cost a keycard user three card
 *   scans for what they did as a single tap.
 * @param {object}   [nfcProxy]     BaseContainer's `nfcProxy`, forwarded by the
 *   hosting screen. Required to swap from a COLD (NFC keycard) account, whose key
 *   lives on the card; hot accounts ignore it.
 * @param {string}   [quoteRequestId] Relay's id for the quote's swap step, used
 *   after the receipt to register the tx with Relay's indexer. Ignored by
 *   deBridge, whose order id is only resolvable post-receipt.
 * @param {object}   [initialState] A previous run's outcome, persisted into the
 *   chat message and handed back on remount.
 */
export default function useSwapFlow ({
  fromToken,
  toToken,
  swapTx,
  approveTxs,
  approveTx,
  swapProvider,
  quoteRequestId,
  walletAddress,
  chainId,
  language,
  onResult,
  gate,
  nfcProxy,
  initialState
}) {
  // Only a SETTLED run is restored. A card that was mid-flight when the user
  // navigated away cannot be resumed — the in-flight promise died with the
  // unmount — so rehydrating into APPROVING/SWAPPING would strand it on a
  // spinner that never resolves. Those come back as IDLE, ready to run again.
  const restored =
    initialState?.step === SWAP_STEP.DONE || initialState?.step === SWAP_STEP.ERROR
      ? initialState
      : null

  // Was this card ALREADY settled when it mounted (restored from the chat
  // history), as opposed to settling live in front of the user?
  //
  // Captured ONCE, via a lazy initializer, and deliberately not derived from
  // `initialState` on each render: the persist effect writes the live step back
  // into that same object as the run progresses, so a re-read would flip to
  // "restored" mid-flight and freeze the timeline's animations half-played.
  // Mirrors `restoredFromHistory` in useSendTx.
  const [restoredFromHistory] = useState(() => !!restored)
  // True only once something settled during THIS mount, so a rehydrated terminal
  // state renders statically while a live one animates. Mirrors `settledLive`.
  const [settledLive, setSettledLive] = useState(false)

  const [step, setStep] = useState(restored?.step ?? SWAP_STEP.IDLE)
  // Kept apart so the timeline can show the approvals' hashes above the swap's —
  // the swap never overwrites the approval line.
  //
  // A list because a swap can need more than one approve (the zero-then-approve
  // pair a token like USDT forces), and each one is a real transaction the user
  // paid for and must be able to open in an explorer. A run restored from an
  // older chat message carries the single `approveHash` instead, so that is
  // folded in here.
  const [approveHashes, setApproveHashes] = useState(
    restored?.approveHashes ?? (restored?.approveHash ? [restored.approveHash] : [])
  )
  const [swapHash, setSwapHash] = useState(restored?.swapHash ?? null)
  const [error, setError] = useState(restored?.error ?? null)
  // deBridge's order id for the settled swap — what its own explorer page is
  // keyed on. Held in state (and restored with the rest) because it is resolved
  // asynchronously AFTER the receipt, so the timeline gains the protocol link a
  // moment later rather than on the same render as the success.
  //
  // Relay needs no state here — its page is keyed on the tx hash the flow
  // already has — but it does need `indexRelayTransaction` fired after the
  // receipt, or that page resolves to nothing.
  const [requestId, setRequestId] = useState(restored?.requestId ?? null)

  // The approvals to run, as one list whichever shape the caller passed. The
  // single-`approveTx` form is what this hook took before a swap could need two,
  // and a chat message persisted by an older build still carries it — accepting
  // both keeps those runs executable.
  //
  // Memoized on the identities the caller actually re-creates, so `execute` is
  // not rebuilt on every render by a fresh array literal.
  const approveList = useMemo(
    () => (approveTxs?.length ? approveTxs.filter(Boolean) : approveTx ? [approveTx] : []),
    [approveTxs, approveTx]
  )

  // Guards a double-tap: the button is disabled while busy, but a fast second
  // press can land before React re-renders with the new step.
  const runningRef = useRef(false)

  const execute = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true

    // A retry starts from a clean slate — a previous attempt's hashes and error
    // must not linger under the new run.
    setApproveHashes([])
    setSwapHash(null)
    setError(null)
    setRequestId(null)

    const fail = (message) => {
      setError(message)
      setSettledLive(true)
      setStep(SWAP_STEP.ERROR)
      runningRef.current = false
      onResult?.({ success: false, error: message })
    }

    // A signing key the gate already read off the card, lent back so neither leg
    // asks for a second scan. Scoped to this ONE run and cleared in `finally` —
    // it is a plaintext key, so it must not outlive the swap that needed it, and
    // must never reach state or storage.
    let lentKey = null
    // Which token the gate charged, reported by the gate itself — the swap cannot
    // infer it, since the backend prices its call in its own token on its own
    // chain.
    let feeToken = null

    try {
      setStep(SWAP_STEP.CHECKING)

      if (!swapTx?.to || !swapTx?.data) return fail(tr('txFailed', language))

      const id = toChainId(chainId)
      const fromIsNative = isNativeToken(fromToken?.address, id)

      // Balance first: cheapest to fail, and it must run BEFORE any approval so a
      // doomed swap never leaves an allowance behind.
      const balanceError = await checkSwapBalance({
        chainId: id,
        from: walletAddress,
        token: fromToken?.address,
        amount: fromToken?.amount,
        symbol: fromToken?.symbol,
        language
      })
      if (balanceError) return fail(balanceError)

      // Backend authorization and its x402 charge, last thing before the key is
      // touched. It sits here — after the balance check, before the approval —
      // for two reasons: the user is never asked to pay for a swap that could not
      // have executed anyway, and a declined payment aborts while the wallet is
      // still untouched, with no dangling allowance to clean up.
      //
      // The check above is a snapshot and the approval sheet can stay open for as
      // long as the user takes to read it, so `verify` re-runs that same check on
      // the Pay tap, against current state.
      if (gate) {
        const gateError = await gate({
          verify: () => checkSwapBalance({
            chainId: id,
            from: walletAddress,
            token: fromToken?.address,
            amount: fromToken?.amount,
            symbol: fromToken?.symbol,
            language
          }),
          lendKey: (key) => { lentKey = key || null },
          noteFeeToken: (token) => { feeToken = token || null }
        })
        if (gateError) return fail(gateError)
      }

      // Hot account → secure storage; cold (NFC keycard) account → a card scan.
      // Resolved ONCE for the whole sequence and reused by both legs, so a keycard
      // is read a single time even though two transactions get signed.
      const privateKey = lentKey || await resolvePrivateKey(walletAddress, nfcProxy)
      if (!privateKey) return fail(tr('txFailed', language))

      // ---- Leg 1..N: the approvals, only those still outstanding --------------
      //
      // A native source never approves. Otherwise the quote's approve legs are
      // re-examined against the LIVE allowance rather than trusting the decision
      // made when the message was built: an earlier attempt of this very widget
      // may already have landed one of them, and charging for that twice is
      // exactly what a retry must not do. `pendingApprovals` returns what is
      // genuinely left, in order.
      const approvals = fromIsNative
        ? []
        : await pendingApprovals({
          chainId: id,
          owner: walletAddress,
          token: fromToken?.address,
          approveTxs: approveList,
          amountRaw: fromToken?.rawAmount
        })

      if (approvals.length > 0) {
        setStep(SWAP_STEP.APPROVING)
      }

      for (const approval of approvals) {
        // Sign with the estimate PLUS headroom, not the bare estimate.
        // `postBaseSendTxs` takes the higher of this and its own estimate, so a
        // buffered limit raises the floor without ever dropping below what the
        // node says the tx needs. A 0 (nothing could be estimated) simply leaves
        // the broadcast's own estimate in charge.
        const approveGas = await AllChainServices.estimateGasTxs(id, {
          to: approval.to,
          from: walletAddress,
          data: approval.data || '0x'
        })
        const approveResults = await AllChainServices.postBaseSendTxs(id, privateKey, [{
          to: approval.to,
          data: approval.data,
          value: approval.value || '0',
          valueNoConvert: approval.value || 0,
          gasLimit: withGasBuffer(approveGas)
        }], false)
        const aHash = approveResults?.[0]
        if (!aHash) return fail(tr('txFailed', language))
        // Appended, not replaced: every leg is a transaction the user paid for
        // and must be able to open in an explorer.
        setApproveHashes((prev) => [...prev, aHash])

        // What follows this tx — the next approve, or the swap — depends on the
        // allowance it sets, so it cannot be sent until this one is EFFECTIVE,
        // and the only proof of that is the allowance itself, read from the same
        // pool the next transaction will be broadcast through.
        //
        // A receipt is not that proof: it comes from one RPC while the swap reads
        // through ViemWeb3's fallback pool, which may be a block behind and still
        // report the old allowance. Sending on that view reverts, having already
        // charged the user for the approval. It matters just as much for a
        // ZEROING approve: a token only accepts the approve that follows once the
        // zero is visible, which is the whole reason the pair exists.
        //
        // The target is decoded from the approve calldata. When it cannot be —
        // a provider's own opaque approval payload (see decodeApprove) — there is
        // no allowance to poll, so the receipt is the best proof available and the
        // flow falls back to it.
        const decoded = decodeApprove(approval)
        if (decoded?.spender) {
          // Each leg is waited on for the value IT sets, not for the swap amount:
          // a zeroing approve is settled by the allowance reading exactly 0, and
          // judging it by the swap amount would time out on a leg that worked.
          const target = decoded.value
          const allowanceReady = await waitForAllowanceValue({
            chainId: id,
            owner: walletAddress,
            token: fromToken?.address,
            spender: decoded.spender,
            settled: (allowance) => (target === 0n ? allowance === 0n : allowance >= target)
          })

          // Never confirmed within the window. Ask the receipt whether the approve
          // actually failed on-chain, so the user is told which of the two it was:
          // a reverted approval, or one that landed but is not visible yet.
          if (!allowanceReady) {
            const mined = await waitForReceipt(aHash, id, 15000).catch(() => false)
            return fail(tr(mined ? 'swapApproveNotVisible' : 'swapApproveFailed', language))
          }
        } else {
          const ok = await waitForReceipt(aHash, id).catch(() => false)
          if (!ok) return fail(tr('swapApproveFailed', language))
        }
      }

      // Confirmed — only now is the approve stage done.
      if (approvals.length > 0) {
        setStep(SWAP_STEP.APPROVED)
      }

      // ---- Leg 2: the swap --------------------------------------------------
      setStep(SWAP_STEP.SWAPPING)

      // The swap is the leg worth measuring, and it is only measurable HERE:
      // before the approval it could not be simulated at all (it spends an
      // allowance that did not yet exist), while by this point the approve is
      // mined and confirmed, so `estimateGas` executes the real swap against real
      // state.
      //
      // A router swap is also the tx that most needs the headroom on top. Its cost
      // depends on the path it takes through pools, and any trade landing between
      // the estimate and the block can move it — crossing a tick, initializing a
      // storage slot from zero (20k, against 2.9k for a rewrite). The estimate
      // then reads LOW and the swap reverts out of gas with the approval's fee
      // already spent.
      //
      // A 0 (nothing measurable, e.g. a router that reverts on simulation for a
      // reason the broadcast tolerates) leaves `postBaseSendTxs`'s own estimate in
      // charge rather than signing a zero limit.
      const swapGas = await AllChainServices.estimateGasTxs(id, {
        to: swapTx.to,
        from: walletAddress,
        data: swapTx.data || '0x',
        value: swapTx.value || '0'
      })
      const swapResults = await AllChainServices.postBaseSendTxs(id, privateKey, [{
        to: swapTx.to,
        data: swapTx.data,
        value: swapTx.value || '0',
        valueNoConvert: swapTx.value || 0,
        gasLimit: withGasBuffer(swapGas)
      }], false)
      const sHash = swapResults?.[0]
      if (!sHash) return fail(tr('txFailed', language))
      setSwapHash(sHash)

      const ok = await waitForReceipt(sHash, id)
      if (!ok) return fail(tr('txFailed', language))

      setSettledLive(true)
      setStep(SWAP_STEP.DONE)
      runningRef.current = false

      // deBridge's explorer link needs an order id that only exists once the swap
      // has been indexed, so it is looked up here — deliberately NOT awaited. The
      // swap is settled; the user must see that immediately rather than wait on a
      // tracking call, and a link that never resolves just leaves the timeline
      // showing the chain explorer alone.
      const platform = toPlatformExchange(swapProvider)
      if (platform === PLATFORM_EXCHANGE.deBridge) {
        resolveDeBridgeRequestId({ hash: sHash, chainId: id })
          .then((resolved) => { if (resolved) setRequestId(resolved) })
          .catch(() => {})
      } else if (platform === PLATFORM_EXCHANGE.relay) {
        // Relay's explorer resolves against ITS index, not the chain, so a hash
        // it was never told about opens an empty page. The Exchange path does
        // this inside `getInfoDetailTx`; here it is the same registration,
        // fire-and-forget for the same reason as deBridge's lookup above — the
        // swap is already settled and only the link is still catching up.
        indexRelayTransaction({
          requestId: quoteRequestId,
          chainId: id,
          hash: sHash,
          rawTransaction: {
            to: swapTx.to,
            data: swapTx.data,
            value: swapTx.value || '0',
            from: walletAddress
          }
        }).catch(() => {})
      }

      // Everything this swap moved, re-read so the chat's balance-aware widgets
      // and the rest of the app reflect it. Delayed and targeted, matching how
      // useSendTx refreshes: the balance API needs a moment to catch up with a
      // just-mined tx.
      refreshSwapBalances({
        walletAddress,
        chainId: id,
        fromAddress: fromToken?.address,
        toAddress: toToken?.address,
        feeToken
      })
      onResult?.({ success: true, txHash: sHash })
    } catch (err) {
      // formatWeb3Error, never err.message: a viem error's message carries the
      // RPC URL (API key and all) plus the signed request body, and this string
      // is both rendered and persisted into the chat history.
      fail(formatWeb3Error(err, tr('txFailed', language)))
    } finally {
      // Drop the borrowed key as soon as this run is over, success or failure. It
      // is a plaintext private key held only to save the user extra scans, so its
      // life ends with the flow that justified it — a retry scans again rather
      // than signing from something kept since the last attempt.
      lentKey = null
    }
  }, [fromToken, toToken, swapTx, approveList, swapProvider, quoteRequestId, walletAddress, chainId, language, onResult, gate, nfcProxy])

  // Back to IDLE, dropping a failed attempt's error and hashes.
  //
  // For the case where the user asks for something OTHER than a retry after a
  // failure — re-quoting, say. The old reason describes calldata that is about
  // to be replaced, so leaving it up would show a failure next to a button that
  // is no longer offering to retry it.
  //
  // Deliberately a no-op unless the flow actually FAILED: a run in flight must
  // never be reset out from under itself, and a completed swap is a record that
  // stays on screen.
  const reset = useCallback(() => {
    // Guarded on the rendered step rather than inside a `setStep` updater: an
    // updater must stay pure, and clearing the hashes from within one would run
    // twice under StrictMode.
    if (runningRef.current || step !== SWAP_STEP.ERROR) return
    setStep(SWAP_STEP.IDLE)
    setError(null)
    setApproveHashes([])
    setSwapHash(null)
    setRequestId(null)
  }, [step])

  return {
    step,
    approveHashes,
    // The LAST approval's hash — the one that granted the real allowance, and
    // the single line a caller showing one approve row wants.
    approveHash: approveHashes[approveHashes.length - 1] ?? null,
    swapHash,
    requestId,
    error,
    execute,
    reset,
    settledLive,
    restoredFromHistory
  }
}

/** Display a token amount truncated (never rounded up) to `d` places, grouped. */
export const fmtAmount = (n, d = 8) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}
