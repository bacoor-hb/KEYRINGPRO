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
    borderRadius: pixelByWidth(16),
    padding: pixelByHeight(12)
  },
  poolHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poolMeta: { flexDirection: 'row', gap: pixelByWidth(6), paddingVertical: pixelByWidth(4), borderRadius: pixelByWidth(999) },
  tag: { paddingHorizontal: pixelByWidth(10), paddingVertical: pixelByWidth(4), borderRadius: pixelByWidth(12), alignItems: 'center', justifyContent: 'center' },

  divider: { height: 1, marginVertical: pixelByHeight(8) },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: pixelByHeight(8), flex: 1 },
  rowLabel: { },
  rowValue: {
  },

  sectionTitle: { },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: pixelByHeight(8) },
  rangeItem: { alignItems: 'center', flex: 1 },
  rangeValue: { marginTop: pixelByHeight(2) },
  rangeSep: { paddingHorizontal: pixelByWidth(8) },

  ctaWrap: { marginTop: pixelByHeight(8) }
})

export default styles
