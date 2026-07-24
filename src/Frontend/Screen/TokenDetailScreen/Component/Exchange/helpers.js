// Pure helpers for the Exchange amount inputs. NO react-native imports — keep
// this module dependency-free and side-effect-free.

/**
 * Normalize raw keyboard/paste text into a decimal amount STRING.
 *
 * Rules (kept identical to the historical behavior):
 *  - ','  -> '.' (decimal-pad locales emit commas)
 *  - strip a space, collapse '00' -> '0'
 *  - keep only the FIRST dot ('1.2.3' -> '1.23')
 *  - a leading dot clears the value ('.5' -> '')
 *  - when `decimal` is given, trim the fraction to that many digits
 *
 * ALWAYS returns a plain string. The old inline version returned the raw
 * `String.match()` result — an ARRAY. That array leaked into component state
 * and Redux (state.exchange.amountIn), so an emptied input became [''] —
 * truthy, with .length 1 — which made every "is the value empty?" check lie
 * (e.g. the input kept its huge auto-fit layout width while showing the
 * placeholder, clipping it). Never return anything but a string here.
 */
export const sanitizeAmountText = (value, decimal) => {
  let newValue = value == null ? '' : String(value)
  newValue = newValue.replace(/,/g, '.')
  newValue = newValue.replace(' ', '')

  if (newValue === '00') {
    newValue = '0'
  }

  const firstDotIndex = newValue.indexOf('.')

  if (firstDotIndex !== -1) {
    newValue = newValue.substring(0, firstDotIndex + 1) + newValue.substring(firstDotIndex + 1).replace(/\./g, '')
  }

  if (newValue.startsWith('.')) {
    newValue = ''
  }

  if (decimal) {
    const match = newValue.match(new RegExp(`^\\d*\\.?\\d{0,${decimal}}`))
    newValue = match ? match[0] : ''
  }

  return newValue
}

/**
 * Natural width of `text` at the base font size — the per-character advance
 * widths are summed synchronously (they were measured once, see
 * AutoFitAmountInput). Unknown characters fall back to the width of '0'.
 */
export const sumTextWidth = (text, charWidths) => {
  if (!charWidths) {
    return 0
  }
  const fallback = charWidths['0'] || 0
  let total = 0
  for (const ch of text) {
    total += charWidths[ch] != null ? charWidths[ch] : fallback
  }
  return total
}

/**
 * Scale (0..1] that makes `text` fit `containerWidth` at the base font size.
 *
 *  - `minTrustedWidth`: containers report transient tiny widths while a drawer
 *    is animating open — scaling to those would shrink the text to a sliver,
 *    so anything below this threshold renders unscaled instead.
 *  - empty text shows the placeholder ('0'), which always fits — never scaled.
 *  - `minScale` floors how small the text may get (readability floor); below
 *    it the text is allowed to overflow instead.
 */
export const computeFitScale = ({ text, containerWidth, charWidths, minScale, minTrustedWidth }) => {
  if (!containerWidth || containerWidth < minTrustedWidth) {
    return 1
  }
  if (!text || !text.length) {
    return 1
  }
  const textWidth = sumTextWidth(text, charWidths)
  if (!textWidth || textWidth <= containerWidth) {
    return 1
  }
  return Math.max(containerWidth / textWidth, minScale)
}
