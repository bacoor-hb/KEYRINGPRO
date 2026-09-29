import { PixelRatio, StyleSheet } from 'react-native'
import { fontSize, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  // System font-size setting scales the actual rendered text (allowFontScaling
  // defaults to true), but fontSize() returns fixed logical sizes. Multiply the
  // fontSize-based reserved heights by the same scale so the reserved space keeps
  // matching the real text height and the buttons don't shift when text scales.
  const fontScale = PixelRatio.getFontScale()
  // Action icons (info / edit) are 44px round buttons. They are TALLER than the
  // label text next to them, so they — not the text — drive the height of the row
  // they sit in. The reserved-height math below has to use this same value.
  const actionIconSize = getSizeImgSquare('large')
  return StyleSheet.create({
    // Outer wrapper is inset to the card edges and carries the bottom divider,
    // so the divider lines up with the card (not the screen edges).
    wrapper: {
      marginHorizontal: pixelByWidth(16),
      paddingBottom: pixelByHeight(14)
    },
    card: {
      borderRadius: pixelByWidth(16),
      paddingHorizontal: pixelByWidth(12),
      paddingVertical: pixelByHeight(12),
      gap: pixelByHeight(14)
    },
    // Timestamp + address stack on the left, info icon alone on the right.
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    // flex:1 so the column takes the width left over by the info icon and the
    // address truncates against the real remaining space.
    headerTextColumn: {
      flex: 1,
      gap: pixelByHeight(4)
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(4)
    },
    body: {
      gap: pixelByHeight(4)
    },
    // Top of the body: the method name and the "Spending cap" label stack in a
    // column on the left, with the edit icon standing alone on the right, centered
    // against BOTH lines.
    methodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    // Applied only while the spending-cap block is reserved or showing. The row's
    // natural height is the text column (two lines), which is taller than the 44px
    // icon at our shipped font sizes — but at the smallest accessibility scales the
    // icon wins, and it only mounts once the data lands. Flooring the row at the
    // icon height keeps that arrival from growing the row and nudging the buttons.
    methodRowReserved: {
      minHeight: actionIconSize
    },
    // Left column of the method row. flex:1 so it takes the width left over by the
    // edit icon and the method-name ticker measures against the real remaining space.
    methodTextColumn: {
      flex: 1,
      gap: pixelByHeight(4)
    },
    // The "Spending cap" label (variant small, 14) is the column's second line. Hold
    // its exact scaled line height open while loading so the column is already two
    // lines tall before the text arrives.
    spendingCapLabelReserved: {
      height: fontSize(14) * 1.5 * fontScale
    },
    // Amount/symbol row (default variant, 16.5) sits below the method row at full
    // width. Reserved on the same flag as the label, plus 2px slack.
    //
    // The floor is sized in the SAME fontSize() units as the content's line height,
    // multiplied by fontScale so it tracks the system-scaled text (see fontScale note
    // above); the slack is layout pixels and stays fixed. A plain pixelByHeight()
    // floor scaled by a DIFFERENT ratio than the fontSize-based content, so on some
    // devices the content was ~1px taller than the floor and nudged the buttons down.
    // minHeight (not height) still lets it grow if the amount text ever wraps.
    amountReserved: {
      minHeight: fontSize(16.5) * 1.5 * fontScale + pixelByHeight(2)
    },
    // The method name (MyTextTicker, default variant) renders at line height
    // fontSize(16.5) * 1.5, scaled by the system font setting. Reserve that EXACT
    // (scaled) height here so swapping the loading dots -> method-name text doesn't
    // grow the row and nudge the buttons below down. (loadingDots alone is
    // fontSize(15) * 1.5, ~2px shorter.)
    methodLoadingRow: {
      height: fontSize(16.5) * 1.5 * fontScale,
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8)
    },
    icon44: {
      width: actionIconSize,
      height: actionIconSize
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(4)
    },
    tokenIcon: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      borderRadius: getSizeImgSquare('small')
    },
    amountText: {
      flex: 1
    },
    buttons: {
      flexDirection: 'row',
      gap: pixelByWidth(14)
    },
    loadingDots: {
      width: fontSize(15) * 1.5,
      height: fontSize(15) * 1.5
    }
  })
}

export default createStyles
