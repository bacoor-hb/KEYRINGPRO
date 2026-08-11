import { StyleSheet } from 'react-native'
import { fontSize, pixelByHeight, pixelByWidth, Colors } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText variants.
// TextInput keeps fontSize here because it has no MyText variant equivalent.

// How far an `interactive` liquid-glass surface may bulge outside its own bounds
// when pressed. Any scroller/box that clips must leave this much room around a
// glass child, or the press effect is visibly sliced off.
const GLASS_BLEED = pixelByWidth(6)

const styles = StyleSheet.create({
  card: {

    marginTop: pixelByHeight(12)

  },

  poolHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poolMeta: { flexDirection: 'row', gap: pixelByWidth(6), borderRadius: pixelByWidth(24) },
  tag: { paddingHorizontal: pixelByWidth(12), paddingVertical: pixelByHeight(3), borderRadius: pixelByWidth(11), alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090A' },

  divider: {
    height: pixelByHeight(1)
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  rangeRowLabel: { width: pixelByWidth(40) },
  rangeRowInput: {
    flex: 1,
    borderRadius: pixelByWidth(188),
    paddingHorizontal: pixelByWidth(11),
    paddingVertical: pixelByHeight(3)

  },
  rangeRowInputText: { fontSize: fontSize('small'), paddingVertical: pixelByHeight(6) },
  rangeArrow: { paddingHorizontal: pixelByWidth(2) },
  rateChip: {
    borderRadius: pixelByWidth(188),
    paddingHorizontal: pixelByWidth(8),
    paddingVertical: pixelByHeight(3),
    width: pixelByWidth(68),
    alignItems: 'center'

  },
  rateChipText: {
    fontSize: fontSize('small'),
    paddingVertical: pixelByHeight(6),
    textAlign: 'center',
    width: '100%'
  },
  // Reserved space for an inline error so showing/hiding it doesn't shift the
  // layout; the message is positioned absolute inside the slot.
  errorSlot: { minHeight: pixelByHeight(16.5) },
  errorText: { position: 'absolute', top: 0, left: pixelByWidth(0), right: pixelByWidth(4) },

  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: pixelByWidth(188), paddingHorizontal: pixelByWidth(11), marginBottom: pixelByHeight(3) },
  amountInput: { flex: 1, fontSize: fontSize(18), paddingVertical: pixelByHeight(10) },

  // The chips are `interactive` glass: pressing one makes the surface bulge
  // BEYOND its own bounds, and a ScrollView clips to its frame — so a chip flush
  // against the edge gets its press effect sliced off on all four sides. The
  // scroller is given room to overflow into (padding), then pulled back out by
  // an equal negative margin so the row occupies exactly the same space as
  // before. GLASS_BLEED is that overflow allowance; the vertical padding keeps
  // its original 4 on top of it.
  quickScroll: {
    flexGrow: 0,
    marginHorizontal: -GLASS_BLEED,
    marginVertical: -GLASS_BLEED
  },
  quickRow: {
    gap: pixelByWidth(8),
    paddingHorizontal: GLASS_BLEED,
    paddingVertical: pixelByHeight(4) + GLASS_BLEED
  },
  // Fully rounded: a radius past half the chip's height always renders as a
  // pill, whatever the text or font scale makes it.
  quickChip: { paddingHorizontal: pixelByWidth(11), paddingVertical: pixelByHeight(5), borderRadius: pixelByWidth(999), alignItems: 'center', justifyContent: 'center' },

  // "Spendable: <amount>" as a row rather than one wrapping sentence: the label
  // keeps its intrinsic width and the value takes the rest, so a long balance
  // scrolls inside the ticker instead of pushing the label off or wrapping.
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(4)
  },
  spendableValue: { flex: 1 },

  alertBox: { borderRadius: pixelByWidth(8), marginBottom: pixelByHeight(8) },

  submitBtnWrap: { marginTop: pixelByHeight(4) },
  submitBtnDisabled: { opacity: 0.45 },
  // Boxed background around the confirmation form + its confirm button only.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(15),
    padding: pixelByHeight(12),
    gap: pixelByHeight(14)
  }
})

export default styles
