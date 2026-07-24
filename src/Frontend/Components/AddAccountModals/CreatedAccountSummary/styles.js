import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, fontSize, getSizeImgSquare, getFontFamily } from 'common/styles'

const styles = StyleSheet.create({
  // Layout (row + icon/title gap) comes from StatusMessage; keep only the top spacing.
  successHeader: {
    alignItems: 'center',
    paddingTop: pixelByHeight(8)
  },
  field: {
    paddingTop: pixelByHeight(14)
  },
  fieldValue: {
    color: Colors.WHITE
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12)
  },
  // Carries the divider so it stops at the value text and never extends under
  // the trailing action button.
  // minHeight reserves 2-line height so the single-line account-name row matches
  // the (2-line) address row — both rows stay the same height, dividers aligned.
  fieldMain: {
    flex: 1,
    minHeight: pixelByHeight(62),
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  // 40x40 black round button with a 1px BG_BOX_SMALL border (matches design).
  // Kept square so it stays a circle — MyButton's horizontal padding made it an
  // oval. fieldRow's alignItems:'center' centers it against fieldMain's height.
  fieldAction: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL
  },
  fieldInput: {
    color: Colors.WHITE,
    fontSize: fontSize('default'),
    lineHeight: fontSize('default') * 1.5,
    fontFamily: getFontFamily(),
    padding: 0
  }
})

export default styles
