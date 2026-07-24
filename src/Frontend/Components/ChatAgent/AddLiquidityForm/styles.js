import { StyleSheet } from 'react-native'
import { width, height, fontSize, pixelByHeight, Colors } from 'common/styles'

// Layout only — colors live in Tailwind className, text sizing in MyText variants.
// TextInput keeps fontSize here because it has no MyText variant equivalent.
const styles = StyleSheet.create({
  card: {

    marginTop: pixelByHeight(12)

  },

  poolHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  poolMeta: { flexDirection: 'row', gap: width(1.5), paddingVertical: width(0.8), borderRadius: width(50) },
  tag: { paddingHorizontal: width(2.5), paddingVertical: width(0.8), borderRadius: width(3), alignItems: 'center', justifyContent: 'center' },

  divider: { height: 1, marginVertical: height(1) },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: height(0.8) },

  sectionTitle: { marginTop: height(1.2), marginBottom: height(0.8) },

  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: height(0.8),
    gap: width(2)
  },
  rangeRowLabel: { width: width(8) },
  rangeRowInput: {
    flex: 1,
    borderRadius: width(50),
    paddingHorizontal: width(3),
    paddingVertical: height(0.4)

  },
  rangeRowInputText: { fontSize: fontSize('small'), paddingVertical: height(0.8) },
  rangeArrow: { paddingHorizontal: width(0.5) },
  rateChip: {
    borderRadius: width(50),
    paddingHorizontal: width(2),
    paddingVertical: height(0.4),
    width: width(18),
    alignItems: 'center'

  },
  rateChipText: {
    fontSize: fontSize('small'),
    paddingVertical: height(0.8),
    textAlign: 'center',
    width: '100%'
  },
  // Reserved space for an inline error so showing/hiding it doesn't shift the
  // layout; the message is positioned absolute inside the slot.
  errorSlot: { minHeight: pixelByHeight(20) },
  errorText: { position: 'absolute', top: 0, left: width(1), right: width(1) },

  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: width(50), paddingHorizontal: width(3), marginBottom: height(0.4) },
  amountInput: { flex: 1, fontSize: fontSize(18), paddingVertical: height(1.2) },
  usdHint: { marginBottom: height(0.8), paddingLeft: width(1) },

  quickRow: { paddingVertical: height(0.5), gap: width(2), marginBottom: height(0.5) },
  quickChip: { paddingHorizontal: width(3), paddingVertical: height(0.6), borderRadius: width(3), alignItems: 'center', justifyContent: 'center' },

  balanceRow: { marginBottom: height(1) },

  alertBox: { borderRadius: width(2), marginBottom: height(1) },

  submitBtnWrap: { marginTop: height(0.5) },
  submitBtn: { borderRadius: width(50), paddingVertical: height(1.6), alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { opacity: 0.45 },
  // Boxed background around the confirmation form + its confirm button only.
  // Boxed background around the confirmation form + its confirm button only.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: width(4),
    padding: pixelByHeight(12)
  }
})

export default styles
