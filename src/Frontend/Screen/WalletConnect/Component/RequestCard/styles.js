import { PixelRatio, StyleSheet } from 'react-native'
import { fontSize, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  // System font-size setting scales the actual rendered text (allowFontScaling
  // defaults to true), but fontSize() returns fixed logical sizes. Multiply the
  // fontSize-based reserved heights by the same scale so the reserved space keeps
  // matching the real text height and the buttons don't shift when text scales.
  const fontScale = PixelRatio.getFontScale()
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
    header: {
      gap: pixelByHeight(4)
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(4)
    },
    body: {
      gap: pixelByHeight(4)
    },
    // Reserves space for the spending-cap rows so they don't push the buttons
    // down when they pop in after token info loads. The floor is sized in the SAME
    // fontSize() units as the content's line heights — row1 = "Spending cap" label
    // (variant small, 14) + row2 = amount/symbol (default, 16.5) + the 4px gap,
    // plus 2px slack. The two font terms are multiplied by fontScale so the floor
    // tracks the system-scaled text height (see fontScale note above); the gap and
    // slack are layout pixels and stay fixed. A plain pixelByHeight(49) floor scaled
    // by a DIFFERENT ratio than the fontSize-based content, so on some devices the
    // content was ~1px taller than the floor and nudged the buttons down. minHeight
    // (not height) still lets it grow if the amount text ever wraps, instead of clipping.
    spendingCapReserved: {
      minHeight: fontSize(14) * 1.5 * fontScale + fontSize(16.5) * 1.5 * fontScale + pixelByHeight(4) + pixelByHeight(2),
      gap: pixelByHeight(4)
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
    icon18: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
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
