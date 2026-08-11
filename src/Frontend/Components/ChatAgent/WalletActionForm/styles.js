import { StyleSheet } from 'react-native'
import { fontSize, pixelByHeight, pixelByWidth, Colors } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText
// variants. TextInput keeps fontSize here because it has no MyText equivalent.
// Spacing uses the design-pixel helpers (pixelByWidth / pixelByHeight) rather
// than the percentage-of-screen width()/height() helpers.

// How far an `interactive` liquid-glass surface may bulge outside its own bounds
// when pressed. Any scroller/box that clips must leave this much room around a
// glass child, or the press effect is visibly sliced off.
const GLASS_BLEED = pixelByWidth(6)

const styles = StyleSheet.create({
  card: { marginTop: pixelByHeight(12) },

  // Boxed background around the form + its submit button. Owns the spacing
  // between its top-level blocks (header / each field / submit) via `gap`, so
  // no child carries a vertical margin of its own.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(16),
    padding: pixelByHeight(12),
    gap: pixelByHeight(14)
  },

  // Header block: title row + the divider under it, spaced as one unit.
  headerBlock: { gap: pixelByHeight(12) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: pixelByWidth(8) },
  headerMeta: { flexDirection: 'row', gap: pixelByWidth(6), borderRadius: pixelByWidth(24) },
  tag: {
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(3),
    borderRadius: pixelByWidth(11),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090A'
  },

  divider: { height: pixelByHeight(1) },

  // One label + control pair. Internal spacing is the group's `gap`; the space
  // to the next block comes from formBox's gap.
  fieldGroup: { gap: pixelByHeight(8) },

  // A field's label row: the title, plus the amount field's "(~$X)" beside it.
  // Same spacing as the add-liquidity amount title, so the two forms read alike.
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(8) },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelByWidth(50),
    paddingHorizontal: pixelByWidth(12)
  },
  input: { flex: 1, fontSize: fontSize(16.5), paddingVertical: pixelByHeight(10) },
  // Address field wrapper. A long 0x address is multiline so it wraps instead of
  // scrolling off-screen; the box reserves a fixed two-line height up front so
  // wrapping never shifts the layout below it (mirrors SendToken's address box).
  // `alignItems: center` keeps a 1-line value centred and grows the text block
  // symmetrically as it wraps to the 2nd line. paddingVertical:0 here — the inner
  // spacing is owned by addressInput so the two lines fit without clipping.
  addressRow: {
    height: pixelByHeight(66),
    alignItems: 'center',
    paddingVertical: 0
  },
  // A field the agent resolved and the user can't edit. Dimmed so it reads as a
  // stated value rather than an input still waiting to be filled in.
  lockedInput: { opacity: 0.7 },

  addressInput: {
    flex: 1,
    fontSize: fontSize(16.5),
    // Auto-size to content (undefined cancels any inherited 100% height) so the
    // wrapper's center alignment can vertically centre the 1- or 2-line text.
    height: undefined,
    paddingVertical: pixelByHeight(8)
  },

  // Reserved space for an inline error so showing/hiding it never shifts the
  // layout; the message is positioned absolute inside the slot.
  errorSlot: { minHeight: pixelByHeight(14) * 1.5 },
  errorText: { position: 'absolute', top: 0, left: 0 },

  // Once the tx is submitted the form stops being something to act on — it's a
  // record of what was signed. Dimming it pushes it visually behind the status
  // timeline, which is where the user's attention belongs from then on.
  //
  // Safe to toggle opacity here only because `formBox` always carries a
  // backgroundColor: Fabric never flattens it, so it can't flip between
  // flattened/un-flattened mid mount-transaction (which is what crashes with
  // "Attempt to recycle a mounted view"). Keep that background if this moves.
  formBoxSubmitted: { opacity: 0.7 },

  // Quick-pick chips + the spendable line under the amount field, spaced as one
  // group so neither needs a margin of its own.
  amountExtras: { gap: pixelByHeight(8) },
  // "Spendable: <amount>" as a row rather than one wrapping sentence: the label
  // keeps its intrinsic width and the value takes the rest, so a long balance
  // scrolls inside the ticker instead of pushing the label off or wrapping.
  spendableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(4)
  },
  spendableValue: { flex: 1 },
  // The chips are `interactive` glass: pressing one makes the surface bulge
  // BEYOND its own bounds, and a ScrollView clips to its frame — so a chip flush
  // against the edge gets its press effect sliced off on all four sides. The
  // scroller is given room to overflow into (padding), then pulled back out by
  // an equal negative margin so the row occupies exactly the same space as
  // before. GLASS_BLEED is that overflow allowance.
  quickScroll: {
    flexGrow: 0,
    marginHorizontal: -GLASS_BLEED,
    marginVertical: -GLASS_BLEED
  },
  quickRow: {
    gap: pixelByWidth(8),
    paddingHorizontal: GLASS_BLEED,
    paddingVertical: GLASS_BLEED
  },
  quickChip: {
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(5),
    // Fully rounded: a radius past half the chip's height always renders as a
    // pill, whatever the text or font scale makes it.
    borderRadius: pixelByWidth(999),
    alignItems: 'center',
    justifyContent: 'center'
  },

  // The x402 fee line + the submit button, spaced as one block.
  submitBlock: { gap: pixelByHeight(8) },
  feeNotice: { textAlign: 'left' },
  submitBtnDisabled: { opacity: 0.45 }
})

export default styles
