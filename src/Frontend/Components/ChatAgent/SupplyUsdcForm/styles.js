import { StyleSheet } from 'react-native'
import { Colors, fontSize, pixelByHeight, pixelByWidth } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText
// variants. TextInput keeps fontSize here because it has no MyText equivalent.
// Deliberately mirrors WalletActionForm/styles.js so this card, though it is a
// standalone component, sits in the chat looking like every other action card.

// How far an `interactive` liquid-glass surface may bulge outside its own bounds
// when pressed. Any scroller/box that clips must leave this much room around a
// glass child, or the press effect is visibly sliced off.
const GLASS_BLEED = pixelByWidth(6)

const styles = StyleSheet.create({
  card: { marginTop: pixelByHeight(12) },

  // Owns the spacing between its top-level blocks (header / each field group /
  // submit) via `gap`, so no child carries a vertical margin of its own.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(16),
    padding: pixelByHeight(12),
    gap: pixelByHeight(14)
  },
  // Dimmed once the supply has settled — the card becomes a record of what
  // was sent rather than an input.
  formBoxSubmitted: { opacity: 0.7 },

  // Header block: title row + the divider under it, spaced as one unit.
  headerBlock: { gap: pixelByHeight(12) },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pixelByWidth(8)
  },
  headerTitle: { flex: 1 },
  headerMeta: {
    flexDirection: 'row',
    gap: pixelByWidth(6),
    borderRadius: pixelByWidth(24)
  },
  tag: {
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(3),
    borderRadius: pixelByWidth(11),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090A'
  },

  divider: { height: pixelByHeight(1) },

  // Same field rhythm as WalletActionForm: one label + control pair per group,
  // spaced by the group's own `gap`. The space to the next block comes from
  // formBox's gap, so nothing here needs a margin.
  fieldGroup: { gap: pixelByHeight(8) },

  // The market contract the supply is approved to and sent to. A stated value
  // rather than an input, but it shares the pill shape of the fields around it.
  contractBox: {
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(10),
    borderRadius: pixelByWidth(50)
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8),
    borderRadius: pixelByWidth(50),
    paddingHorizontal: pixelByWidth(12)
  },
  input: { flex: 1, fontSize: fontSize(16.5), paddingVertical: pixelByHeight(10) },

  // Reserved space for an inline error so showing/hiding it never shifts the
  // layout; the message is positioned absolute inside the slot (same as
  // WalletActionForm).
  errorSlot: { minHeight: pixelByHeight(20) },
  errorText: { position: 'absolute', top: 0, left: pixelByWidth(4), right: pixelByWidth(4) },

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
  // an equal negative margin so the row still lines up with the content around
  // it. GLASS_BLEED is that overflow allowance.
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

  // "Est. Received" value row.
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pixelByWidth(8),
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(10),
    borderRadius: pixelByWidth(50)
  },

  // "Est. Earnings" — APY + projected yearly yield. Two stacked rows, so this
  // one keeps a rounded-rect (not pill) shape; the pill radius is for the
  // single-line fields.
  earningsBox: {
    gap: pixelByHeight(8)
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pixelByWidth(8)
  },

  // The x402 fee line + the submit button, spaced as one block.
  submitBlock: { gap: pixelByHeight(8) },
  feeNotice: { textAlign: 'left' },
  submitBtnDisabled: { opacity: 0.45 },

  // Failure variant of the terminal result block.
  //
  // The success case reuses the shared timeline's `statusResult` directly, so it
  // stays pixel-identical to every other flow. Only the failure case needs its
  // own, because it is the only one with a second line: "Failed" carries the
  // reason underneath it.
  //
  // `StatusMessage` defaults its row to `flex-start`, which pins the icon's TOP
  // to the text's top — and the icon is taller than a single title line, so it
  // hung below the words and read as misaligned. Centring aligns it to the
  // middle of title + reason together, so the two are one balanced block.
  //
  // Note this means a long reason (a wordy error, a narrow screen, a
  // translation that wraps) lowers the icon with it, since the block it is
  // centred against grows taller.
  statusResultWithMessage: { alignItems: 'center' }
})

export default styles
