import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, width, fontSize, getSafeAreaValues } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width(100),
    paddingBottom: getSafeAreaValues().bottom
  },
  fileName: {
    color: Colors.TEXT_MEDIUM,
    fontSize: fontSize('small'),
    marginTop: pixelByHeight(12),
    marginBottom: pixelByHeight(4),
    textAlign: 'center'
  },
  passwordRow: {
    gap: pixelByHeight(14)
    // paddingTop: pixelByHeight(16)
    // paddingBottom: pixelByHeight(4)
  },
  passwordInput: {
    width: width(100)
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12)
    // paddingTop: pixelByHeight(14 - 4)// gap: pixelByHeight(4) in MyInput
  },

  warningContent: {
    flex: 1
  },
  warningTitle: {
    fontSize: fontSize(15),
    marginBottom: pixelByHeight(4)
  },
  warningDesc: {
    fontSize: fontSize('small'),
    lineHeight: pixelByHeight(20)
  },
  // Vertically center the icon against the title block (StatusMessage defaults to
  // flex-start, which leaves the icon clinging to the top).
  successStatus: {
    alignItems: 'center',
    paddingTop: pixelByHeight(8)
  },
  errorStatus: {
    alignItems: 'center',
    paddingTop: pixelByHeight(8)
  },
  fileErrorText: {
    color: Colors.RED_TEXT,
    fontSize: fontSize('small'),
    marginTop: pixelByHeight(12)
  }
})

export default styles
