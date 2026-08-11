import { useState, useCallback, useEffect } from 'react'
import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { getPrivateKeyByAddress, isAccountFromKeyCard, remove0xFromPrivateKey } from 'common/wallet'
import { getRpcUrlByChain, convertBalanceToWei, convertWeiToBalance, sleep, formatWeb3Error } from 'common/function'
import { getNativeTokenSymbolByChain } from 'common/chain'
import { isNativeToken } from 'common/tokens'
import I18n, { resolveLocale } from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { zeroAddress } from 'viem'

// Single source of truth for the tx lifecycle so every screen renders the same
// states: idle → gating → signing → confirming → done | error.
//
// GATING covers everything that runs BEFORE the tx is signed — the caller's
// preCheck, the gas/fee pre-flight and the `gate` (the x402-paid backend
// authorization). It is a separate state, and not just an early part of
// SIGNING, because the gate can require the user to act (approving an x402
// payment): showing "Sending…" behind that sheet claims the transaction is on
// its way while it is still waiting on a decision that may yet abort it. The
// send status must only appear once the tx is actually being signed.
export const TX_STATUS = {
  IDLE: 'idle',
  GATING: 'gating',
  SIGNING: 'signing',
  CONFIRMING: 'confirming',
  DONE: 'done',
  ERROR: 'error'
}

// Same 10% headroom the Send Token screen adds on top of the raw estimate, so a
// gas price that ticks up between the check and the broadcast doesn't turn an
// "affordable" tx into an out-of-gas failure.
const FEE_BUFFER = 1.1

const isEvmAddress = (value) => /^0x[0-9a-fA-F]{40}$/.test(String(value || '').trim())

// After a successful send, re-read the sender's token balances so every
// balance-aware view (chat widgets, token list, HomeScreen totals — all of which
// read accountTokenListRedux reactively) reflects what just moved. Mirrors the
// Send Token screen's post-success refresh. The small delay lets the
// just-broadcast tx propagate before we re-read.
//
// Always the TARGETED path — every target is read directly over RPC (immediate,
// no Moralis indexing lag), which is the whole point right after a mined tx.
//
// The NATIVE coin is always refreshed on the TX CHAIN, since it paid the gas
// whatever was sent: a native send targets `[native]` and an ERC-20 send
// `[native, token]`. A fee charged on ANOTHER chain gets `[feeToken]` alone —
// x402 settles as a signed transfer authorization broadcast and paid for by the
// facilitator, so no native moves on that chain and reading it would be a wasted
// slot.
//
// `tokenAddress` accepts MULTIPLE addresses for a send that moves more than one
// token — a liquidity position moves two, and a targeted refresh only covers what
// it is handed, so such a caller must pass them all.
//
// `feeToken` is the token an x402 gate settled its charge in, and it is refreshed
// SEPARATELY because it is not derivable from the send: the backend prices its
// call in its own token on its own chain, so a tx on Optimism can be paid for in
// USDC on Base. Neither the tx chain's refresh nor its token list covers that, so
// without this the fee token is the one balance left stale.
//
// One call PER CHAIN, never a combined one: refreshAccountTokens only takes the
// targeted RPC path when given exactly one chain id, so merging chains would
// silently downgrade to the slow full refresh — the opposite of what a just-mined
// tx needs.
const refreshBalances = (from, chainId, tokenAddress, feeToken) => {
  const txChainId = Number(chainId)
  if (!from || !Number.isFinite(txChainId)) return

  // chainId → tokens to re-read on it. The TX CHAIN is seeded with the native
  // coin, which it always spent on gas. A fee chain is not: x402 settles as a
  // signed transfer authorization that the facilitator broadcasts and pays for,
  // so nothing native moves there and only the fee token itself changed.
  const byChain = new Map()
  const add = (targetChainId, address, seedNative = false) => {
    const key = Number(targetChainId)
    if (!Number.isFinite(key)) return
    if (!byChain.has(key)) byChain.set(key, new Set(seedNative ? [zeroAddress] : []))
    if (!isEvmAddress(address)) return
    // Normalized before it lands in the Set, since the sent token comes from the
    // agent's payload and the fee token from the x402 challenge: the same
    // contract can arrive checksummed from one and lowercase from the other, and
    // the native coin has several spellings (zero address, `0xeee…`, a per-chain
    // token address) that `refreshTokenBalances` folds onto one key anyway — so
    // either difference would mean reading the same balance twice.
    byChain.get(key).add(isNativeToken(address, key) ? zeroAddress : String(address).trim().toLowerCase())
  }

  // The tx chain always gets an entry, even for a native send with no token to
  // name — its seeded native is exactly what that send moved.
  add(txChainId, null, true)
  ;(Array.isArray(tokenAddress) ? tokenAddress : [tokenAddress]).forEach((addr) => add(txChainId, addr, true))
  // The fee's own chain. When that IS the tx chain the entry already exists (and
  // already holds its native); when it is not, the new entry gets the fee token
  // alone — see above for why no native.
  if (feeToken) add(feeToken.chainId, feeToken.assetAddress)

  setTimeout(() => {
    byChain.forEach((addresses, targetChainId) => {
      refreshAccountTokens(from, { chainIds: [targetChainId], tokenAddress: [...addresses] })
    })
  }, 1500)
}

/**
 * Resolve the signing key for `address`, mirroring the Send Token screen
 * (TokenDetailScreen.handleSubmitSend).
 *
 * A COLD account's key is never on the device — `importPrivateKey` stores an
 * empty string for it (see generateEvmAccountFromPrivateKeyEvm), so
 * `getPrivateKeyByAddress` would come back blank and the send would die with a
 * misleading "Private key not found". The key has to be read off the NFC card,
 * which needs a BaseContainer for the scan sheet + alerts — hence `nfcProxy`,
 * handed down from the screen. Without one we can't scan, so a keycard account
 * is reported as unsupported rather than silently failing on a blank key.
 *
 * @param {string} address   the sending account
 * @param {object} nfcProxy  BaseContainer's nfcProxy (`screenRef.nfcProxy`)
 * @returns {Promise<string>} the private key WITHOUT the 0x prefix
 */
export const resolvePrivateKey = async (address, nfcProxy) => {
  if (isAccountFromKeyCard(address)) {
    if (!nfcProxy) throw new Error(I18n.t('NFC.cardCannotBeOperated'))
    // Prompts the scan, decrypts with the stored passwordFile and checks the
    // card's address matches this account; returns '' on cancel/mismatch and
    // has already shown its own alert in that case.
    const key = await nfcProxy.getPrivateKeyFromNFC(address)
    if (!key) throw new Error(I18n.t('GlobalError.somethingWrongErr'))
    await sleep(500)
    return remove0xFromPrivateKey(key)
  }

  const key = getPrivateKeyByAddress(address)
  if (!key) throw new Error('Private key not found for ' + address)
  return remove0xFromPrivateKey(key)
}

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
const waitForTxSuccess = async (hash, chainId, timeout = 180000) => {
  const rpcUrl = getRpcUrlByChain(chainId)
  if (!rpcUrl) return true

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
  // confirmations = 1, timeout = 3 minutes (rejects on timeout → handled as error)
  const receipt = await provider.waitForTransaction(hash, 1, timeout)
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
 * @param {string} initialError    Persisted failure reason to rehydrate on mount.
 *                                 Without it a restored ERROR keeps its status but
 *                                 loses WHY, and the consumer falls back to the
 *                                 generic "the transaction failed" — throwing away
 *                                 the specific reason (a fee shortfall naming the
 *                                 amount, a declined payment) precisely when the
 *                                 user came back to read it.
 * @param {boolean} preflight      Simulate + fee-check before signing (default off,
 *                                 so existing callers are unchanged)
 * @param {Function} preCheck      Optional caller-specific check run BEFORE the
 *                                 generic pre-flight. Resolves to an error string
 *                                 to abort, or null/undefined to continue. Lets a
 *                                 caller ask the one question it knows matters
 *                                 (own this NFT? hold this token?) and report a
 *                                 specific reason, which the gas estimate cannot.
 * @param {Function} gate          Optional final approval step, run AFTER preCheck
 *                                 and the pre-flight and BEFORE the key is read.
 *                                 Called with `{ txs, verify, lendKey, noteFeeToken }`:
 *                                 `txs` is the tx about to be signed, `verify`
 *                                 re-runs the pre-flight (see below), `lendKey` lets
 *                                 the gate hand back a key it already resolved (see
 *                                 below) and `noteFeeToken` reports which token the
 *                                 gate charged (see below). Resolves to an error
 *                                 string to abort, or null to broadcast. Used for the
 *                                 x402-paid backend authorization, which must only be
 *                                 paid for a tx already proven sendable.
 *
 *                                 `noteFeeToken({ chainId, assetAddress })` is how the
 *                                 post-success refresh learns which balance the fee
 *                                 came out of. It cannot be inferred from the send:
 *                                 the backend prices its call in its own token on its
 *                                 own chain, so a tx on Optimism can be paid for in
 *                                 USDC on Base — a token, and a chain, that nothing
 *                                 else in this flow would refresh. A gate that never
 *                                 calls it (free route) just leaves the refresh
 *                                 covering the tx chain alone, as before.
 *
 *                                 `lendKey` spares a COLD (NFC keycard) account a
 *                                 SECOND card scan. A paid gate signs the x402
 *                                 payment with the same account that then signs the
 *                                 tx, so both need the same key off the same card —
 *                                 two taps for what the user experiences as one
 *                                 action. A gate that resolved the key for its own
 *                                 signature calls `lendKey(privateKey)` and the
 *                                 broadcast below reuses it instead of scanning
 *                                 again. Optional in both directions: a gate that
 *                                 never calls it (free route, hot account) leaves
 *                                 the normal resolve path untouched.
 *
 *                                 `verify` exists because the gate can sit for a
 *                                 while waiting on the user (an x402 approval
 *                                 sheet) — long enough for gas or the wallet
 *                                 balance to move, so the pre-flight's verdict
 *                                 from before the sheet opened may no longer
 *                                 hold. It re-runs that same pre-flight against
 *                                 CURRENT state and resolves to an error string
 *                                 or null. The gate must run it at the LAST
 *                                 moment before the payment is signed — for the
 *                                 x402 gate that is the Pay tap itself, inside
 *                                 the sheet, not before the sheet opens — and
 *                                 abort with its message if it returns one.
 * @param {string} language        Locale for the pre-flight error strings
 * @param {boolean} refreshBalanceOnSuccess  Re-read `from`'s balances on this
 *                                 chain once the tx confirms, so every
 *                                 balance-aware view updates (default off, so
 *                                 existing callers are unchanged).
 * @param {string|string[]} refreshTokenAddress  ERC-20 contract(s) just moved —
 *                                 refreshed directly over RPC (immediate). Pass an
 *                                 ARRAY when the tx moves several (a liquidity
 *                                 position moves two): the refresh reads only what
 *                                 it is handed, so an omitted token stays stale.
 *                                 Omit entirely for a native send — the native coin
 *                                 is always refreshed anyway, having paid the gas.
 * @param {object} nfcProxy        BaseContainer's `nfcProxy`, forwarded by the
 *                                 hosting screen (`screenRef.nfcProxy`). Only
 *                                 needed to send from a COLD (NFC keycard)
 *                                 account, whose key lives on the card and has
 *                                 to be scanned at signing time. Omitting it
 *                                 leaves hot accounts working exactly as before.
 */
export default function useSendTx ({ from, chainId, buildTxs, onResult, fallbackError, initialStatus, initialTxHash, initialError, preflight = false, preCheck, gate, language, refreshBalanceOnSuccess = false, refreshTokenAddress, nfcProxy } = {}) {
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
  //
  // Seeded from the persisted reason so a restored failure still says WHY, not
  // just that it failed. Only meaningful alongside a restored ERROR status: any
  // other rehydrated status has no failure to explain, and a fresh `confirm()`
  // clears this before it starts.
  const [error, setError] = useState(initialError || null)

  const confirm = useCallback(async () => {
    // Guard against double taps while the pre-send checks or a broadcast/
    // confirmation are in flight.
    if (status === TX_STATUS.GATING || status === TX_STATUS.SIGNING || status === TX_STATUS.CONFIRMING) return
    // Not SIGNING yet — the checks below (and the gate's payment sheet) all run
    // before anything is signed, so the send status stays hidden until they pass.
    setStatus(TX_STATUS.GATING)
    setTxHash(null)
    setError(null)

    let hash = null
    // A signing key the gate already read off the card, lent back so the
    // broadcast doesn't ask for a second scan. Scoped to this ONE confirm() call
    // and cleared in `finally` below — it is a plaintext key, so it must not
    // outlive the send that needed it, and must never reach state or storage.
    let lentKey = null
    // Which token the gate charged its fee in, reported by the gate itself. Read
    // by the post-success refresh so that balance is re-read too — it can sit on
    // a different chain from the tx, where nothing else here would look.
    let feeToken = null
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

      // Simulate + fee-check before touching the key, silently inside GATING —
      // the form is still on screen while it runs. A failure throws, so it
      // surfaces through the normal error path (timeline + Retry) having cost
      // nothing: no signature, no broadcast, no gas.
      if (preflight) {
        const err = await preflightTx({ chainId, from, txs, language })
        if (err) throw new Error(err)
      }

      // Last gate before the key is touched, and deliberately last: it can cost
      // the user money (an x402-paid API call), so it only runs once the tx has
      // been proven sendable — the balance check passed and the simulation says
      // it executes and the fee is covered.
      //
      // The check above is a snapshot, and the gate can pause for as long as the
      // user takes to read the approval sheet. Hand it a `verify` so it can
      // re-run that same check against CURRENT state right before the payment is
      // signed: the fee is then only ever paid for a tx that is still sendable
      // at the instant of payment, not one that merely was a minute ago.
      if (gate) {
        const gateErr = await gate({
          txs,
          verify: preflight
            ? () => preflightTx({ chainId, from, txs, language })
            : undefined,
          // Offered so a gate that has to read the signing key anyway (the x402
          // payment is signed by this same account) can pass it back and spare a
          // keycard user a second scan for the same action. Only accepted while
          // this call is still in the gate — see the null-out below.
          lendKey: (key) => { lentKey = key || null },
          // Records the token the fee was actually settled in, so the refresh
          // after this send re-reads that balance as well.
          noteFeeToken: (token) => { feeToken = token || null }
        })
        if (gateErr) throw new Error(gateErr)
      }

      // Everything that could still abort the send has passed — the x402
      // payment (when there was one) is settled and the backend authorized the
      // action. Only now does the send status appear.
      setStatus(TX_STATUS.SIGNING)

      // Hot account → secure storage; cold (NFC keycard) account → a card scan.
      // Same branch the Send Token screen uses; throws with a specific message
      // when the key can't be obtained.
      //
      // Unless the gate already scanned the card for the x402 payment and lent
      // the key back — then reuse it, so what is one action to the user costs one
      // tap rather than two. Safe because it is the SAME key either path: the
      // payment is signed by `from`, which is also the account signing this tx.
      const privateKey = lentKey || await resolvePrivateKey(from, nfcProxy)

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
      if (refreshBalanceOnSuccess) refreshBalances(from, chainId, refreshTokenAddress, feeToken)
      onResult?.({ success: true, txHash: hash })
    } catch (err) {
      setSettledLive(true)
      setStatus(TX_STATUS.ERROR)
      // formatWeb3Error, never err.message: a viem error's message carries the
      // RPC URL (API key and all) plus the signed request body, and this string
      // is both rendered and persisted into the chat history.
      const reason = formatWeb3Error(err, fallbackError)
      setError(reason)
      onResult?.({ success: false, error: reason, txHash: hash })
    } finally {
      // Drop the borrowed key as soon as this send is over, success or failure.
      // It is a plaintext private key held only to save the user a second scan,
      // so its life ends with the flow that justified it — a Retry scans again
      // rather than signing from something kept around since the last attempt.
      lentKey = null
    }
  }, [status, from, chainId, buildTxs, onResult, fallbackError, preflight, preCheck, gate, language, refreshBalanceOnSuccess, refreshTokenAddress, nfcProxy])

  // Rehydrated mid-confirmation (the user left while the tx was broadcast but
  // not yet confirmed): the broadcast already happened, so don't re-send — just
  // resume waiting for the receipt so the timeline settles to done/error.
  useEffect(() => {
    if (initialStatus !== TX_STATUS.CONFIRMING || !initialTxHash) return
    let cancelled = false
    ;(async () => {
      try {
        const ok = await waitForTxSuccess(initialTxHash, chainId, 20000)
        if (cancelled) return
        if (!ok) throw new Error(fallbackError)
        setSettledLive(true)
        setStatus(TX_STATUS.DONE)
        // No fee token here: the gate ran in the mount that broadcast this tx and
        // its report died with that closure, so a resumed confirmation refreshes
        // the tx chain only. Acceptable — a remount is already a full app pass
        // that re-reads balances, and the fee was charged long before it.
        if (refreshBalanceOnSuccess) refreshBalances(from, chainId, refreshTokenAddress)
        onResult?.({ success: true, txHash: initialTxHash })
      } catch (err) {
        if (cancelled) return
        setSettledLive(true)
        setStatus(TX_STATUS.ERROR)
        // Same reason handed to onResult goes into `error`, so the timeline can
        // state it. Without this a resumed confirmation that then fails (receipt
        // says reverted, or the 20s wait times out) shows only the generic
        // "transaction failed", even though the cause is right here.
        const reason = formatWeb3Error(err, fallbackError)
        setError(reason)
        onResult?.({ success: false, error: reason, txHash: initialTxHash })
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
    // The pre-send checks count as processing too — the tx isn't signed yet, but
    // the flow is running and must not be started a second time.
    isProcessing: status === TX_STATUS.GATING || status === TX_STATUS.SIGNING || status === TX_STATUS.CONFIRMING
  }
}
