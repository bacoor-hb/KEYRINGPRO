import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText variants.
// Mirrors AddLiquidityForm for a consistent look across the add-liquidity flow.
const styles = StyleSheet.create({
  card: {
    marginTop: pixelByHeight(12)
  },

  // Boxed background around the confirmation form + its confirm button only.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(15),
    padding: pixelByHeight(12),
    gap: pixelByHeight(14)
  },

  // Header block: title row + the divider under it, spaced as one unit.
  headerBlock: { gap: pixelByHeight(12) },
  poolHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poolMeta: { flexDirection: 'row', gap: pixelByWidth(6), borderRadius: pixelByWidth(24) },
  tag: { paddingHorizontal: pixelByWidth(12), paddingVertical: pixelByHeight(3), borderRadius: pixelByWidth(11), alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090A' },

  divider: {
    height: pixelByHeight(1)
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: pixelByWidth(8) },

  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rangeItem: { alignItems: 'center', flex: 1 },
  rangeValue: { marginTop: pixelByHeight(2) },
  rangeSep: { paddingHorizontal: pixelByWidth(8) },

  // The x402 fee line + the confirm button, spaced as one block.
  submitBlock: { gap: pixelByHeight(8) }
})

export default styles
