import BigNumber from 'bignumber.js'

/**
 * What an amount of a token is WORTH, in plain USD — `amount × price`, at full
 * precision — or `null` when there is nothing to value.
 *
 * The price is the one the CORE sent with the token (`usdPrice` on each side of
 * `SwapTokenFormProps`), read from the same wallet-balance row the spendable
 * figure came from. Nothing here fetches: the form values what it was handed,
 * and both the balance and the price are re-read together when the user taps
 * Refresh. See `SwapTokenForm/index.js` for why that pairing matters.
 *
 * Plain USD, deliberately: `FiatBalance` applies the user's rate and currency
 * symbol on top, so a value pre-multiplied here would be converted twice. It
 * rounds too, so nothing is rounded here.
 *
 * `null` covers BOTH "no price for this token" and "no amount yet", and the
 * caller renders it as NO LINE. That distinction is the point: an unpriced token
 * is not a worthless one, and captioning the amount a user is about to swap with
 * "$0.00" would state something false about it.
 *
 * @param {string|number} amount  Human amount, possibly half-typed ('', '.', '0.').
 * @param {string|number} price   USD price per whole token, or null/0 if unpriced.
 * @returns {string|null} Plain-USD value in decimal notation, or null.
 */
export const toUsd = (amount, price) => {
  if (!price) return null
  // BigNumber, not Number: these are token amounts at up to 18 decimals, and
  // float math on them is what this form exists to avoid.
  const n = BigNumber(amount || 0)
  // A half-typed amount is not a number to multiply. NaN.lte(0) is false, so
  // isFinite has to be the one that catches it — without it 'abc' × price would
  // paint 'NaN' where a price belongs.
  if (!n.isFinite() || n.lte(0)) return null
  // toFixed, NOT toString: BigNumber's toString switches to exponential
  // notation below 1e-7 ('1e-13'), and a dust-valued token would then hand that
  // string straight to the renderer. toFixed is always plain decimal — the same
  // reason the Exchange screen ends every one of its USD computations with it.
  return n.multipliedBy(price).toFixed()
}
