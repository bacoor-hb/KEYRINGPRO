import { StyleSheet } from 'react-native'
import { Colors, pixelByHeight, pixelByWidth, getFontFamily, fontSize, getSizeImgSquare } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    width: '100%'
  },
  // The full row: left icon + bordered input column. Height is applied inline.
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12)
  },
  // Inner row holding the input field + right icon. The border-bottom lives here
  // (not on inputWrapper) so it only spans the input + right icon, leaving the
  // left icon un-underlined. Stretches to the wrapper's full height so the border
  // sits at the bottom of the row.
  inputBorderedRow: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  inputWrapperDefault: {
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  // Default left-icon box: fixed square (large) with the icon centered inside.
  leftIconBox: {
    width: getSizeImgSquare('large'),
    alignItems: 'center',
    justifyContent: 'center'
  },
  rightElement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8)
  },
  // Relative box so the custom placeholder can be overlaid on top of the input.
  // Vertically centered: with a single-line (auto-height) input this centers the
  // text in the row; a wrapped multiline input grows the field and pushes the row
  // taller instead of shifting the first line off-center.
  field: {
    flex: 1,
    justifyContent: 'center'
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
    // height: '100%',
    fontFamily: getFontFamily(),
    fontSize: fontSize('default'),
    // No explicit lineHeight: the placeholder (see placeholderText) uses the same
    // natural font metrics so both glyphs land on the same baseline. Forcing a
    // lineHeight here (or a ×1.5 one on the placeholder) makes the two line-boxes
    // different heights, so the centered text and placeholder no longer align.
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: Colors.WHITE
    // backgroundColor: 'blue'
  },
  // Overlay placeholder text. Mirrors `textInput` typography exactly — same font,
  // same natural line-box (NO lineHeight override), same includeFontPadding — so
  // the placeholder sits on the identical baseline as the value being typed.
  placeholderText: {
    fontFamily: getFontFamily(),
    fontSize: fontSize('default'),
    includeFontPadding: false,
    color: Colors.TEXT_LOW
  },
  // Multiline: drop the fixed full-height fill so the input sizes to its content
  // (one line by default, growing as text wraps) rather than filling — and being
  // scroll-clipped by — the row.
  textInputArea: {
    flex: 0,
    height: undefined
  },
  // Custom placeholder overlay. pointerEvents is disabled at the element so taps
  // fall through to the TextInput underneath. `opacity` is declared as a CONSTANT
  // here (never derived from the value) so re-renders can't clobber the imperative
  // setNativeProps toggle that hides it in the same frame as a keystroke.
  placeholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    opacity: 1
    // backgroundColor: 'green'
  },
  // Row wrapping the message so it can be indented to the input column (matching
  // the left-icon width + the input row's gap).
  messageRow: {
    flexDirection: 'row',
    gap: pixelByWidth(12),
    paddingTop: pixelByHeight(8)
  },
  // Reserved message area below the field (hint / error). errorSpaceHeight is a
  // MINIMUM height: a short message never shifts content below it, a long one
  // grows the area downward instead of truncating.
  messageArea: {
    flex: 1,
    justifyContent: 'flex-start'
  },
  errorText: {
    color: Colors.RED_TEXT
  },
  hintText: {
    color: Colors.TEXT_LOW
  }
})

export default styles
