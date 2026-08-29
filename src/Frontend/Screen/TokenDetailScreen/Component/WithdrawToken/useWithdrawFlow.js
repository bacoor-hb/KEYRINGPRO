import { useCallback, useRef, useState } from 'react'
import BigNumber from 'bignumber.js'
import I18n from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'
import { resolvePrivateKey } from 'frontend/Hooks/useSendTx'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { isNativeToken } from 'common/tokens'
import { zeroAddress } from 'viem'
import ViemWeb3, { TX_TRACK_CANCELLED, TX_TRACK_REVERTED } from 'src/Web3/ViemWeb3'
import { psm3For } from 'keyring-agent-core'
import { buildPsmApproveTx, buildPsmSwapTx, buildWithdrawTx, isVaultType, toUnits } from './buildWithdrawTx'
import { isOraclePricedType } from './abis'
import {
  checkTxFeeAffordable,
  psmMinAmountOut,
  readPsmSwapState,
  readSharesForAssetUnits,
  readWithdrawable,
  waitForPsmAllowance
} from './withdrawChecks'

// One tap, one transaction.
//
// A withdrawal is materially simpler than the supply it mirrors: the pool/vault
// burns the user's own receipt token, so there is no `approve` leg and no
// allowance to wait on. The whole sequence is:
//
//   re-read the position → build the call → sign → broadcast → wait for receipt
//
// That first step is not redundant. These positions accrue interest every block,
// so the balance the form was sized against is already stale by the time the
// user taps — and a FULL exit is encoded from the share balance itself, which
// must therefore be the current one. Re-reading here means "Max" always means
// max at the moment of signing, not max a minute ago.

export const WITHDRAW_STEP = {
  IDLE: 'IDLE',
  CHECKING: 'CHECKING',
  // Only the PSM3 exit reaches this: it is the one withdraw path whose contract
  // PULLS the user's token and therefore needs an allowance first. Its own step
  // so the timeline can say which of the two signatures is being asked for.
  APPROVING: 'APPROVING',
  WITHDRAWING: 'WITHDRAWING',
  DONE: 'DONE',
  ERROR: 'ERROR'
}

/** Steps in which something is in flight and the form must not be edited. */
export const isBusyStep = (step) =>
  step === WITHDRAW_STEP.CHECKING ||
  step === WITHDRAW_STEP.APPROVING ||
  step === WITHDRAW_STEP.WITHDRAWING

/** Thrown when a broadcast returns no hash — mapped to a user message by `execute`. */
const TX_SEND_FAILED = 'TX_SEND_FAILED'

// How long to keep polling for the withdrawal's receipt. Matches the send flow's
// ceiling: long enough for slow L1 blocks, short enough that a tx which never
// lands stops costing RPC calls.
const WITHDRAW_TX_TRACK_TIMEOUT = 180000

const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

const errText = (err, fallback) =>
  err?.shortMessage || err?.details || err?.message || (typeof err === 'string' ? err : '') || fallback

const isEvmAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim())

/**
 * Re-read every balance a completed withdrawal moved.
 *
 * Three tokens change, all on the withdrawal's own chain — unlike the supply
 * flow, there is no x402 fee leg here, so no second chain is ever involved:
 *
 *   - the NATIVE coin — gas, always
 *   - the RECEIPT token — burned, wholly or in part
 *   - the UNDERLYING — what arrived in its place
 *
 * Addresses are normalized on the way in so the Set actually dedupes: they come
 * from different sources (core's market metadata, the app's token list) and can
 * differ in casing, while the native coin has several spellings that
 * `refreshTokenBalances` folds onto one key. A single chain id is passed so
 * `refreshAccountTokens` takes its targeted RPC path (immediate, no indexer lag)
 * rather than the slow full refresh — which is exactly what a just-mined tx
 * needs.
 */
const refreshWithdrawBalances = ({ walletAddress, chainId, assetAddress, receiptAddress }) => {
  const targetChainId = Number(chainId)
  if (!walletAddress || !Number.isFinite(targetChainId)) return

  const addresses = new Set([zeroAddress])
  const add = (address) => {
    if (!isEvmAddress(address)) return
    addresses.add(
      isNativeToken(address, targetChainId) ? zeroAddress : String(address).trim().toLowerCase()
    )
  }
  add(assetAddress)
  add(receiptAddress)

  // Delayed for the same reason useSendTx delays its own refresh: the balance
  // pipeline needs a moment to catch up with a tx that only just mined.
  setTimeout(() => {
    refreshAccountTokens(walletAddress, {
      chainIds: [targetChainId],
      tokenAddress: [...addresses]
    })
  }, 2000)
}

/**
 * Drives the withdrawal and exposes the state the drawer renders.
 *
 * @param {object} market         Resolved market: `{ type, contract, receiptToken, asset }`.
 * @param {object} asset          Underlying: `{ address, decimals, symbol }`.
 * @param {string} walletAddress  Signer, and the receiver of the underlying.
 * @param {string|number} chainId Chain to broadcast on.
 * @param {Function} [onResult]   Called once, when the withdrawal settles.
 * @param {object} [nfcProxy]     BaseContainer's `nfcProxy`, forwarded by the hosting
 *   screen. Required to withdraw from a COLD (NFC keycard) account, whose key lives
 *   on the card and has to be scanned at signing time; hot accounts ignore it.
 * @param {Function} [isCancelled] Polled between receipt attempts — returns true once
 *   the drawer is gone, so the tracker stops instead of polling for its whole timeout.
 */
export default function useWithdrawFlow ({
  market,
  asset,
  walletAddress,
  chainId,
  onResult,
  nfcProxy,
  isCancelled
}) {
  const [step, setStep] = useState(WITHDRAW_STEP.IDLE)
  const [hash, setHash] = useState(null)
  const [error, setError] = useState(null)

  // Guards a double-tap: the button is disabled while busy, but a fast second
  // press can land before React re-renders with the new step.
  const runningRef = useRef(false)

  const reset = useCallback(() => {
    setStep(WITHDRAW_STEP.IDLE)
    setHash(null)
    setError(null)
    runningRef.current = false
  }, [])

  /**
   * Broadcast one transaction and wait for it to settle. Returns the hash.
   *
   * Factored out because the PSM exit sends TWO transactions in sequence and both
   * must be individually confirmed — `postBaseSendTxs` maps its array through
   * `Promise.all`, so passing both at once would sign them in parallel, collide
   * on a single nonce, and land the swap before the approval it depends on.
   *
   * `gasLimit` is the buffered limit `checkTxFeeAffordable` measured for THIS
   * leg, so the fee that was budgeted and the fee that is charged are one
   * number. `postBaseSendTxs` still takes the higher of it and its own estimate,
   * so passing it can only raise the floor — and a 0 (nothing measurable) simply
   * leaves the broadcast's own estimate in charge, exactly as before.
   */
  const sendAndTrack = useCallback(async (privateKey, tx, { publishHash = true, gasLimit = 0 } = {}) => {
    const txToSend = gasLimit > 0 ? { ...tx, gasLimit } : tx
    const results = await AllChainServices.postBaseSendTxs(
      toChainId(chainId), privateKey, [txToSend], false
    )
    const txHash = results?.[0]
    if (!txHash) throw new Error(TX_SEND_FAILED)
    // The APPROVE leg passes false. Its hash is real but it is not the
    // withdrawal, and surfacing it would put a hash on screen that is then
    // replaced by the swap's a moment later — the user sees one identifier
    // silently become another, and an explorer link they opened points at a
    // transaction that moved nothing. The approval simply reads as "pending"
    // until the swap it enables produces the hash worth showing.
    if (publishHash) setHash(txHash)
    await ViemWeb3.trackingTx(
      toChainId(chainId), txHash, WITHDRAW_TX_TRACK_TIMEOUT, () => !!isCancelled?.()
    )
    return txHash
  }, [chainId, isCancelled])

  /**
   * Exit a cross-chain sUSDS position through PSM3.
   *
   * Structurally different from every other family, in three ways that each
   * matter for correctness:
   *
   *   1. **Unit.** `swapExactIn` consumes sUSDS SHARES, while the user typed an
   *      amount of USDS. The conversion runs here, against a rate read moments
   *      ago, and is capped at the live share balance — rounding plus the rate's
   *      per-second tick can otherwise put a "maximum" request a few wei over the
   *      balance, which reverts.
   *   2. **Liquidity.** PSM3 reverts when it cannot cover the payout, so its
   *      balance of the outgoing asset is a hard ceiling. Checked BEFORE signing,
   *      so the user is told rather than paying gas to discover it.
   *   3. **Approval.** PSM3 pulls the sUSDS, so it needs an allowance — the only
   *      withdraw path in this app that does. Skipped when one already covers the
   *      amount, so a repeat exit costs one transaction instead of two.
   */
  const executePsmExit = useCallback(async ({
    amount, isWithdrawAll, shares, assets, privateKey, fail
  }) => {
    const psm = psm3For(chainId)
    const shareToken = market?.receiptToken
    const assetOut = asset?.address
    if (!psm || !shareToken || !assetOut) {
      return fail(I18n.t('v2.withdrawToken.marketUnavailable'))
    }
    if (typeof shares !== 'bigint' || shares <= 0n) {
      return fail(I18n.t('v2.withdrawToken.nothingToWithdraw'))
    }

    const assetDecimals = asset?.decimals
    if (!Number.isInteger(assetDecimals)) {
      return fail(I18n.t('v2.withdrawToken.marketUnavailable'))
    }

    // A full exit swaps the entire share balance — the stored unit, which does
    // not drift with the rate, so the position empties exactly and leaves no
    // dust. A partial exit converts the typed underlying amount into shares.
    let amountIn = shares
    if (!isWithdrawAll) {
      amountIn = await readSharesForAssetUnits({
        chainId: toChainId(chainId),
        // `market.contract` is the SSR oracle for this family, not a vault.
        oracle: market.contract,
        shareToken,
        assetUnits: toUnits(amount, assetDecimals),
        assetDecimals,
        capShares: shares
      })
      if (amountIn === null) return fail(I18n.t('Initial.connectErr'))
    }

    const { amountOut, liquidity, allowance } = await readPsmSwapState({
      chainId: toChainId(chainId),
      psm,
      shareToken,
      assetOut,
      shares: amountIn,
      owner: walletAddress
    })

    // No quote → no floor → nothing safe to sign. Never fall back to an
    // unprotected swap.
    if (amountOut === null || amountOut <= 0n) return fail(I18n.t('Initial.connectErr'))

    // The pool cannot pay this out; `swapExactIn` would revert after the user had
    // signed and paid gas. Its own message, because the fix is different from
    // "you asked for more than you have".
    if (liquidity !== null && amountOut > liquidity) {
      return fail(I18n.t('v2.withdrawToken.psmInsufficientLiquidity'))
    }

    const minAmountOut = psmMinAmountOut(amountOut)
    if (minAmountOut === null) return fail(I18n.t('Initial.connectErr'))

    // Approve only when the standing allowance is short. Exact-amount approval,
    // never unlimited — the same rule the supply side follows.
    if (allowance === null || allowance < amountIn) {
      const approveTx = buildPsmApproveTx({ psm, shareToken, shares: amountIn })

      // The approve's OWN fee, measured. The swap is not budgeted in here: it
      // gets its own check further down, once it can actually be simulated.
      // The limit it measured is kept and signed with, so this leg is charged
      // against the same number it was cleared against.
      let approveGasLimit = 0
      const approveFeeError = await checkTxFeeAffordable({
        chainId,
        from: walletAddress,
        tx: approveTx,
        onGasLimit: (limit) => { approveGasLimit = limit }
      })
      if (approveFeeError) return fail(approveFeeError)

      setStep(WITHDRAW_STEP.APPROVING)
      await sendAndTrack(privateKey, approveTx, { publishHash: false, gasLimit: approveGasLimit })

      // The receipt is NOT enough to send the swap on. It came from one RPC,
      // while the swap is estimated and broadcast against ViemWeb3's fallback
      // pool — a node there can still be reporting the pre-approval allowance,
      // and `swapExactIn` on that view reverts after the user has already paid
      // for the approval. So keep reading `allowance` until the PSM can actually
      // pull the shares. It settles as soon as the node catches up, so the usual
      // cost is a tick or two rather than a fixed delay.
      const allowanceReady = await waitForPsmAllowance({
        chainId: toChainId(chainId),
        shareToken,
        owner: walletAddress,
        psm,
        shares: amountIn,
        isCancelled
      })

      // Never became visible within the window. Stop here rather than sign a
      // swap that would revert — the approval itself is on-chain and still
      // stands, so a retry in a moment skips straight to the swap.
      if (!allowanceReady) {
        if (isCancelled?.()) {
          runningRef.current = false
          return
        }
        return fail(I18n.t('v2.withdrawToken.approveNotVisible'))
      }
    }

    const swapTx = buildPsmSwapTx({
      psm, shareToken, assetOut, shares: amountIn, minAmountOut, walletAddress
    })

    // The swap's own fee, checked here and not a moment earlier. This is the
    // first point at which it can be measured at all: `swapExactIn` pulls the
    // shares, so before the approval above landed an estimate would simply
    // revert. And it is measured against the balance that is ACTUALLY left,
    // which the approve may have just spent from.
    //
    // Reaching this short of gas is the case the user must be told about
    // plainly — the allowance is already bought and paid for, so a retry after
    // topping up skips the approve and costs one transaction, not two.
    let swapGasLimit = 0
    const swapFeeError = await checkTxFeeAffordable({
      chainId,
      from: walletAddress,
      tx: swapTx,
      onGasLimit: (limit) => { swapGasLimit = limit }
    })
    if (swapFeeError) return fail(swapFeeError)

    setStep(WITHDRAW_STEP.WITHDRAWING)
    const txHash = await sendAndTrack(privateKey, swapTx, { gasLimit: swapGasLimit })

    setStep(WITHDRAW_STEP.DONE)
    runningRef.current = false
    refreshWithdrawBalances({
      walletAddress,
      chainId: toChainId(chainId),
      assetAddress: assetOut,
      receiptAddress: shareToken
    })
    onResult?.({ success: true, txHash })
  }, [market, asset, walletAddress, chainId, onResult, sendAndTrack, isCancelled])

  /**
   * @param {string} amount        Human amount of the underlying to take out.
   * @param {boolean} isWithdrawAll Exit the whole position — encoded from the
   *   live share balance / the protocol's "all" sentinel rather than `amount`.
   */
  const execute = useCallback(async (amount, isWithdrawAll = false) => {
    if (runningRef.current) return
    runningRef.current = true

    // A retry starts from a clean slate — a previous attempt's hash and error
    // must not linger under the new run.
    setHash(null)
    setError(null)

    const fail = (message) => {
      setError(message)
      setStep(WITHDRAW_STEP.ERROR)
      runningRef.current = false
      onResult?.({ success: false, error: message })
    }

    try {
      setStep(WITHDRAW_STEP.CHECKING)

      if (!market?.contract || !market?.type) {
        return fail(I18n.t('v2.withdrawToken.marketUnavailable'))
      }

      // The position as it stands RIGHT NOW. Interest accrues per block, so the
      // figure the form was sized against is already stale — and a full exit is
      // encoded from the share balance, which must be current or the redeem
      // reverts (asking for more shares than are held) or leaves dust behind.
      const { shares, assets } = await readWithdrawable({
        chainId,
        market,
        owner: walletAddress
      })

      if (assets === null) return fail(I18n.t('Initial.connectErr'))
      if (assets === 0n) return fail(I18n.t('v2.withdrawToken.nothingToWithdraw'))

      const decimals = asset?.decimals ?? 18
      const requested = BigNumber(amount || 0)
      if (!requested.isFinite() || requested.lte(0)) {
        return fail(I18n.t('v2.withdrawToken.invalidAmount'))
      }

      // Guard the partial path against a balance that shrank between sizing and
      // signing (a concurrent withdrawal from another device, a vault losing
      // liquidity). A full exit is exempt: it does not carry an amount at all.
      if (!isWithdrawAll) {
        const available = BigNumber(assets.toString()).div(BigNumber(10).pow(decimals))
        if (requested.gt(available)) {
          return fail(I18n.t('v2.withdrawToken.insufficientBalance'))
        }
      }

      // A full vault exit redeems the exact share balance, so it cannot proceed
      // without one — falling back to an amount-based withdraw here would
      // reintroduce the dust this path exists to avoid.
      if (isWithdrawAll && isVaultType(market.type) && (shares === null || shares === 0n)) {
        return fail(I18n.t('Initial.connectErr'))
      }

      // Cross-chain sUSDS exits through a PSM3 swap, not a vault call — a
      // different contract, a different unit, and an approval leg the other
      // families do not have. Its own fee checks live inside `executePsmExit`,
      // per leg, because the second one has to be made against the balance the
      // first leg leaves behind.
      const isPsmExit = isOraclePricedType(market.type)

      // Built BEFORE the key is resolved so the fee check below can run first.
      // On a cold (NFC keycard) account resolving the key means asking for a
      // card scan — making the user scan and only THEN telling them the wallet
      // cannot pay the gas is a scan spent on an answer we already had.
      // The PSM path cannot do this: its transaction is sized from reads that
      // `executePsmExit` performs itself.
      const tx = isPsmExit
        ? null
        : buildWithdrawTx({
          market,
          asset,
          walletAddress,
          amount,
          isWithdrawAll,
          shareBalance: shares ?? 0n
        })

      // The withdrawal is paid for in the chain's NATIVE coin, which the form
      // never asked about — a wallet holding only the lending position has a
      // full balance, a valid amount, and no way to pay. Without this it would
      // sign, broadcast, and come back with a bare RPC rejection that says
      // nothing about gas.
      //
      // The limit it measures is kept and signed with below, so the fee this
      // check cleared and the fee the node charges are the same number — and the
      // withdrawal is not estimated a second time at broadcast.
      let withdrawGasLimit = 0
      if (tx) {
        const feeError = await checkTxFeeAffordable({
          chainId,
          from: walletAddress,
          tx,
          onGasLimit: (limit) => { withdrawGasLimit = limit }
        })
        if (feeError) return fail(feeError)
      }

      // Hot account → secure storage; cold (NFC keycard) account → a card scan.
      // `resolvePrivateKey` (shared with useSendTx) rather than a direct storage
      // read: a cold account keeps an EMPTY key on the device, so reading storage
      // returns '' and the withdrawal would die as a generic "transaction failed"
      // with no hint that the card was the missing piece.
      const privateKey = await resolvePrivateKey(walletAddress, nfcProxy)
      if (!privateKey) return fail(I18n.t('GlobalError.somethingWrongErr'))

      if (isPsmExit) {
        return await executePsmExit({
          amount,
          isWithdrawAll,
          shares,
          assets,
          privateKey,
          fail
        })
      }

      setStep(WITHDRAW_STEP.WITHDRAWING)
      // Signed with the buffered limit the fee check measured. A lending
      // withdrawal is exactly what that headroom is for: these markets accrue
      // interest every block, so a tx mined in between can push a storage slot
      // from zero to non-zero and the bare estimate reverts out of gas.
      // `postBaseSendTxs` still floors this at its own estimate, so a 0 (nothing
      // measurable) is never signed as a zero limit.
      const results = await AllChainServices.postBaseSendTxs(
        toChainId(chainId),
        privateKey,
        [withdrawGasLimit > 0 ? { ...tx, gasLimit: withdrawGasLimit } : tx],
        false
      )
      const txHash = results?.[0]
      if (!txHash) return fail(I18n.t('v2.sendToken.txFailed'))
      setHash(txHash)

      // trackingTx uses the ordered RPC list (paid linkProvider first) via
      // ViemWeb3.getPublicClient, so it works for ANY chain in Redux metadata —
      // including custom networks — and, unlike viem's waitForTransactionReceipt,
      // it can be cancelled the moment the drawer closes.
      await ViemWeb3.trackingTx(
        toChainId(chainId), txHash, WITHDRAW_TX_TRACK_TIMEOUT, () => !!isCancelled?.()
      )

      setStep(WITHDRAW_STEP.DONE)
      runningRef.current = false
      refreshWithdrawBalances({
        walletAddress,
        chainId: toChainId(chainId),
        assetAddress: asset?.address,
        receiptAddress: market?.receiptToken
      })
      onResult?.({ success: true, txHash })
    } catch (err) {
      // The drawer is gone — nothing left to report to, and setting state would
      // only push it into an unmounted tree.
      if (err?.message === TX_TRACK_CANCELLED) {
        runningRef.current = false
        return
      }
      // A revert is a genuine on-chain failure. Anything else (timeout, no RPC
      // reachable) means we could NOT confirm — say so rather than claim the
      // withdrawal went through. Either way the hash stays on screen, so the
      // user can still open the explorer and see what became of it.
      if (err?.message === TX_TRACK_REVERTED || err?.message === TX_SEND_FAILED) {
        return fail(I18n.t('v2.sendToken.txFailed'))
      }
      fail(errText(err, I18n.t('GlobalError.somethingWrongErr')))
    }
  }, [market, asset, walletAddress, chainId, onResult, nfcProxy, isCancelled, executePsmExit])

  return { step, hash, error, execute, reset }
}
