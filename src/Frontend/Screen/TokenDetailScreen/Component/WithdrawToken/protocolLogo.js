import images from 'assets/Image'
import { PROTOCOL_LABELS, PROTOCOL_LOGO_KEYS } from 'common/constants/lending'

// The protocol logo and display name shown in the withdraw drawer's market
// header.
//
// Both are keyed on the market `type` the core resolves — the same field that
// selects the withdraw call, so it is the one identifier guaranteed to be present
// and exact for any market this flow can act on. `protocol` / `name` are display
// strings from the API and their casing is not guaranteed, which is why they are
// only a fallback.
//
// The type → logo and type → label tables come from `common/constants/lending`,
// so adding a protocol is one edit there rather than three scattered maps. This
// module only turns a logo KEY into the bundled image.
const logoFor = (type) => images.UIV2.icons.lending[PROTOCOL_LOGO_KEYS[type]] || null

// Fallback for a market whose `type` we have no image for — matched against the
// protocol NAME rather than the type, so a market the catalogue reports as e.g.
// 'aave-v2' still gets the Aave logo instead of dropping to the placeholder.
// Order matters only in that each key must not be a substring of another.
const LOGO_BY_NAME_FRAGMENT = [
  ['aave', images.UIV2.icons.lending.aave],
  ['compound', images.UIV2.icons.lending.compound],
  ['morpho', images.UIV2.icons.lending.morpho],
  ['spark', images.UIV2.icons.lending.spark],
  ['maple', images.UIV2.icons.lending.maple]
]

/**
 * Display name of a lending market's PROTOCOL — 'Aave V3', 'Spark',
 * 'Compound V3', 'Morpho V2'.
 *
 * Prefers core's own `protocolLabel`. Core derives it from `type` rather than
 * reusing `name` or `protocol`, neither of which is a protocol label: discovery
 * writes 'Aave v3' with a lowercase v, `protocol` is an upper-case enum
 * ('AAVE'), and a Morpho market's `name` is the VAULT's name ('Gauntlet USDC
 * Core') — kept that way upstream because the app URL's slug is built from it.
 *
 * @param   {object} lendingInfo Market metadata from `useGetLendingTokenInfo`.
 * @returns {string} The protocol's name, falling back to core's `name` /
 *                   `protocol` for a market family neither side labels, and ''
 *                   when the market carries none of them.
 */
export const getProtocolLabel = (lendingInfo) => {
  if (!lendingInfo) return ''
  return (
    lendingInfo.protocolLabel ||
    PROTOCOL_LABELS[lendingInfo.type] ||
    lendingInfo.name ||
    lendingInfo.protocol ||
    ''
  )
}

/**
 * Local logo for a lending market's protocol.
 *
 * @param   {object} lendingInfo Market metadata from `useGetLendingTokenInfo`.
 * @returns {number|null} A `require`d image source, or null when the protocol is
 *                        not one we ship an image for — callers fall back to the
 *                        token icon / placeholder rather than rendering a wrong
 *                        protocol's logo.
 */
export const getProtocolLogo = (lendingInfo) => {
  if (!lendingInfo) return null

  const byType = logoFor(lendingInfo.type)
  if (byType) return byType

  const haystack = `${lendingInfo.protocol || ''} ${lendingInfo.name || ''}`.toLowerCase()
  if (!haystack.trim()) return null

  const match = LOGO_BY_NAME_FRAGMENT.find(([fragment]) => haystack.includes(fragment))
  return match ? match[1] : null
}

export default getProtocolLogo
