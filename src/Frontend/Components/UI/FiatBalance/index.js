import React from 'react'
import { useSelector } from 'react-redux'
import MyNumber from '../MyNumber'
import { CURRENCY_DATA } from 'common/constants/app'

// Render a USD amount in the user's selected fiat currency. Reads the live
// currency code + USD→fiat rate from Redux (kept fresh by ReduxService
// .updateFiatRate at app start / on currency change), multiplies, and places
// the currency symbol per CURRENCY_DATA `position` (prefix vs suffix — e.g.
// '$1,234.56' vs '1.234,56 €'). Thin wrapper over MyNumber: every other
// number-formatting prop (variant, style, ticker, fractionDigits, hide…) is
// forwarded, so callers swap `<MyNumber value={usd} prefix='$'/>` for
// `<FiatBalance valueUSD={usd} .../>` without losing styling.
// `dynamicDecimals` opts into crypto-price style precision based on the
// converted (displayed) magnitude: integer part >= 1 → 2 decimals, sub-1 micro
// prices → 8 decimals so tiny prices stay readable. Overrides any fractionDigits.
/**
 * @param {number|string} valueUSD - USD amount to convert
 * @param {boolean} [dynamicDecimals] - Use crypto-style precision (2 or 8 decimals)
 */
const FiatBalance = ({ valueUSD, dynamicDecimals = false, ...rest }) => {
  const currencyCode = useSelector((s) => s.currencyRedux)
  const fiatRate = useSelector((s) => s.fiatRateRedux)

  const cur = CURRENCY_DATA[currencyCode] || CURRENCY_DATA.USD
  const rate = fiatRate > 0 ? fiatRate : 1
  const value = (Number(valueUSD) || 0) * rate

  const symbolProps = cur.position === 'suffix'
    ? { suffix: ` ${cur.symbol}` }
    : { prefix: cur.symbol }

  const dynProps = dynamicDecimals ? { fractionDigits: value >= 1 ? 2 : 8 } : {}

  return <MyNumber value={value} {...rest} {...dynProps} {...symbolProps} />
}

export default FiatBalance
