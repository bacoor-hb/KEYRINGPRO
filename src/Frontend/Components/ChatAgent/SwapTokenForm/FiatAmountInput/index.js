import React, { useCallback, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSelector } from 'react-redux'
import InputCustom from 'frontend/Components/UI/InputCustom'
import { Colors, getSizeImgSquare } from 'common/styles'
import { CURRENCY_DATA } from 'common/constants/app'
import { sanitizeAmountText } from 'frontend/Screen/TokenDetailScreen/Component/Exchange/helpers'

// Fiat values render at 2 decimals, as they do everywhere else in the app.
export const MAX_DECIMAL_2USD = 2

/**
 * `FiatAmountInput` — the EDITABLE fiat line under a swap panel's amount.
 *
 * This is the Exchange screen's own fiat field (`renderTokenUsdInput` in
 * `Screen/TokenDetailScreen/Component/Exchange/index.js`), extracted so the chat
 * card can offer the same thing: type "$50" and the token amount above it is
 * back-computed from the token's price, instead of only ever reading the value
 * of an amount typed in tokens.
 *
 * Three rules it carries over from Exchange, each of which was a real bug there:
 *
 *  - The currency symbol renders INSIDE the input's value (a prefix before the
 *    number, a suffix after it), never as a sibling `<Text>`. A separate Text
 *    cannot share the TextInput's line-box on every device, so its glyph drifts
 *    off the digits' baseline.
 *  - For a SUFFIX currency the caret is pinned to the end of the NUMBER while
 *    editing, so Backspace removes a digit rather than the symbol, and new
 *    digits insert before it. A prefix needs no pinning — the symbol leads, so
 *    it is unreachable from the string's end.
 *  - While FOCUSED the raw typed value is shown (no reformatting mid-keystroke);
 *    on blur the same number is re-rendered through `formatFiat`, which rounds
 *    and separates exactly as `FiatBalance` does. So tapping in shows precisely
 *    what was displayed, not a long decimal.
 *
 * Edits are gated on focus (`isFocusRef`): a controlled re-render can hand the
 * field a value while the user is not in it, and treating that as typing would
 * overwrite the token amount from a number nobody entered.
 *
 * @param {string} value          The fiat-side value being edited (already × rate).
 * @param {string|number} usdForDisplay  Plain USD shown when NOT focused.
 * @param {(fiat: string) => void} onChangeFiat  Called with the sanitized fiat text.
 * @param {boolean} disabled      Read-only (locked run, or an unpriced token).
 * @param {function} onFocus     Also called when the field gains focus, after
 *                                this component's own focus bookkeeping. The chat
 *                                form uses it to scroll the field above the keyboard.
 */
const FiatAmountInput = ({ value, usdForDisplay, onChangeFiat, disabled = false, onFocus }) => {
  const currencyCode = useSelector((s) => s.currencyRedux)
  const fiatRate = useSelector((s) => s.fiatRateRedux)

  const [isFocus, setIsFocus] = useState(false)
  // The number that was on screen when the field was tapped, kept raw (no
  // separators) so it can be typed straight into. `null` means "no seed — render
  // from `value`", which is the state it returns to on the first keystroke and
  // on blur; '' is a legitimate seed (an empty field focused).
  const [focusSeed, setFocusSeed] = useState(null)
  // Mirrored into a ref so `onChangeText` can read the CURRENT focus state
  // synchronously — the state update that set it may not have committed yet when
  // the first keystroke arrives.
  const isFocusRef = useRef(false)

  const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
  const isSuffixSymbol = cur.position === 'suffix'
  const prefixSymbol = isSuffixSymbol ? '' : cur.symbol
  const suffixSymbol = isSuffixSymbol ? ` ${cur.symbol}` : ''

  // Formatted fiat shown when the field is NOT being edited. Rounds the shared
  // USD value the SAME way FiatBalance does (× rate, half-up at
  // MAX_DECIMAL_2USD), then adds thousands separators and trims trailing zeros
  // exactly like MyNumber — so blurring the field never changes the number.
  const formatFiat = useCallback((usdValue) => {
    if (usdValue == null) return ''
    const fiatValue = Number(usdValue) * (fiatRate > 0 ? fiatRate : 1)
    if (!Number.isFinite(fiatValue)) return ''
    const formatted = fiatValue.toLocaleString('en-US', {
      minimumFractionDigits: MAX_DECIMAL_2USD,
      maximumFractionDigits: MAX_DECIMAL_2USD
    })
    const dot = formatted.indexOf('.')
    if (dot < 0) return formatted
    const frac = formatted.slice(dot + 1).replace(/0+$/, '')
    return frac.length > 0 ? `${formatted.slice(0, dot)}.${frac}` : formatted.slice(0, dot)
  }, [fiatRate])

  // What the field shows. While FOCUSED that is the raw value being edited, so
  // typing is never reformatted mid-keystroke; otherwise it is the shared USD
  // value rendered exactly as FiatBalance would.
  //
  // `focusSeed` is what keeps the CURRENT NUMBER when the field is tapped.
  // `value` only holds something once the user has typed in THIS field — an
  // amount entered in tokens above, or restored with the card, leaves it empty —
  // so focusing without a seed blanked a number that was plainly on screen a
  // moment earlier, and it had to be retyped rather than edited.
  //
  // The seed is CONSUMED on the first keystroke (see onChangeText), never
  // re-consulted per render. That distinction matters: falling back to it
  // whenever `value` is empty would make a deliberately cleared field spring
  // back to its old number the instant the last digit was deleted.
  //
  // (Exchange avoids the same trap from the other end: it writes its fiat state
  // on every path that sets the token amount, so the raw value is always primed.
  // Seeding on focus gets there without a second copy of the amount to keep in
  // sync — the formatted text IS the value, and it is already 2-decimal.)
  const textValue = isFocus ? (focusSeed ?? (value == null ? '' : String(value))) : formatFiat(usdForDisplay)
  const displayValue = textValue ? `${prefixSymbol}${textValue}${suffixSymbol}` : (isFocus ? prefixSymbol : '')

  const selection = isSuffixSymbol && isFocus
    ? {
      start: displayValue.length - suffixSymbol.length,
      end: displayValue.length - suffixSymbol.length
    }
    : undefined

  const onChangeText = (text) => {
    if (!isFocusRef.current) return
    const stripped = String(text).replace(cur.symbol, '').trim()
    // The seed has served its purpose the moment the user edits it: from here
    // the field is driven by `value`, so clearing the text really clears it.
    setFocusSeed(null)
    onChangeFiat?.(sanitizeAmountText(stripped, MAX_DECIMAL_2USD))
  }

  return (
    // Exchange's own two-view wrapper, values included — see the styles below for
    // why it is sized in real width/height rather than with flex.
    <View style={styles.row}>
      <View style={styles.field}>
        <InputCustom
          variant='empty'
          useNativePlaceholder
          // InputCustom applies this as a minHeight on its own wrapper. Matched to
          // the row above rather than left at its default 46, which exceeds the
          // row's 44 and would push the reserved space open, nudging the receive
          // panel below it down by a couple of pixels.
          height={ROW_HEIGHT}
          isDisable={disabled}
          value={displayValue}
          selection={selection}
          onChangeText={onChangeText}
          onFocus={() => {
            isFocusRef.current = true
            // Carry the number currently displayed INTO the field, stripped of
            // its thousands separators — '1,234.5' is what FiatBalance shows but
            // not something a decimal-pad can produce, so it has to become
            // '1234.5' before it becomes editable text. Already rounded to 2
            // decimals by formatFiat, so nothing is gained or lost here.
            setFocusSeed(formatFiat(usdForDisplay).replace(/,/g, ''))
            setIsFocus(true)
            onFocus?.()
          }}
          onBlur={() => {
            isFocusRef.current = false
            setIsFocus(false)
            // Drop the seed: from here the field renders from `usdForDisplay`
            // again, and a seed left behind would be shown on the NEXT focus
            // even if the amount had changed in the meantime.
            setFocusSeed(null)
          }}
          keyboardType='decimal-pad'
          placeholderTextColor={Colors.TEXT_MEDIUM}
          placeholder={`${prefixSymbol}0${suffixSymbol}`}
          inputConfig={{ style: styles.input }}
        />
      </View>
    </View>
  )
}

// The height of the fiat line, matching the row SwapTokenForm reserves for it
// (`styles.fiatRow`, which is getSizeImgSquare('large')). Both sides must agree:
// the caller reserves the space so the receive panel below never moves, and this
// fills it so the field has a box to be tapped in.
const ROW_HEIGHT = getSizeImgSquare('large')

// Deliberately the SAME two-view wrapper Exchange builds around this field, with
// the same style values — `width: '100%'` on both, never `flex: 1`.
//
// That is what makes it tappable, and it is worth stating why. InputCustom's
// TextInput is `flex: 1` inside `styles.field` (`flex: 1`) inside
// `styles.inputBorderedRow` (`flex: 1`, `alignSelf: 'stretch'`). Sizing THIS
// wrapper with `flex: 1` too leaves that entire chain resolving its cross-axis
// extent from a parent that is itself still being resolved: the text paints (a
// Text node needs no box) but the native input's touch rect comes out zero-high,
// so taps land on the panel behind it and the field can never take focus.
// Declaring a real width and a real height terminates the chain.
const styles = StyleSheet.create({
  row: { width: '100%', height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center' },
  field: { width: '100%', position: 'relative' },
  // Medium emphasis, matching the read-only fiat line it replaces: the token
  // amount above stays the one full-white number in the panel.
  input: { color: Colors.TEXT_MEDIUM }
})

export default FiatAmountInput
