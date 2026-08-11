import { StyleSheet } from 'react-native'
import { Colors, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  // Content-fit drawer body: no fixed height anywhere, so BottomSheetView
  // measures whatever this renders and the sheet grows/shrinks to match.
  container: {
    paddingBottom: getSafeAreaValues().bottom,
    gap: pixelByHeight(12)
  },
  // The amount line: token icon on the left, the quantity as the one big number
  // beside it — left-aligned, reading as a statement rather than a form field.
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(14)
  },
  // flex + shrink so a long quantity truncates instead of pushing past the icon.
  amountText: {
    flex: 1
  },
  // "Spendable: 5,254.94 USDC" — sits directly under the amount it qualifies.
  spendableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: pixelByWidth(6)
  },
  // A balance that doesn't cover the price is called out in red, so the shortfall
  // shows on the figure itself and not only in the message below.
  textError: {
    color: Colors.RED
  },
  errorText: {
    color: Colors.RED
  },
  buttons: {
    flexDirection: 'row',
    gap: pixelByWidth(14),
    marginTop: pixelByHeight(4)
  }
})

export default styles
