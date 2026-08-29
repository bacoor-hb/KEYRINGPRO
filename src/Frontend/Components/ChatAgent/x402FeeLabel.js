import I18n, { resolveLocale } from 'assets/Lang'

/**
 * The user-facing price, e.g. "0.05 USDC on Base" — localized.
 *
 * Everything is settled in USDC on Base (see the spec's `x-guidance`), and the
 * prices are quoted in USD. The spec does not name the settlement token per
 * route, so the network/token half of the label is app-side copy, and app-side
 * copy is translated: `chatAgent.x402Settlement` carries the whole phrase per
 * locale, because word order around the amount is not the same in every
 * language (JP puts the network first, TR both).
 *
 * Built HERE rather than stored on the fee entry: the entry is fetched once and
 * cached for the session (`cacheTime: Infinity`), so a label baked in at fetch
 * time would be frozen in whatever language was active then. Formatting at
 * render time is what lets the same cached entry read correctly after a
 * language switch, and lets a chat turn carrying its own `language` print in
 * that language rather than the app's.
 *
 * @param {{amount: string}|null} [fee] The entry from the price list.
 * @param {string} [language] BCP-47 / app locale code for this turn. Omitted —
 *   as the suggestion pills do — it falls back to the app's current locale.
 * @returns {string|null} null when there is no fee, so callers can keep using
 *   the value as the "is this priced?" test.
 */
export const formatFeeLabel = (fee, language) => {
  if (!fee?.amount) return null
  return I18n.t('chatAgent.x402Settlement', {
    amount: fee.amount,
    locale: resolveLocale(language)
  })
}
