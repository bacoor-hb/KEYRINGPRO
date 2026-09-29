import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText
// variants. Deliberately mirrors ConfirmAddLiquidityTx/styles.js so this card,
// though a standalone component, sits in the chat looking like every other
// confirm card.
const styles = StyleSheet.create({
  card: { marginTop: pixelByHeight(12) },

  // Boxed background around the confirmation summary + its confirm button only.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(15),
    padding: pixelByHeight(12),
    gap: pixelByHeight(14)
  },

  // Header block: title row + the divider under it, spaced as one unit.
  headerBlock: { gap: pixelByHeight(12) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: pixelByWidth(8) },
  headerTitle: { flex: 1 },
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

  // The pay / receive pair. Each side is its own boxed row, with the direction
  // arrow between them — the shape that says "this becomes that" at a glance,
  // rather than two anonymous summary rows.
  swapBlock: { gap: pixelByHeight(8) },
  sideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pixelByWidth(8),
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(10),
    borderRadius: pixelByWidth(12)
  },
  // Label sits above its amount, so a long amount gets the row's full width
  // rather than competing with the label for it.
  sideLabel: { marginBottom: pixelByHeight(2) },
  // Takes the row's free space so a long amount scrolls inside its ticker
  // instead of pushing the symbol off the row.
  sideAmount: { flex: 1 },
  sideSymbol: { maxWidth: pixelByWidth(120) },

  // The direction arrow between the two sides. Centred and given a fixed height
  // so the gap between the boxes never changes with the glyph's line box.
  arrowRow: { alignItems: 'center', justifyContent: 'center' },

  // Summary rows below the pair (rate, provider, network fee note).
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: pixelByWidth(8) },
  rowValue: { flex: 1, alignItems: 'flex-end' },

  // The estimate disclaimer under the receive side. Deliberately its own line
  // rather than a parenthetical on the amount: it applies to the whole quote.
  estimateNote: { marginTop: pixelByHeight(2) },

  // The x402 fee line + the confirm button, spaced as one block.
  submitBlock: { gap: pixelByHeight(8) },

  // The protocol explorer link under the swap hash (icon + label). Spaced off the
  // hash row above it the same way the hash row is spaced off the step title, so
  // the three lines of the Sending node read as one evenly-set block.
  protocolExplorerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(6),
    marginTop: pixelByHeight(8)
  },

  // Failure variant of the terminal result block.
  //
  // The success case reuses the shared timeline's `statusResult` directly, so it
  // stays pixel-identical to every other flow. Only a result with a SECOND line
  // needs its own: `StatusMessage` defaults its row to `flex-start`, which pins
  // the icon's top to the text's top — and the icon is taller than a single
  // title line, so it hangs below the words and reads as misaligned. Centring
  // aligns it to the middle of title + message together.
  statusResultWithMessage: { alignItems: 'center' }
})

export default styles
