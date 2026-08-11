import { useCallback, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { getRpcUrlByChain } from 'common/function'
import I18n, { resolveLocale } from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'
import { resolvePrivateKey } from 'frontend/Hooks/useSendTx'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { isNativeToken } from 'common/tokens'
import { zeroAddress } from 'viem'
import { buildApproveTxs, buildSupplyTxs } from './buildSupplyTx'
import { needsApprovalFor, previewShares, supplyPreCheck, waitForAllowance } from './supplyChecks'

// One tap, both transactions.
//
// Supplying USDC needs an ERC-20 `approve` before the deposit can pull the
// funds — two transactions the user should not have to drive separately. This
// hook runs the whole sequence from a single press:
//
//   check allowance
//     → [approve → wait for receipt → poll allowance until it is visible]
//     → supply → wait for receipt → done
//
// That second wait — re-reading `allowance` rather than trusting the approval's
// receipt — is what keeps the deposit from being sent against a node that has
// not caught up yet. See waitForAllowance.
//
// The approve leg is SKIPPED when the market already holds enough allowance, so
// a repeat supply is a single transaction.
//
// The two legs are deliberately sent one after the other rather than as one
// array: `postBaseSendTxs` maps its array through `Promise.all`, so batching
// would sign both in parallel against the same nonce, and the deposit would
// reach the chain before the approval it depends on.

export const SUPPLY_STEP = {
  IDLE: 'IDLE',
  CHECKING: 'CHECKING',
  APPROVING: 'APPROVING',
  APPROVED: 'APPROVED',
  SUPPLYING: 'SUPPLYING',
  DONE: 'DONE',
  ERROR: 'ERROR'
}

/** Steps in which something is in flight and the form must not be edited. */
export const isBusyStep = (step) =>
  step === SUPPLY_STEP.CHECKING ||
  step === SUPPLY_STEP.APPROVING ||
  step === SUPPLY_STEP.APPROVED ||
  step === SUPPLY_STEP.SUPPLYING

const tr = (key, language, opts) =>
  I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })

const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

/**
 * Wait for a broadcast tx to be mined, and report whether it succeeded.
 * Mirrors `useSendTx`'s own waiter: 1 confirmation, 3-minute ceiling. A chain
 * with no configured RPC can't be polled, so it optimistically returns true —
 * the same trade-off the shared hook makes.
 */
const waitForReceipt = async (hash, chainId, timeout = 180000) => {
  const rpcUrl = getRpcUrlByChain(toChainId(chainId))
  if (!rpcUrl) return true
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  const receipt = await provider.waitForTransaction(hash, 1, timeout)
  return receipt?.status === 1
}

const errText = (err, fallback) =>
  err?.shortMessage || err?.details || err?.message || (typeof err === 'string' ? err : '') || fallback

const isEvmAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim())

/**
 * Re-read every balance a completed supply moved.
 *
 * A supply touches up to four tokens, and only two of them are on the obvious
 * path:
 *
 *   - the NATIVE coin — gas, on the supply chain, always, even for an ERC-20
 *     supply (and twice over when the approve leg ran)
 *   - the SUPPLIED asset — what left the wallet
 *   - the RECEIPT token — the aToken / vault share that arrived in its place,
 *     which is a brand-new balance the list has never seen before
 *   - the FEE token — what the x402 charge was settled in
 *
 * The fee is the one that forces this to be multi-chain. The backend prices its
 * call in its own token on its own chain, so supplying USDC on Optimism can be
 * paid for in USDC on Base — a different chain from the one the supply ran on,
 * and one nothing else in this flow would think to refresh.
 *
 * So targets are grouped BY CHAIN and one refresh is issued per chain:
 * `refreshAccountTokens` only takes the targeted RPC path (immediate, no indexer
 * lag) when given exactly one chain id, so a combined call would silently fall
 * back to the slow full refresh — the opposite of what a just-mined tx needs.
 *
 * The native coin rides along on the SUPPLY chain only. On a separate fee chain
 * nothing native moves — x402 settles as a signed transfer authorization that the
 * facilitator broadcasts and pays the gas for — so that chain is refreshed for
 * its fee token alone.
 */
const refreshSupplyBalances = ({ walletAddress, chainId, assetAddress, receiptAddress, feeToken }) => {
  const supplyChainId = Number(chainId)
  if (!walletAddress || !Number.isFinite(supplyChainId)) return

  // chainId → Set of token addresses. The SUPPLY chain is seeded with the native
  // coin, which it always spent on gas (twice over when the approve leg ran). A
  // fee chain is not: x402 settles as a signed transfer authorization that the
  // facilitator broadcasts and pays for, so nothing native moves there and only
  // the fee token itself changed.
  const byChain = new Map()
  // Normalized on the way in so the Set actually dedupes. Two things would
  // otherwise slip a duplicate through, because these addresses come from three
  // different sources (the agent's payload, the market metadata, the x402
  // challenge):
  //   - CASING — the same contract can arrive checksummed from one and lowercase
  //     from the other
  //   - NATIVE SPELLING — the native coin has several representations (the zero
  //     address, `0xeee…`, a per-chain token address), and `refreshTokenBalances`
  //     folds them all onto one key, so two spellings here mean reading the same
  //     balance twice
  // Collapsing natives onto `zeroAddress` matches how that function normalizes
  // its own inputs.
  const add = (targetChainId, address, seedNative = false) => {
    const key = Number(targetChainId)
    if (!Number.isFinite(key)) return
    if (!byChain.has(key)) byChain.set(key, new Set(seedNative ? [zeroAddress] : []))
    if (!isEvmAddress(address)) return
    byChain.get(key).add(isNativeToken(address, key) ? zeroAddress : String(address).trim().toLowerCase())
  }

  // The supply chain always gets an entry — called with no address so its native
  // is registered even when neither the asset nor the receipt resolves.
  add(supplyChainId, null, true)
  add(supplyChainId, assetAddress, true)
  add(supplyChainId, receiptAddress, true)
  // When the fee was charged on the supply chain this folds into that entry;
  // otherwise it opens a new one holding just the fee token.
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
 * Drives the supply sequence and exposes the state the timeline renders.
 *
 * @param {object}   market         Resolved market (contract, type, protocol).
 * @param {object}   asset          USDC on this chain (address, symbol, decimals).
 * @param {string}   walletAddress  Signer; also the receiver of the receipt token.
 * @param {string|number} chainId   Chain to broadcast on.
 * @param {string}   language       Locale for the error strings.
 * @param {Function} onResult       Called once, when the SUPPLY settles.
 * @param {Function} [gate]         Optional backend authorization run AFTER the
 *   pre-check and BEFORE the key is read — the x402-paid call (see `runX402Gate`).
 *   Called with `{ verify, lendKey }` and resolves to an error string to abort, or
 *   null to proceed. Deliberately last of the pre-send steps, and deliberately
 *   ahead of the approval: it can cost the user money, so it only runs once the
 *   supply has been proven affordable, and a declined payment must not leave an
 *   allowance behind. `verify` re-runs the same pre-check at the moment the payment
 *   is actually approved, since the sheet can sit open for an unbounded time.
 *
 *   `lendKey` lets the gate hand back the key it read to sign the x402 payment, so
 *   a COLD (keycard) account is not asked for the card again. It matters more here
 *   than anywhere else: this flow signs TWO transactions, so without it one supply
 *   would cost three card scans (payment, approve, deposit) for what the user did
 *   as a single tap. Both legs below sign from the one resolved key regardless, so
 *   accepting a lent one brings that to zero extra scans.
 * @param {object} [nfcProxy]       BaseContainer's `nfcProxy`, forwarded by the
 *   hosting screen. Required to supply from a COLD (NFC keycard) account, whose key
 *   lives on the card and has to be scanned at signing time; hot accounts ignore it.
 */
export default function useSupplyFlow ({
  market,
  asset,
  walletAddress,
  chainId,
  language,
  onResult,
  gate,
  nfcProxy,
  // A previous run's outcome, persisted into the chat message and handed back on
  // remount. Seeding from it is what lets a settled card survive leaving and
  // returning to the conversation, instead of resetting to an empty form.
  initialState
}) {
  // Only a SETTLED run is restored. A card that was mid-flight when the user
  // navigated away cannot be resumed — the in-flight promise died with the
  // unmount — so rehydrating into APPROVING/SUPPLYING would strand it on a
  // spinner that never resolves. Those come back as IDLE, ready to run again.
  const restored =
    initialState?.step === SUPPLY_STEP.DONE || initialState?.step === SUPPLY_STEP.ERROR
      ? initialState
      : null

  const [step, setStep] = useState(restored?.step ?? SUPPLY_STEP.IDLE)
  // Kept apart so the timeline can show the approval's hash above the deposit's
  // once both exist — the deposit never overwrites the approval's line.
  const [approveHash, setApproveHash] = useState(restored?.approveHash ?? null)
  const [supplyHash, setSupplyHash] = useState(restored?.supplyHash ?? null)
  const [error, setError] = useState(restored?.error ?? null)

  // Guards a double-tap: the button is disabled while busy, but a fast second
  // press can land before React re-renders with the new step.
  const runningRef = useRef(false)

  const reset = useCallback(() => {
    setStep(SUPPLY_STEP.IDLE)
    setApproveHash(null)
    setSupplyHash(null)
    setError(null)
  }, [])

  const execute = useCallback(async (amount) => {
    if (runningRef.current) return
    runningRef.current = true

    // A retry starts from a clean slate — a previous attempt's hashes and error
    // must not linger under the new run.
    setApproveHash(null)
    setSupplyHash(null)
    setError(null)

    const fail = (message) => {
      setError(message)
      setStep(SUPPLY_STEP.ERROR)
      runningRef.current = false
      onResult?.({ success: false, error: message })
    }

    // A signing key the gate already read off the card, lent back so neither leg
    // asks for a second scan. Scoped to this ONE run and cleared in `finally` — it
    // is a plaintext key, so it must not outlive the supply that needed it, and
    // must never reach state or storage.
    let lentKey = null
    // Which token the gate charged, reported by the gate itself — the supply
    // cannot infer it, since the backend prices its call in its own token on its
    // own chain (a supply on Optimism paid for in USDC on Base).
    let feeToken = null

    try {
      setStep(SUPPLY_STEP.CHECKING)

      // Balance + vault safety first: cheapest to fail, and it must run BEFORE
      // any approval, so a doomed supply never leaves an allowance behind.
      const precheckError = await supplyPreCheck({
        chainId,
        from: walletAddress,
        market,
        asset,
        amount,
        language
      })
      if (precheckError) return fail(precheckError)

      // Backend authorization and its x402 charge, last thing before the key is
      // touched. It sits here — after the balance/gas check, before the approval
      // — for two reasons: the user is never asked to pay for a supply that
      // could not have executed anyway, and a declined payment aborts while the
      // wallet is still untouched, with no dangling allowance to clean up.
      //
      // The check above is a snapshot and the approval sheet can stay open for
      // as long as the user takes to read it, so `verify` re-runs that same
      // check on the Pay tap, against current state.
      if (gate) {
        const gateError = await gate({
          verify: () => supplyPreCheck({
            chainId,
            from: walletAddress,
            market,
            asset,
            amount,
            language
          }),
          // Offered so the key read to sign the x402 payment can sign both legs
          // below too — otherwise a keycard user taps the card three times for one
          // supply. Only accepted while this call is still in the gate.
          lendKey: (key) => { lentKey = key || null },
          // Records the token the fee was settled in, for the refresh below.
          noteFeeToken: (token) => { feeToken = token || null }
        })
        if (gateError) return fail(gateError)
      }

      // Hot account → secure storage; cold (NFC keycard) account → a card scan.
      // Resolved ONCE for the whole sequence and reused by both legs, so a keycard
      // is read a single time even though two transactions get signed.
      //
      // `resolvePrivateKey` (shared with useSendTx) rather than a direct storage
      // read: a cold account keeps an EMPTY key on the device, so reading storage
      // returns '' and the supply died as a generic "transaction failed" with no
      // hint that the card was the missing piece.
      const privateKey = lentKey || await resolvePrivateKey(walletAddress, nfcProxy)
      if (!privateKey) return fail(tr('txFailed', language))

      // ---- Leg 1: approve, only when the standing allowance is short --------
      const needsApproval = await needsApprovalFor({
        chainId,
        owner: walletAddress,
        asset,
        market,
        amount
      })

      if (needsApproval) {
        setStep(SUPPLY_STEP.APPROVING)
        const approveTxs = buildApproveTxs({ market, asset, amount })
        const approveResults = await AllChainServices.postBaseSendTxs(
          toChainId(chainId), privateKey, approveTxs, false
        )
        const aHash = approveResults?.[0]
        if (!aHash) return fail(tr('txFailed', language))
        setApproveHash(aHash)

        // The deposit spends the allowance this tx grants, so it cannot be sent
        // until the approval is actually EFFECTIVE — and the only proof of that
        // is the allowance itself, read from the same pool the deposit will be
        // built against.
        //
        // A receipt is not that proof: it comes from one RPC (getRpcUrlByChain)
        // while the deposit reads through ViemWeb3's fallback pool, which may be
        // a block behind and still report the old allowance. Sending on that view
        // reverts, having already charged the user for the approval.
        //
        // So the wait is the allowance poll, not the receipt: it keeps re-reading
        // until the market can actually pull `amount`. It also settles as soon as
        // the node catches up — usually well before the receipt waiter's ceiling
        // would have returned.
        const allowanceReady = await waitForAllowance({
          chainId,
          owner: walletAddress,
          asset,
          market,
          amount
        })

        // Never confirmed within the window. Ask the receipt whether the approve
        // actually failed on-chain, so the user is told which of the two it was:
        // a reverted approval, or one that landed but is not visible yet.
        if (!allowanceReady) {
          const mined = await waitForReceipt(aHash, chainId, 15000).catch(() => false)
          return fail(tr(mined ? 'supplyApproveNotVisible' : 'supplyApproveFailed', language))
        }

        // Confirmed by an on-chain read — only now is the approve leg done.
        setStep(SUPPLY_STEP.APPROVED)
      }

      // ---- Leg 2: the deposit ----------------------------------------------
      // Spark's deposit takes a `minShares` floor; read it AFTER the approval so
      // the quote reflects the vault rate at the moment of the deposit.
      let minShares = 0n
      if (market?.type === 'spark') {
        const preview = await previewShares({ chainId, market, asset, amount })
        // 0.5% tolerance: absorbs ordinary rate drift between this read and the
        // tx landing, tight enough to still catch a real loss.
        minShares = preview === null ? 0n : (preview * 995n) / 1000n
      }

      setStep(SUPPLY_STEP.SUPPLYING)
      const supplyTxs = buildSupplyTxs({ market, asset, walletAddress, amount, minShares })
      const supplyResults = await AllChainServices.postBaseSendTxs(
        toChainId(chainId), privateKey, supplyTxs, false
      )
      const sHash = supplyResults?.[0]
      if (!sHash) return fail(tr('txFailed', language))
      setSupplyHash(sHash)

      const ok = await waitForReceipt(sHash, chainId)
      if (!ok) return fail(tr('txFailed', language))

      setStep(SUPPLY_STEP.DONE)
      runningRef.current = false
      // Everything this supply moved, re-read so the chat's balance-aware widgets
      // and the rest of the app reflect it. Delayed and targeted, matching how
      // useSendTx refreshes: the balance API needs a moment to catch up with a
      // just-mined tx.
      refreshSupplyBalances({
        walletAddress,
        chainId: toChainId(chainId),
        assetAddress: asset?.address,
        // `market.token` is the receipt token's CONTRACT (aBasUSDC, cUSDCv3,
        // sUSDC) — `market.receiptToken` alongside it carries only its display
        // symbol/decimals, no address.
        receiptAddress: market?.token,
        feeToken
      })
      onResult?.({ success: true, txHash: sHash })
    } catch (err) {
      fail(errText(err, tr('txFailed', language)))
    } finally {
      // Drop the borrowed key as soon as this run is over, success or failure. It
      // is a plaintext private key held only to save the user extra scans, so its
      // life ends with the flow that justified it — a retry scans again rather
      // than signing from something kept since the last attempt.
      lentKey = null
    }
  }, [market, asset, walletAddress, chainId, language, onResult, gate, nfcProxy])

  return { step, approveHash, supplyHash, error, execute, reset }
}
