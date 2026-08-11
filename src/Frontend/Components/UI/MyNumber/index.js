import React from 'react'
import { StyleSheet } from 'react-native'
import BigNumber from 'bignumber.js'
import MyText from '../MyText'
import MyTextTicker from '../MyTextTicker'
import { fontSize, DECIMAL_DOWN_PIXEL } from 'common/styles'

// One design-pixel expressed in the same scaled units `fontSize()` produces
// (fontSize is linear above its 12px floor, so fontSize(13)-fontSize(12) is
// exactly one step). Multiplying by DECIMAL_DOWN_PIXEL gives the amount to trim
// from an explicit fontSize so the decimal shrinks by the SAME step MyText's
// `downPixel` applies on the variant path — one knob drives both.
const DECIMAL_DOWNSCALE = DECIMAL_DOWN_PIXEL * (fontSize(13) - fontSize(12))

// Group the integer part with thousand separators (e.g. '1234567' -> '1,234,567').
// Operates on the plain digit string so it's precision-safe for values beyond what
// a JS Number can hold — no toLocaleString (which requires a lossy Number).
const groupThousands = (intDigits) => intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Format a value with thousand separators + fixed decimal digits, WITHOUT ever
// routing through a JS Number — so full-precision inputs (BigNumber or a long
// decimal string like '2.598482567558123818') keep every digit. Passing them to
// Number() first collapses them to ~15-17 significant digits.
// Extra decimals are TRUNCATED, not rounded ('2.999' with 2 digits -> '2.99').
// `signed` forces an explicit sign for non-negative values ('+1.71' vs '1.71').
const formatNumber = (value, fractionDigits, signed = false) => {
  const bn = new BigNumber(value)
  if (bn.isNaN() || !bn.isFinite()) {
    // Match the previous behavior: non-finite input formats as zero.
    return formatNumber(0, fractionDigits, signed)
  }

  const digits = Number.isFinite(fractionDigits) && fractionDigits >= 0 ? fractionDigits : undefined

  // Sign is derived from the ORIGINAL value, before truncation — a tiny negative
  // like -0.0001 truncates to zero, but should still read as '-0.00' (a small loss),
  // while exact 0 counts as non-negative.
  const sign = bn.isNegative() ? '-' : (signed ? '+' : '')

  // Truncate toward zero on the magnitude. BigNumber works on the decimal
  // representation, so this is exact for large values and long decimals alike.
  const magnitude = digits != null
    ? bn.abs().decimalPlaces(digits, BigNumber.ROUND_DOWN)
    : bn.abs()

  // toFixed(digits) pads with trailing zeros so downstream trimming logic (and
  // fixedDecimals) sees a stable, fully-padded fractional part.
  const fixed = digits != null ? magnitude.toFixed(digits) : magnitude.toFixed()
  const dot = fixed.indexOf('.')
  const intDigits = dot >= 0 ? fixed.slice(0, dot) : fixed
  const fracDigits = dot >= 0 ? fixed.slice(dot + 1) : ''
  const base = fracDigits.length > 0
    ? `${groupThousands(intDigits)}.${fracDigits}`
    : groupThousands(intDigits)

  return `${sign}${base}`
}

// Trim trailing zeros from the decimal part: '0.5000' -> '5', '1.2300' -> '23',
// '1.0000' -> '' (caller omits the decimal section entirely when empty).
const trimTrailingZeros = (s) => s.replace(/0+$/, '')

// The integer / fractional strings MyNumber is about to render, split out so
// other renderers (MyRollingNumber's odometer) can lay the exact same digits
// out character by character instead of re-implementing the formatting.
export const getNumberParts = (value, fractionDigits = 2, signed = false, fixedDecimals = false) => {
  const formatted = formatNumber(value, fractionDigits, signed)
  const dot = formatted.indexOf('.')
  const intPart = dot >= 0 ? formatted.slice(0, dot) : formatted
  const rawFrac = dot >= 0 ? formatted.slice(dot + 1) : ''
  return {
    intPart,
    fracPart: fixedDecimals ? rawFrac : trimTrailingZeros(rawFrac)
  }
}

// Render any number where the fractional part is one font-size step smaller
// than the integer part — uses MyText's existing `isUseDecimal` prop so the
// caller never has to split the string by hand. Use this for balances, prices,
// percent changes, and any other formatted number.
//
// Notes:
//   - If the caller's `style` sets an explicit `fontSize`, we manually trim the
//     inner (decimal) fontSize by DECIMAL_DOWNSCALE — the same step MyText's
//     `downPixel` applies on the variant path — so the explicit and variant
//     paths shrink identically. Letting `isUseDecimal` alone shrink from the
//     variant's base size would otherwise ignore the overridden outer size.
//   - We also forward the outer `color` to the inner Text because MyText
//     applies `text-white` via className, which would otherwise override
//     RN's nested-Text color inheritance.
//   - Decimal section is omitted when all trailing digits are zero.
//
// Props:
//   value           number  — required, the raw number
//   fractionDigits  number  — default 2
//   prefix          node    — e.g. '$' or a custom icon
//   suffix          node    — e.g. ' ETH' or '%'
//   hide            bool    — render '***' (respects prefix/suffix)
//   signed          bool    — always show sign ('+1.71%' / '-1.71%')
//   fixedDecimals   bool    — keep exactly `fractionDigits` decimals, i.e. DON'T
//                             trim trailing zeros ('0' -> '0.00', '1.5' -> '1.50').
//                             Use for percentages / fixed-precision fields.
//   variant         MyText  — base size; decimal auto-renders one step smaller
//   style           Style   — applied to outer text
//   decimalStyle    Style   — optional override for the smaller decimal part
//   ticker          bool    — render as MyTextTicker (marquee when overflowing
//                             the parent width). Drops decimal-shrink because
//                             nested Text inside TextTicker breaks measurement.
//   autoFit         bool    — shrink fontSize to fit the available width on a
//                             single line (RN adjustsFontSizeToFit) instead of
//                             wrapping. Renders as one flat string (no nested
//                             decimal Text) because adjustsFontSizeToFit doesn't
//                             reliably measure/scale nested Text (Android). Needs
//                             the parent to give the text a bounded width.
//   ...rest                 — forwarded to outer MyText (numberOfLines, className...)
/**
 * @param {number|string|BigNumber} value - Raw number to display
 * @param {number} fractionDigits - Decimal places (default 2)
 * @param {React.ReactNode} prefix - Prefix node (e.g. '$')
 * @param {React.ReactNode} suffix - Suffix node (e.g. ' ETH')
 * @param {boolean} hide - Render '***' placeholder
 * @param {boolean} signed - Always show sign (+/-)
 * @param {boolean} fixedDecimals - Keep trailing zeros (e.g. '1.50')
 * @param {string} variant - Text size variant
 * @param {StyleProp<TextStyle>} style - Outer text style
 * @param {StyleProp<TextStyle>} decimalStyle - Override for decimal part style
 * @param {string} className - Tailwind class
 * @param {boolean} ticker - Render as marquee TextTicker
 * @param {boolean} autoFit - Shrink fontSize to fit single line
 * @param {string} fontWeight - Font weight override
 */
const MyNumber = ({
  value,
  fractionDigits = 2,
  prefix,
  suffix,
  hide = false,
  signed = false,
  fixedDecimals = false,
  variant = 'default',
  style,
  decimalStyle,
  className,
  ticker = false,
  autoFit = false,
  fontWeight,
  ...rest
}) => {
  if (hide) {
    return (
      <MyText variant={variant} fontWeight={fontWeight} style={style} className={className} {...rest}>
        {prefix}***{suffix}
      </MyText>
    )
  }

  // Pass `value` straight through (string / BigNumber / number) — never Number() it,
  // or long decimals lose precision before formatting. `fixedDecimals` keeps the
  // full padded decimals (e.g. '0.00'); otherwise trailing zeros are trimmed.
  const { intPart, fracPart } = getNumberParts(value, fractionDigits, signed, fixedDecimals)
  const showFrac = fracPart.length > 0

  const fullText = `${prefix || ''}${intPart}${showFrac ? '.' + fracPart : ''}${suffix || ''}`

  // Ticker mode: render the full formatted string in a single MyTextTicker.
  // We can't nest a smaller decimal MyText inside TextTicker because the
  // ticker's width measurement relies on a single string child.
  if (ticker) {
    return (
      <MyTextTicker variant={variant} fontWeight={fontWeight} style={style} className={className} {...rest}>
        {fullText}
      </MyTextTicker>
    )
  }

  // Auto-fit mode: keep everything on one line and let RN shrink the font to fit
  // the available width. Use a single flat string (no nested decimal Text) so the
  // measurement stays reliable across platforms; minimumFontScale floors how small
  // it can go before truncating.
  if (autoFit) {
    return (
      <MyText
        variant={variant}
        fontWeight={fontWeight}
        style={style}
        className={className}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        {...rest}
      >
        {fullText}
      </MyText>
    )
  }

  // Derive inner decimal styling from the outer style so size/color stay consistent.
  const outer = StyleSheet.flatten(style) || {}
  const inheritColor = outer.color != null ? { color: outer.color } : null
  const explicitFontSize = outer.fontSize != null
    ? { fontSize: outer.fontSize - DECIMAL_DOWNSCALE, lineHeight: (outer.fontSize - DECIMAL_DOWNSCALE) * 1.5 }
    : null
  // Only let MyText auto-shrink the decimal when the caller hasn't pinned a fontSize.
  const useVariantDecimal = !explicitFontSize

  return (
    <MyText variant={variant} fontWeight={fontWeight} style={style} className={className} {...rest}>
      {prefix}
      {intPart}
      {showFrac && (
        // Forward fontWeight here too — MyText picks its fontFamily from the weight, and
        // nested Text does NOT inherit it, so without this the decimals render un-bolded.
        <MyText
          variant={variant}
          fontWeight={fontWeight}
          isUseDecimal={useVariantDecimal}
          style={[inheritColor, explicitFontSize, decimalStyle]}
          className={className}
          {...rest}
        >
          .{fracPart}
        </MyText>
      )}
      {suffix}
    </MyText>
  )
}

export default MyNumber
