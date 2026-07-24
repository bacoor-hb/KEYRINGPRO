import React, { useState, useCallback, useEffect, useRef } from 'react'
import { View, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import BigNumber from 'bignumber.js'
import { Colors, pixelByHeight } from 'common/styles'
import I18n, { resolveLocale } from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import GlassView from 'frontend/Components/UI/GlassView'
import useSendTx, { TX_STATUS } from 'frontend/Hooks/useSendTx'
import TxStatusTimeline from '../TxStatusTimeline'
import styles from './styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

// Cut `n` to `d` decimals through BigNumber so float artifacts can never leak
// into a displayed or derived value. Truncates and strips trailing zeros.
const toFixedDown = (n, d) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFixed() : ''
}

// Display a token amount truncated (no rounding) to 8 decimals, with grouping.
const fmt = (n, d = 8) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

// Keep a numeric input as a positive number string, no sign. A typed comma (some
// keyboards use it as the decimal mark) becomes a dot.
//   - integer fields (e.g. ERC-1155 editions): digits only, no dot at all.
//   - decimal fields (token/native amounts): a single dot, fraction capped to the
//     token's `decimals` — mirroring the Send Token screen.
const sanitizeAmount = (v, { decimals = 18, integer = false } = {}) => {
  if (integer) return String(v).replace(/[^0-9]/g, '')
  const out = String(v).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = out.indexOf('.')
  if (i === -1) return out
  // Single dot only, and clip the fraction to at most `decimals` places.
  const max = BigNumber(decimals).isFinite() ? BigNumber(decimals).toNumber() : 18
  const fraction = out.slice(i + 1).replace(/\./g, '').slice(0, max)
  return `${out.slice(0, i)}.${fraction}`
}

const isAddress = (v) => /^0x[0-9a-fA-F]{40}$/.test(String(v || '').trim())

/**
 * Shared renderer for the in-chat wallet-action forms (send native, send token,
 * approve, send NFT). Every one of them is the same shape — a few labelled
 * fields plus a submit — so they are described declaratively by `fields` and
 * rendered here rather than copied four times.
 *
 * Unlike AddLiquidityForm (which hands the intent back to the agent), these
 * forms EXECUTE: submitting signs and broadcasts the transaction locally via
 * `useSendTx`, then renders the shared `TxStatusTimeline` — the same
 * sign → confirm → done/error flow ConfirmAddLiquidityTx uses. The agent is
 * never asked to confirm; it already resolved everything it could, and the
 * remaining values are typed right here.
 *
 * A field is `{ key, label, type, placeholder, symbol, optional, integer }` where
 * `type` is 'amount' | 'address' | 'text'. `integer` (amount fields only) forces a
 * whole number — used for ERC-1155 editions, which can't be fractional; token/
 * native amounts stay decimal, capped to the token's `decimals`. Values already
 * resolved by the agent arrive in `parameters` and pre-fill the field.
 *
 * `buildTxs({ values, parameters, walletAddress })` returns the unsigned tx
 * array to broadcast — each action supplies its own encoder.
 *
 * `preCheck({ values, parameters, walletAddress, chainId, language })` is the
 * action's own first check, run on submit before anything is signed: it asks the
 * one on-chain question that action depends on (holding enough of the token,
 * owning the NFT) and resolves to an error string to stop, or null to go ahead.
 */
export default function WalletActionForm ({
  props,
  language,
  fields,
  submitLabel,
  buildTxs,
  preCheck,
  // Amount fields validate against this when given (the agent pre-computes a
  // gas-aware spendable balance for native sends).
  spendable,
  spendableSymbol,
  quickPercents,
  // Tx lifecycle plumbing, forwarded by MessageBubble — same set
  // ConfirmAddLiquidityTx receives.
  onResult,
  onStatusChange,
  onCopyHash,
  onPersist
}) {
  const t = (key, opts) => tt(key, language, opts)
  const { chainId, chainName, walletAddress, parameters = {}, txState } = props

  // Seed each field from what the agent already resolved; the user fills the
  // rest. Once submitted, the values that were actually signed are persisted
  // into `txState` and take priority — otherwise coming back to the chat would
  // re-seed from `parameters` and blank out everything the user typed, leaving
  // a completed tx sitting above empty fields.
  const [values, setValues] = useState(() =>
    fields.reduce((acc, f) => {
      const submitted = txState?.values?.[f.key]
      acc[f.key] = submitted != null
        ? String(submitted)
        : parameters[f.key] != null ? String(parameters[f.key]) : ''
      return acc
    }, {})
  )
  const [touched, setTouched] = useState({})

  // Fields the AGENT resolved, locked so the user can't edit them. A contract
  // address is the one value in these forms the user has no way to sanity-check
  // by eye — a single altered character silently redirects the transfer to a
  // different token, and it's the field a fat-fingered tap in a long wrapped
  // 0x string is most likely to land in. When the agent resolved it (from the
  // symbol the user asked for) it is authoritative, so it's presented as a fact
  // rather than an input. A field the user has to type themselves is never
  // locked, so a token the agent couldn't resolve stays fully usable.
  //
  // Computed ONCE from the mount-time seed (hence useRef, not a live read of
  // `values`): the lock must reflect where the value CAME FROM, not what it
  // currently is. Deriving it from `values` would re-lock the field the moment
  // the user typed a valid address into it.
  const lockedFieldsRef = useRef(
    fields.reduce((acc, f) => {
      // `txState.values` is a previous submit of THIS form, so a value restored
      // from it was locked (or typed) on that earlier mount — only the agent's
      // own `parameters` count as an AI pre-fill.
      acc[f.key] = !!(f.lockWhenPrefilled && parameters[f.key] != null && String(parameters[f.key]) !== '')
      return acc
    }, {})
  )
  const isLocked = (f) => lockedFieldsRef.current[f.key]

  // Token decimals the agent resolved (Send Token / Approve carry it); the amount
  // field caps its fraction to this so the user can't type more precision than the
  // token supports. Defaults to 18 when absent (native / unknown).
  const amountDecimals = parameters.decimals != null ? Number(parameters.decimals) : 18

  const setValue = (f, raw) => {
    let v = raw
    if (f.type === 'amount') v = sanitizeAmount(raw, { decimals: amountDecimals, integer: f.integer })
    // Integer text fields (e.g. an NFT token id — a uint256) accept digits only.
    else if (f.integer) v = String(raw).replace(/[^0-9]/g, '')
    setValues((prev) => ({ ...prev, [f.key]: v }))
    setTouched((prev) => ({ ...prev, [f.key]: true }))
  }

  const amountField = fields.find((f) => f.type === 'amount')
  const amountValue = amountField ? values[amountField.key] : null
  const parsedAmount = BigNumber(amountValue)
  const validAmount = parsedAmount.isFinite() && parsedAmount.gt(0)

  const spendableBn = BigNumber(spendable)
  const exceedsBalance =
    validAmount && spendableBn.isFinite() && parsedAmount.gt(spendableBn)

  // Per-field error. The `touched` gate only gags complaints about what the user
  // has not filled in yet, so an untouched form never opens covered in red. It
  // must NOT gag a bad VALUE: the agent pre-fills fields from `parameters`, and
  // such a value is never "touched" — gating it would disable submit with no
  // visible reason. So anything that judges the value itself reports right away.
  const fieldError = (f) => {
    const v = values[f.key]
    if (f.optional && !v) return null
    if (!v) return touched[f.key] ? t('walletActionFieldRequired') : null
    if (f.type === 'address' && !isAddress(v)) return t('walletActionInvalidAddress')
    if (f.type === 'amount') {
      const n = BigNumber(v)
      if (!n.isFinite() || n.lte(0)) return t('walletActionInvalidAmount')
      // Integer-only amounts (e.g. ERC-1155 editions) can't be fractional.
      if (f.integer && !n.isInteger()) return t('walletActionInvalidAmount')
      if (exceedsBalance) return t('insufficientBalance')
    }
    // Integer text field (e.g. NFT token id): a whole number ≥ 0 (0 is a valid
    // id). setValue already strips non-digits; this also guards agent pre-fills.
    if (f.type === 'text' && f.integer && !/^\d+$/.test(v)) return t('walletActionInvalidAmount')
    return null
  }

  const isFilled = (f) => {
    const v = values[f.key]
    // An optional field is "filled" when empty — but if the user DID type
    // something, it still has to be valid (a bad value must block submit).
    if (f.optional && !v) return true
    if (!v) return false
    if (f.type === 'address') return isAddress(v)
    if (f.type === 'amount') {
      const n = BigNumber(v)
      if (!n.isFinite() || !n.gt(0)) return false
      if (f.integer && !n.isInteger()) return false
      return true
    }
    // Integer text field (NFT token id): all-digits, non-empty (0 allowed).
    if (f.type === 'text' && f.integer) return /^\d+$/.test(v)
    return true
  }

  // Tx lifecycle (sign → broadcast → confirm) lives in the shared hook, so this
  // form renders the same timeline as every other tx screen. `txState` is any
  // status/hash persisted into the message on a previous mount — seeding the
  // hook with it restores the timeline when the user leaves and returns to the
  // chat, instead of resetting to IDLE.
  //
  // `buildTxs` is read through a ref-free closure on purpose: the hook only
  // calls it at confirm time, by which point `values` is whatever the user last
  // typed (submit is disabled until the form validates).
  const { status, txHash, confirm, settledLive, restoredFromHistory, error } = useSendTx({
    from: walletAddress,
    chainId,
    initialStatus: txState?.status,
    initialTxHash: txState?.txHash,
    buildTxs: () => buildTxs({ values, parameters, walletAddress }),
    fallbackError: t('txFailed'),
    onResult,
    // Same closure-over-`values` reasoning as buildTxs: it only runs at confirm
    // time, when `values` is whatever the user last typed.
    preCheck: preCheck
      ? () => preCheck({ values, parameters, walletAddress, chainId, language })
      : undefined,
    // Simulate the tx and verify the fee is affordable before signing. Runs
    // silently inside "Sending", so a revert or an empty gas tank is caught
    // before it costs anything, without adding a step the user has to watch.
    preflight: true,
    language
  })

  const isIdle = status === TX_STATUS.IDLE
  const canSubmit = fields.every(isFilled) && !exceedsBalance

  // Let the host (chat list) scroll to keep the latest status in view — but only
  // on a REAL status transition, never on a remount. FlatList unmounts offscreen
  // rows and remounts them as you scroll back over them, and a widget that has
  // already settled remounts straight into SUCCESS/FAIL (restored from the
  // persisted txState). Firing on mount made every such remount ask the list to
  // scroll to the bottom, so scrolling up over past send-token bubbles yanked
  // the user back down. Seeding the ref with the mount-time status means the
  // first run has nothing to report; only a later change does.
  const lastNotifiedStatusRef = useRef(status)
  useEffect(() => {
    if (isIdle) return
    if (lastNotifiedStatusRef.current === status) return
    lastNotifiedStatusRef.current = status
    onStatusChange?.()
  }, [status, isIdle, onStatusChange])

  // Persist the live status/hash — plus the values that were signed — back into
  // the message so both the timeline and the filled-in fields survive a remount.
  // Skip IDLE — there's nothing worth restoring, and it avoids clobbering a
  // persisted state on the first mount before confirm.
  useEffect(() => {
    if (isIdle) return
    onPersist?.({ status, txHash, values })
  }, [status, txHash, isIdle, values, onPersist])

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    confirm()
  }, [canSubmit, confirm])

  return (
    <View style={styles.card}>
      {/* Once the tx is on its way the form is just a record of what was signed:
          it dims and stops responding, letting the status timeline below carry
          the attention. Mirrors the Send Token screen's dimmed-form treatment. */}
      <View
        style={[styles.formBox, !isIdle && styles.formBoxSubmitted]}
        pointerEvents={isIdle ? 'auto' : 'none'}
      >
        {/* Header: what this form does + which chain it runs on */}
        <View style={styles.header}>
          <MyText variant='subTitle' fontWeight={700}>{submitLabel(t)}</MyText>
          {!!chainName && (
            <View style={styles.headerMeta}>
              <GlassView
                pointerEvents='none'
                style={styles.tag}>
                <MyText variant='small' className='text-medium'>{chainName}</MyText>
              </GlassView>
            </View>
          )}
        </View>

        <View style={styles.divider} className='bg-box-small' />

        {fields.map((f) => (
          <View
            pointerEvents={isLocked(f) ? 'none' : 'auto'}
            key={f.key}
            style={{
              gap: pixelByHeight(4)
            }}>
            <View style={styles.fieldLabel} className='flex flex-row'>
              <MyText variant='default' fontWeight='700'>{f.label(t)}</MyText>
            </View>

            <GlassView
              effect='clear'
              // Address rows reserve a fixed two-line height so a long 0x address
              // that wraps never shifts the layout (mirrors the Send Token field).
              style={[styles.inputRow, f.type === 'address' && styles.addressRow]}
            >
              <TextInput
                style={[
                  f.type === 'address' ? styles.addressInput : styles.input,
                  // A locked field is not an input the user skipped — it's a
                  // resolved fact. Dimming it says so, and stops it reading as
                  // a field they failed to fill.
                  isLocked(f) && styles.lockedInput
                ]}
                className='text-white font-semibold'
                value={values[f.key]}
                onChangeText={(v) => setValue(f, v)}
                // Not editable once the tx is on its way (the values are what
                // was signed — visible for reference only), nor when the agent
                // resolved this field for the user (see lockedFieldsRef).
                editable={isIdle && !isLocked(f)}
                keyboardType={f.integer ? 'number-pad' : f.type === 'amount' ? 'decimal-pad' : 'default'}
                // An EVM address is exactly 42 chars (0x + 40 hex) — cap it there.
                maxLength={f.type === 'address' ? 42 : undefined}
                // Addresses are long — let them wrap onto multiple lines instead
                // of scrolling horizontally off the field.
                multiline={f.type === 'address'}
                autoCapitalize='none'
                autoCorrect={false}
                placeholder={f.placeholder(t)}
                placeholderTextColor={Colors.TEXT_LOW}
              />
              {!!f.symbol && (
                <MyText className='text-medium font-medium'>{f.symbol}</MyText>
              )}
            </GlassView>

            {/* Validation only matters while the form is still editable — a
                broadcast tx can't be fixed by a red hint. */}
            {isIdle && (
              <View style={styles.errorSlot}>
                {!!fieldError(f) && (
                  <MyText variant='small' className='text-red-text' style={styles.errorText}>
                    {fieldError(f)}
                  </MyText>
                )}
              </View>
            )}

            {/* Quick-pick chips + spendable line sit under the amount field */}
            {isIdle && f.type === 'amount' && spendable != null && (
              <>
                {!!quickPercents?.length && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickRow}
                  >
                    {quickPercents.map((p) => (
                      <TouchableOpacity
                        key={p}
                        activeOpacity={0.7}
                        onPress={() =>
                          setValue(f, toFixedDown(spendableBn.times(p).div(100), amountDecimals))}
                      >
                        <GlassView interactive style={styles.quickChip}>
                          <MyText variant='small' className='font-semibold'>{p}%</MyText>
                        </GlassView>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.balanceRow}>
                  <MyText variant='small' className='text-medium'>
                    {t('spendable')}:{' '}
                    <MyText variant='small' className='font-medium'>
                      {fmt(spendable)} {spendableSymbol}
                    </MyText>
                  </MyText>
                </View>
              </>
            )}
          </View>
        ))}

        {isIdle && (
          <MyButton
            className='w-full'
            style={[styles.submitBtnWrap, !canSubmit && styles.submitBtnDisabled]}
            activeOpacity={0.8}
            disabled={!canSubmit}
            variant='primary'
            onPress={handleSubmit}
          >
            <MyTextTicker fontWeight={700}>Pay Fee and execute</MyTextTicker>
          </MyButton>
        )}
      </View>

      {/* Shared status timeline drives the sign → confirm → done/error flow. */}
      {!isIdle && (
        <TxStatusTimeline
          status={status}
          txHash={txHash}
          from={walletAddress}
          chainId={chainId}
          language={language}
          onCopyHash={onCopyHash}
          onRetry={confirm}
          // The pre-flight's reason ("not enough for the fee", "can't be
          // completed") is far more useful than the generic failure copy, so
          // pass it through when we have one.
          errorMessage={error}
          // Only animate the success/fail result when it settled live this
          // mount; a state restored from history renders statically.
          animate={settledLive}
          // The Sending/Waiting intro markers animate on any live flow; only a
          // full restore-from-history renders them statically.
          animateIntro={!restoredFromHistory}
        />
      )}
    </View>
  )
}
