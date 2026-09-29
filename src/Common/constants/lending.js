/**
 * Lending protocols: every name, and what the app may do with each.
 *
 * ONE source of truth for the protocol vocabulary that used to live in three
 * places — the withdraw drawer's ABI module, the token screen's field resolver,
 * and the logo map. Adding a protocol now means editing {@link LENDING_PROTOCOLS}
 * below and nothing else; the derived lists rebuild themselves.
 *
 * ## The two vocabularies
 *
 * A lending position is named by two independent backends, and they are NOT the
 * same contract:
 *
 * - `apiTag` — what the TOKEN API puts in a token's `yieldProtocol` /
 *   `yieldProtocolV2` field.
 * - `marketType` — what CORE's `LendingService` reports as `market.type` for a
 *   resolved market.
 *
 * They use identical spellings today, which is exactly why they are written out
 * separately here rather than one deriving from the other: a rename on either
 * side would otherwise propagate silently and break the other consumer. Keeping
 * both columns visible in one table means a divergence is a one-line edit that
 * says which side moved, and `capabilities.test.js` asserts they stay aligned.
 *
 * ## Capabilities
 *
 * `logoKey` names the image under `images.UIV2.icons.lending` — several market
 * types share one mark (the two Spark deployments are one protocol), which is
 * why it is its own field rather than derived from `id`.
 *
 * `canWithdraw` says whether `buildWithdrawTx` has a branch that can encode this
 * protocol's exit. It is a statement about THIS APP's code, not about the
 * protocol: Maple is a perfectly ordinary ERC-4626 pool, but exiting a Syrup
 * position is a queued `requestRedeem` that settles hours to days later, which
 * the withdraw drawer — built to sign one immediately-settling transaction —
 * cannot represent. So Maple displays in full (balance, APY, market size, logo)
 * with no withdraw row.
 *
 * A protocol absent from this table entirely is treated as a plain ERC-20: no APY
 * card, no market lookup, no withdraw row, just the ordinary price chart. That is
 * the conservative direction — an unknown protocol has no withdraw branch and
 * usually no APY series either, so rendering the token normally beats rendering
 * an empty card above a dead button.
 */

/**
 * Every lending protocol this app recognises.
 *
 * To add one: append an entry, then give `buildWithdrawTx` a branch if
 * `canWithdraw` is true, and add a logo in `WithdrawToken/protocolLogo.js`.
 */
export const LENDING_PROTOCOLS = [
  {
    id: 'aave-v3',
    apiTag: 'aave-v3',
    marketType: 'aave-v3',
    label: 'Aave V3',
    logoKey: 'aave',
    canWithdraw: true
  },
  {
    id: 'compound-v3',
    apiTag: 'compound-v3',
    marketType: 'compound-v3',
    label: 'Compound V3',
    logoKey: 'compound',
    canWithdraw: true
  },
  {
    id: 'spark',
    apiTag: 'spark',
    marketType: 'spark',
    label: 'Spark',
    logoKey: 'spark',
    canWithdraw: true
  },
  {
    id: 'spark-ethereum',
    apiTag: 'spark-ethereum',
    marketType: 'spark-ethereum',
    label: 'Spark',
    logoKey: 'spark',
    canWithdraw: true
  },
  {
    id: 'morpho-v2',
    apiTag: 'morpho-v2',
    marketType: 'morpho-v2',
    label: 'Morpho V2',
    logoKey: 'morpho',
    canWithdraw: true
  },
  {
    // Cross-chain sUSDS on an L2: share-based like a vault but NOT ERC-4626, and
    // it exits through a PSM3 swap rather than a redemption. Both differences are
    // handled inside the withdraw flow — see ORACLE_PRICED_TYPES in its abis.
    id: 'spark-l2-susds',
    apiTag: 'spark-l2-susds',
    marketType: 'spark-l2-susds',
    label: 'Spark',
    logoKey: 'spark',
    canWithdraw: true
  },
  {
    // Shown, never exited. See the capabilities note above.
    id: 'maple',
    apiTag: 'maple',
    marketType: 'maple',
    label: 'Maple',
    logoKey: 'maple',
    canWithdraw: false
  }
]

/** Every protocol tag the TOKEN API may send that this app recognises. */
export const KNOWN_PROTOCOL_TAGS = LENDING_PROTOCOLS.map((p) => p.apiTag)

/** Token-API tags whose position this app can withdraw from. */
export const WITHDRAWABLE_PROTOCOL_TAGS = LENDING_PROTOCOLS
  .filter((p) => p.canWithdraw)
  .map((p) => p.apiTag)

/** Token-API tags whose position this app shows but cannot exit. */
export const VIEW_ONLY_PROTOCOL_TAGS = LENDING_PROTOCOLS
  .filter((p) => !p.canWithdraw)
  .map((p) => p.apiTag)

/** CORE `market.type` values `buildWithdrawTx` has a branch for. */
export const ENCODABLE_MARKET_TYPES = LENDING_PROTOCOLS
  .filter((p) => p.canWithdraw)
  .map((p) => p.marketType)

/** CORE `market.type` values shown but never withdrawn from. */
export const VIEW_ONLY_MARKET_TYPES = LENDING_PROTOCOLS
  .filter((p) => !p.canWithdraw)
  .map((p) => p.marketType)

/** Logo keys into `images.UIV2.icons.lending`, keyed by `market.type`. */
export const PROTOCOL_LOGO_KEYS = LENDING_PROTOCOLS.reduce((acc, p) => {
  acc[p.marketType] = p.logoKey
  return acc
}, {})

/** Display names, keyed by `market.type`. */
export const PROTOCOL_LABELS = LENDING_PROTOCOLS.reduce((acc, p) => {
  acc[p.marketType] = p.label
  return acc
}, {})

/**
 * The token-API field carrying a newer protocol — agreed with the backend as
 * `yieldProtocolV2`.
 *
 * Named rather than written inline so the two field names sit side by side here,
 * and so a rename is one edit instead of a grep. The pair is read in order by
 * {@link resolveApiYieldProtocol} below — the only place either name is consumed,
 * which is what keeps the two-field split from spreading through the pipeline.
 *
 * The field is not being served yet; until it ships every read is `undefined`,
 * which resolution treats as absent — so this is safe to land ahead of the
 * backend, and Maple starts appearing the day it goes live.
 */
export const NEW_PROTOCOL_FIELD = 'yieldProtocolV2'

/** The token-API field that has always carried a protocol tag. */
export const LEGACY_PROTOCOL_FIELD = 'yieldProtocol'

/**
 * The protocol tag a raw TOKEN API entry (or a stored token) carries, out of the
 * two fields it can arrive in — `yieldProtocolV2` first, then `yieldProtocol`.
 *
 * Lives here, next to the field names, because it must run at every point where
 * an API entry becomes a token: the refresh pipeline (`TokenListV2`) and the
 * manual add drawer both persist a SINGLE `yieldProtocol` field, and everything
 * downstream — core's share-based conversion, the withdraw drawer, the detail
 * screen — reads that one field. Resolving only on the detail screen would leave
 * a Maple position untagged in Redux: valued in shares, with no APY card on a
 * token the user reopened from the list.
 *
 * Returns `undefined` when NEITHER field is present, preserving the pipeline's
 * three-state distinction (`undefined` = never answered and re-asked later,
 * `null` = answered "not a vault"). An entry that answers either field with an
 * explicit null therefore reads as answered, exactly as before this existed.
 *
 * No allow-list filtering here — that is the screen's job
 * (`resolveYieldProtocol`), which decides what this APP can render and act on.
 * Storing the raw tag keeps an unrecognised protocol visible to a later build
 * without a re-fetch.
 */
export const resolveApiYieldProtocol = (entry) => {
  if (!entry) return undefined
  const next = entry[NEW_PROTOCOL_FIELD]
  if (next !== undefined && next !== null) return next
  const legacy = entry[LEGACY_PROTOCOL_FIELD]
  if (legacy !== undefined && legacy !== null) return legacy
  // Neither field carried a tag. An explicit null on either side is still an
  // answer ("not a vault"); only both-absent stays unanswered.
  return next === null || legacy === null ? null : undefined
}

/**
 * The underlying a yield token is denominated in, as `{ address, decimals,
 * fixedPrice }` — the shape keyring-agent-core's valuation reads.
 *
 * Two API shapes, newest first:
 * - `newConfig.yieldInfo` — `{ assetToken, assetDecimals, assetFixedPrice? }`
 * - `yieldAsset` — the legacy `{ address, decimals, fixedPrice? }`, also what a
 *   stored token carries (it is persisted already normalized).
 *
 * `fixedPrice` (optional) values ONE unit of the underlying at a fixed rate —
 * the API sends `1` for USDC — and outranks the underlying's market price.
 */
export const resolveApiYieldAsset = (entry) => {
  const info = entry?.newConfig?.yieldInfo
  if (info?.assetToken) {
    return {
      address: String(info.assetToken).toLowerCase(),
      decimals: info.assetDecimals,
      fixedPrice: info.assetFixedPrice ?? null
    }
  }
  return entry?.yieldAsset
}
