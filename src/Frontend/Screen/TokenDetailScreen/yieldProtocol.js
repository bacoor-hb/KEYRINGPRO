import {
  KNOWN_PROTOCOL_TAGS,
  WITHDRAWABLE_PROTOCOL_TAGS,
  NEW_PROTOCOL_FIELD,
  LEGACY_PROTOCOL_FIELD
} from 'common/constants/lending'

/**
 * Resolves the ONE protocol a token's lending position is described by, out of
 * the two fields the token API can carry it in.
 *
 * - `yieldProtocol` — the protocols this app has always handled: Aave, Compound,
 *   Spark and Morpho.
 * - `yieldProtocolV2` — protocols added since. Maple is the only one today.
 *
 * Everything downstream — the APY card, the market lookup, the withdraw row —
 * reads the single resolved value from {@link resolveYieldProtocol}, never a
 * field directly. That is what keeps the two-field split contained here: when the
 * API eventually settles on one field, or adds a third, only this module changes.
 *
 * The FIELD does not decide what may be done with the position. `yieldProtocolV2`
 * is simply where newer protocols arrive; whether one can be exited is a property
 * of the protocol itself, declared by `canWithdraw` in `common/constants/lending`.
 * Maple happens to be view-only, but a future entry in that same field may well be
 * withdrawable.
 *
 * The protocol names themselves live in that constants module, not here — this
 * file owns only the resolution rules.
 */

/**
 * `value` as a member of `allowed`, or null.
 *
 * Matching is case-insensitive but the ORIGINAL string is returned: the tag
 * travels onward to label the position, so normalising it here would rewrite API
 * data for every consumer.
 *
 * EXACT membership, never a prefix or substring test — a protocol merely named
 * like a supported one ('aave-v3-fork') must not inherit its handling. Non-string
 * and blank values are rejected outright, so an empty tag never reads as a
 * position and puts an APY card on a plain token.
 */
const matchProtocol = (value, allowed) => {
  if (typeof value !== 'string' || !value.trim()) return null
  return allowed.includes(value.toLowerCase()) ? value : null
}

/**
 * The single protocol this token's position is described by, or null for a plain
 * token.
 *
 * `yieldProtocolV2` is checked FIRST: it is the field the API is migrating to,
 * so when a token carries both it holds the newer, more accurate answer and the
 * legacy field is the stale one. Falling back the other way would pin such a
 * token to whatever its old tag said.
 */
export const resolveYieldProtocol = (token) =>
  matchProtocol(token?.[NEW_PROTOCOL_FIELD], KNOWN_PROTOCOL_TAGS) ||
  matchProtocol(token?.[LEGACY_PROTOCOL_FIELD], KNOWN_PROTOCOL_TAGS)

/**
 * Whether the withdraw row may be offered for the resolved protocol.
 *
 * Takes the RESOLVED value rather than the token, so the row can never be gated
 * on a different protocol than the one the rest of the screen is showing.
 *
 * False for Maple, and for any protocol whose exit this app cannot encode. The
 * row is then not rendered at all rather than rendered dimmed: no amount the user
 * could enter would make a dimmed control usable, and a dead control reads as a
 * broken screen rather than an unsupported action.
 */
export const canWithdrawFromProtocol = (yieldProtocol) =>
  !!matchProtocol(yieldProtocol, WITHDRAWABLE_PROTOCOL_TAGS)
