import { StyleSheet } from 'react-native'
import { fontSize, pixelByHeight, pixelByWidth, Colors } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText
// variants. TextInput keeps fontSize here because it has no MyText equivalent.
// Spacing uses the design-pixel helpers (pixelByWidth / pixelByHeight) rather
// than the percentage-of-screen width()/height() helpers.
const styles = StyleSheet.create({
  card: { marginTop: pixelByHeight(12) },

  // Boxed background around the form + its submit button.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(16),
    padding: pixelByHeight(12)
  },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerMeta: { flexDirection: 'row', gap: pixelByWidth(6), paddingVertical: pixelByHeight(3), borderRadius: pixelByWidth(50) },
  tag: {
    paddingHorizontal: pixelByWidth(10),
    paddingVertical: pixelByHeight(3),
    borderRadius: pixelByWidth(12),
    alignItems: 'center',
    justifyContent: 'center'
  },

  divider: { height: 1, marginVertical: pixelByHeight(8) },

  fieldLabel: { marginTop: pixelByHeight(10), marginBottom: pixelByHeight(6) },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: pixelByWidth(50),
    paddingHorizontal: pixelByWidth(12),
    marginBottom: pixelByHeight(3)
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
  errorSlot: { minHeight: pixelByHeight(20) },
  errorText: { position: 'absolute', top: 0, left: pixelByWidth(4), right: pixelByWidth(4) },

  // Once the tx is submitted the form stops being something to act on — it's a
  // record of what was signed. Dimming it pushes it visually behind the status
  // timeline, which is where the user's attention belongs from then on.
  //
  // Safe to toggle opacity here only because `formBox` always carries a
  // backgroundColor: Fabric never flattens it, so it can't flip between
  // flattened/un-flattened mid mount-transaction (which is what crashes with
  // "Attempt to recycle a mounted view"). Keep that background if this moves.
  formBoxSubmitted: { opacity: 0.5 },

  quickRow: { paddingVertical: pixelByHeight(4), gap: pixelByWidth(8), marginBottom: pixelByHeight(4) },
  quickChip: {
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(5),
    borderRadius: pixelByWidth(12),
    alignItems: 'center',
    justifyContent: 'center'
  },

  balanceRow: { marginBottom: pixelByHeight(8) },

  submitBtnWrap: { marginTop: pixelByHeight(14) },
  submitBtnDisabled: { opacity: 0.45 }
})

export default styles
