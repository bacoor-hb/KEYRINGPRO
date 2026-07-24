import { StyleSheet } from 'react-native'
import { Colors, width, height, pixelByHeight } from 'common/styles'

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderTopLeftRadius: width(5),
    borderTopRightRadius: width(5),
    padding: width(5),
    paddingBottom: height(4)
  },
  title: { marginBottom: height(1) },
  subtitle: { marginBottom: height(2) },
  divider: { height: 1, marginVertical: height(1.2) },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: height(1) },
  rowLabel: { flex: 1 },
  rowValue: { flex: 1.4, textAlign: 'right' },
  amount: { marginTop: height(0.5), marginBottom: height(1.5) },
  ctaWrap: { marginTop: height(2) },
  payingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: width(2), marginTop: height(2) },
  errorText: { marginTop: height(1) },
  cancel: { alignItems: 'center', marginTop: height(1.5), paddingVertical: pixelByHeight(8) }
})

export default styles
