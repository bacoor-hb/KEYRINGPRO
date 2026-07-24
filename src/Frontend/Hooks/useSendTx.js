import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { getPrivateKeyByAddress } from 'common/wallet'
import { getRpcUrlByChain, convertBalanceToWei, convertWeiToBalance } from 'common/function'
import { getNativeTokenSymbolByChain } from 'common/chain'
import I18n, { resolveLocale } from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'

// Single source of truth for the tx lifecycle so every screen renders the same
// states: idle → signing → confirming → done | error.
export const TX_STATUS = {
  IDLE: 'idle',
  SIGNING: 'signing',
  CONFIRMING: 'confirming',
  DONE: 'done',
  ERROR: 'error'
}

// Same 10% headroom the Send Token screen adds on top of the raw estimate, so a
// gas price that ticks up between the check and the broadcast doesn't turn an
// "affordable" tx into an out-of-gas failure.
const FEE_BUFFER = 1.1

/**
 * Pre-flight a transaction before signing it — catching, for free, two failures
 * the user would otherwise only discover after paying for them:
 *
 *  1. **It would revert.** `eth_estimateGas` executes the call against current
 *     state, so sending an NFT you no longer own, or more tokens than you hold,
 *     fails here instead of on-chain.
 *  2. **The fee isn't covered.** gasLimit × gasPrice is the fee; for a native
 *     send the value being sent draws on the same balance, so both are weighed
 *     together.
 *
 * Returns null when the tx is good to sign, or a ready-to-show error string.
 * Deliberately permissive about its OWN failures: when the chain can't be read
 * at all we let the tx through rather than block a user who could actually send
 * it — the broadcast path has its own error handling.
 */
const preflightTx = async ({ chainId, from, txs, language }) => {
  const t = (key, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })

  const tx = txs?.[0]
  if (!tx) return t('walletActionEstimateFailed')

  // Value must be wei for the estimate, matching what postBaseSendTxs signs.
  // `value` is a decimal amount; `valueNoConvert` is already wei.
  const valueWei = tx.valueNoConvert
    ? String(tx.valueNoConvert)
    : tx.value
      ? convertBalanceToWei(String(tx.value))
      : '0'

  const rawTx = { to: tx.to, from, data: tx.data || '0x' }
  // Only attach a value when there is one — some nodes reject `value: '0'` on a
  // contract call that isn't payable.
  if (valueWei !== '0') rawTx.value = valueWei

  // NOTE: estimateGasTxs resolves to 0 on failure — it swallows the revert
  // reason AND every RPC fallback — so 0 means "would revert" or "no RPC
  // reachable" and we can't tell which. Hence the non-committal wording.
  const gasLimit = await AllChainServices.estimateGasTxs(chainId, rawTx)
  if (!gasLimit || BigNumber(gasLimit).lte(0)) return t('walletActionEstimateFailed')

  const gasPrice = await AllChainServices.getGasPrice(chainId)
  // Without a gas price the fee comparison is meaningless (a 0 fee is always
  // "affordable"), so skip it. The estimate above already proved it executes.
  if (!gasPrice || BigNumber(gasPrice).lte(0)) return null

  // TODO: REMOVE BEFORE MERGE — forces the "not enough for the fee" branch by
  // demanding a flat 1 ETH, so the error UI can be exercised on a funded wallet.
  // Restore the real calculation below.
  const requiredWei = BigNumber(gasPrice)
    .multipliedBy(gasLimit)
    .multipliedBy(FEE_BUFFER)
    .plus(valueWei)

  // Raw wei (isFormatBalance = false) so the comparison stays in integer wei.
  const balanceWei = BigNumber(await AllChainServices.getBalanceByChain(chainId, from, false))
  // An unreadable balance also resolves to 0, which would look like "no funds"
  // and wrongly block someone who can pay. Only a balance we actually read is
  // allowed to fail the check.
  if (!balanceWei.isFinite() || balanceWei.lte(0)) return null
  if (balanceWei.gte(requiredWei)) return null

  const missing = convertWeiToBalance(requiredWei.minus(balanceWei).toFixed(0))
  const amount = BigNumber(missing).decimalPlaces(6, BigNumber.ROUND_UP).toFixed()
  // The agent hands us a HEX chain id ("0xa"), but the chain catalog is keyed by
  // the decimal number — look it up as a number or the symbol comes back empty.
  const symbol = getNativeTokenSymbolByChain(Number(chainId))
  // Drop to a symbol-less phrasing rather than leave a gap in the sentence when
  // the chain isn't in the catalog (custom network, catalog not loaded yet).
  return symbol
    ? t('walletActionNotEnoughFee', { amount, symbol })
    : t('walletActionNotEnoughFeeNoSymbol', { amount })
}

// Wait for the on-chain receipt so we know the tx actually executed (didn't
// revert) — a returned hash only means it was broadcast. Returns true on
// success, false on revert. With no RPC to verify against we treat the
// broadcast itself as success.
const waitForTxSuccess = async (hash, chainId) => {
  const rpcUrl = getRpcUrlByChain(chainId)
  if (!rpcUrl) return true

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  // confirmations = 1, timeout = 3 minutes (rejects on timeout → handled as error)
  const receipt = await provider.waitForTransaction(hash, 1, 180000)
  return receipt?.status === 1
}

/**
 * Drives the full sign → broadcast → confirm lifecycle for one or more EVM txs
 * and exposes a single `status`/`txHash` pair, so any screen can plug the same
 * status timeline on top of its own confirmation form.
 *
 * @param {string} from            Signer address (private key is resolved from it)
 * @param {number|string} chainId  Chain to broadcast on
 * @param {Array|Function} buildTxs  The unsigned tx object(s), or a function returning them
 * @param {Function} onResult      Called with { success, txHash, error } when settled
 * @param {string} fallbackError   Message used when the chain returns no/failed result
 * @param {string} initialStatus   Persisted status to rehydrate on mount (default IDLE)
 * @param {string} initialTxHash   Persisted tx hash to rehydrate on mount
 * @param {boolean} preflight      Simulate + fee-check before signing (default off,
 *                                 so existing callers are unchanged)
 * @param {Function} preCheck      Optional caller-specific check run BEFORE the
 *                                 generic pre-flight. Resolves to an error string
 *                                 to abort, or null/undefined to continue. Lets a
 *                                 caller ask the one question it knows matters
 *                                 (own this NFT? hold this token?) and report a
 *                                 specific reason, which the gas estimate cannot.
 * @param {string} language        Locale for the pre-flight error strings
 */
export default function useSendTx ({ from, chainId, buildTxs, onResult, fallbackError, initialStatus, initialTxHash, preflight = false, preCheck, language } = {}) {
  // Seed from any persisted state so a remount (e.g. leaving and returning to
  // the chat) restores the same status/timeline instead of resetting to IDLE.
  const [status, setStatus] = useState(initialStatus || TX_STATUS.IDLE)
  const [txHash, setTxHash] = useState(initialTxHash || null)
  // True only when the terminal state (done/error) is reached LIVE during this
  // mount — i.e. we watched the tx settle. It stays false when the terminal
  // state was rehydrated from history (back out → back in), so the consumer can
  // show the result statically instead of replaying the success/fail animation.
  const [settledLive, setSettledLive] = useState(false)

  // True when this mount rehydrated a non-IDLE status from history (back out →
  // back in) rather than starting a fresh live flow. In that case the WHOLE
  // timeline — including the Sending/Waiting intro markers — should render
  // statically, since none of it is happening live. Captured once at mount.
  const [restoredFromHistory] = useState(() => !!initialStatus && initialStatus !== TX_STATUS.IDLE)

  // Why the flow failed, when we have something more specific than the generic
  // "transaction failed" — notably the pre-flight's "would revert" / "not enough
  // for the fee". Consumers can show this in place of the default copy.
  const [error, setError] = useState(null)

  const confirm = useCallback(async () => {
    // Guard against double taps while a broadcast/confirmation is in flight.
    if (status === TX_STATUS.SIGNING || status === TX_STATUS.CONFIRMING) return
    setStatus(TX_STATUS.SIGNING)
    setTxHash(null)
    setError(null)

    let hash = null
    try {
      const txs = typeof buildTxs === 'function' ? buildTxs() : buildTxs

      // The caller's own first check runs ahead of the generic pre-flight: it
      // asks a narrower question (does this wallet hold the token / own the
      // NFT?) and so can name the actual problem, where a failed gas estimate
      // can only say "this can't be completed".
      if (preCheck) {
        const preErr = await preCheck()
        if (preErr) throw new Error(preErr)
      }

      // Simulate + fee-check before touching the key, silently inside SIGNING —
      // the user just sees "Sending" while it runs. A failure throws, so it
      // surfaces through the normal error path (timeline + Retry) having cost
      // nothing: no signature, no broadcast, no gas.
      if (preflight) {
        const err = await preflightTx({ chainId, from, txs, language })
        if (err) throw new Error(err)
      }

      const privateKey = getPrivateKeyByAddress(from)
      if (!privateKey) throw new Error('Private key not found for ' + from)

      // Step 1 — broadcast (isWaitDone = false): resolves with the hash as soon
      // as the tx is accepted, so the user can see/track it while it's pending.
      const results = await AllChainServices.postBaseSendTxs(chainId, privateKey, txs, false)
      hash = results?.[0]
      if (!hash) throw new Error(fallbackError)

      setTxHash(hash)
      setStatus(TX_STATUS.CONFIRMING)

      // Step 2 — wait for the receipt to confirm it didn't revert.
      const ok = await waitForTxSuccess(hash, chainId)
      if (!ok) throw new Error(fallbackError)

      setSettledLive(true)
      setStatus(TX_STATUS.DONE)
      onResult?.({ success: true, txHash: hash })
    } catch (err) {
      setSettledLive(true)
      setStatus(TX_STATUS.ERROR)
      setError(err?.message || fallbackError)
      onResult?.({ success: false, error: err?.message || fallbackError, txHash: hash })
    }
  }, [status, from, chainId, buildTxs, onResult, fallbackError, preflight, preCheck, language])

  // Rehydrated mid-confirmation (the user left while the tx was broadcast but
  // not yet confirmed): the broadcast already happened, so don't re-send — just
  // resume waiting for the receipt so the timeline settles to done/error.
  useEffect(() => {
    if (initialStatus !== TX_STATUS.CONFIRMING || !initialTxHash) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await waitForTxSuccess(initialTxHash, chainId)
        if (cancelled) return
        if (!ok) throw new Error(fallbackError)
        setSettledLive(true)
        setStatus(TX_STATUS.DONE)
        onResult?.({ success: true, txHash: initialTxHash })
      } catch (err) {
        if (cancelled) return
        setSettledLive(true)
        setStatus(TX_STATUS.ERROR)
        onResult?.({ success: false, error: err?.message || fallbackError, txHash: initialTxHash })
      }
    })()
    return () => { cancelled = true }
    // Run once on mount for the persisted hash; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    status,
    txHash,
    confirm,
    // Whether the terminal state was reached live this mount (→ animate the
    // success/fail result) vs rehydrated from history (→ show it statically).
    settledLive,
    // Whether the whole flow was restored from history — drives the static vs
    // animated intro markers (Sending / Waiting).
    restoredFromHistory,
    // The specific failure reason when there is one (pre-flight revert / fee
    // shortfall), for consumers that want it instead of the generic copy.
    error,
    isIdle: status === TX_STATUS.IDLE,
    isProcessing: status === TX_STATUS.SIGNING || status === TX_STATUS.CONFIRMING
  }
}
