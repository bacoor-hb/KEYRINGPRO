import { StyleSheet } from 'react-native'
import { Colors, fontSize, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare, getFontFamily, getHeightHeaderDrawer, PADDING_TOP_CONTAINER_DRAWER } from 'common/styles'

const CIRCLE = getSizeImgSquare('large')
const TOKEN_ICON = getSizeImgSquare('large')
const USD_BADGE = getSizeImgSquare('small')
// Horizontal padding around the gas slider so its round thumb isn't clipped at
// the extremes (the thumb overhangs the track by half its width on each side).
const SLIDER_PAD = sizeImageSquare(11)
// Address-book entry avatars are smaller than account avatars (per Figma).
const AVATAR_SIZE = getSizeImgSquare('large')

// Top/bottom padding inside every input box (also exported via the height math so
// the measured two-line height + this padding fit exactly).
export const FIELD_VPAD = pixelByHeight(8)
// Design minimum for the input boxes. The runtime-measured two-line height is used
// when it's taller (e.g. a big locale font), but the box never goes below this — so
// when the measured height comes out smaller, the box still matches the 74px design.
export const FIELD_MIN_HEIGHT = pixelByHeight(74)
// FALLBACK input-box height used until the real two-line height is measured at
// runtime (see page.js). Set to the design minimum so first paint already matches
// the design and nothing shrinks once the (≥ min) measured height arrives.
export const FIELD_HEIGHT_FALLBACK = FIELD_MIN_HEIGHT

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: PADDING_TOP_CONTAINER_DRAWER
    },
    content: {
      paddingTop: getHeightHeaderDrawer(),
      paddingBottom: getSafeAreaValues().bottom + pixelByHeight(16)
    },
    // Single-line address rows (e.g. the address-book NFT search). The runtime
    // measured two-line height is applied at the call site (page.js); this fallback
    // only covers first paint. minHeight is fine — single-line content never grows.
    addressInputWrapper: {
      minHeight: FIELD_HEIGHT_FALLBACK
    },
    // Destination address field. It's multiline (`typeInput='area'`) so a long 0x
    // address wraps instead of scrolling off-screen. Fixed height = runtime measured
    // two-line height of the CURRENT locale font (applied at the call site) so two
    // lines fit with NO overflow/clip — we keep the real per-locale font (Geist /
    // LINE_SEED) instead of forcing one. `alignItems: center` vertically centers the
    // (auto-height) TextInput: a 1-line value/placeholder sits centered, and as it
    // wraps to two lines the block grows symmetrically about the centre and fills the
    // box — so it never jumps from centre to top the way a top-anchored input does.
    addressAreaWrapper: {
      height: FIELD_HEIGHT_FALLBACK,
      alignItems: 'center',
      // CRITICAL: cancel MyInput's inherited `inputWrapperDefault.paddingVertical`
      // (11px top+bottom). Left in, it eats ~22px of the box on top of the input's
      // own padding, shrinking the visible text area to ~1 line so the 2nd line gets
      // clipped on paste. The inner spacing is owned solely by addressAreaInput below.
      paddingVertical: 0
    },
    addressAreaInput: {
      // Keep MyInput's per-locale font (no override) — the box is sized to the
      // measured two-line height of THAT font, so it fits without clipping. Symmetric
      // 8px padding so the content sits inside the box. `height: undefined` cancels
      // MyInput's default `height: '100%'` so the input AUTO-SIZES to its content,
      // letting addressAreaWrapper's center alignment do the vertical centering.
      height: undefined,
      paddingVertical: FIELD_VPAD
    },
    // Row = [left icon] + [input] + [right button]. The underline lives ONLY on
    // the input column, so it never runs under the left icon or the right button.
    // Row stretches so the input's bottom border lands at the row's bottom; the
    // icon/button wrappers re-center their content.
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: pixelByWidth(12),
      minHeight: FIELD_HEIGHT_FALLBACK,
      // 14px rhythm above each amount field: separates the "Quantity to send"
      // label from the first field, and the two amount fields from each other.
      marginTop: pixelByHeight(14)
    },
    // 14px gap above a field, used to space the address inputs from their label
    // and from each other (matches the amount-field rhythm above).
    inputTopGap: {
      marginTop: pixelByHeight(14)
    },
    fieldSide: {
      justifyContent: 'center'
    },
    // Amount fields: underline runs through the input AND the right button (but
    // still excludes the left token icon, which sits outside this section).
    fieldLine: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: pixelByWidth(12),
      borderBottomWidth: 1.5,
      borderBottomColor: Colors.BG_BOX_SMALL
    },
    fieldInputPlain: {
      flex: 1,
      justifyContent: 'center'
    },
    // Text appearance ONLY — AutoFitAmountInput owns every layout-affecting prop
    // (width/height/padding/fontSize) and keeps the base font fixed while
    // auto-scaling the value to fit. Only color/fontFamily belong here.
    amountInput: {
      color: Colors.WHITE,
      fontFamily: getFontFamily(700)
    },
    // Small "Amount" placeholder shown while empty. Passed to AutoFitAmountInput as
    // placeholderStyle so the hint keeps its own 16.5px size independent of the
    // input's large auto-fit value font.
    amountPlaceholder: {
      fontSize: fontSize('default'),
      color: Colors.TEXT_LOW,
      fontFamily: getFontFamily(400)
    },
    // Loader shown in the fiat field while the new currency's rate is being fetched.
    // Same height as AutoFitAmountInput's row (getSizeImgSquare('large')) and left-
    // aligned/vertically centered so the field doesn't jump when it swaps in/out.
    fiatLoadingWrap: {
      height: getSizeImgSquare('large'),
      flex: 1,
      justifyContent: 'center',
      alignItems: 'flex-start'
    },
    // Fixed circle button for icon-only actions (scan / coins) — never squished.
    iconBtn: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      flexShrink: 0,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      justifyContent: 'center',
      alignItems: 'center'
    },
    tokenIcon: {
      width: TOKEN_ICON,
      height: TOKEN_ICON
    },
    // Fiat icon: a bordered circle (40px incl. border) holding the currency symbol.
    // The symbol keeps a square(3) gap from the border (via padding) and auto-scales
    // to fill the remaining box, so its size derives from the square unit — not a
    // hardcoded fontSize — and wide symbols (CA$, kr) shrink to fit instead of clipping.
    usdIconWrap: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      borderWidth: sizeImageSquare(3),
      borderColor: Colors.TEXT_MEDIUM,
      justifyContent: 'center',
      alignItems: 'center'
    },
    // Plain Text (not MyText) on purpose: adjustsFontSizeToFit shrinks wide symbols
    // (CA$, CLP$) to one line, and with NO explicit lineHeight the natural line box
    // scales with the shrunk glyph so every symbol stays vertically centered. A fixed
    // lineHeight (MyText's default) would baseline-drop the shrunk glyph to the bottom.
    usdSymbol: {
      fontSize: fontSize(23),
      fontFamily: getFontFamily(700),
      color: Colors.TEXT_MEDIUM,
      textAlign: 'center',
      // Horizontal breathing room so wide symbols (CA$, CLP$) shrink a touch more
      // and don't butt up against the border. On the Text (not the wrap) so the
      // absolutely-positioned badge anchor isn't shifted.
      paddingHorizontal: sizeImageSquare(4)
    },
    // Currency-flag badge over the bottom-right corner of the circle. The offset
    // adds the 3px border width (absolute children anchor inside the border) so the
    // badge sits at the same corner spot as before the bordered circle.
    usdBadgeWrap: {
      position: 'absolute',
      right: -sizeImageSquare(5),
      bottom: -sizeImageSquare(5),
      width: USD_BADGE,
      height: USD_BADGE,
      borderRadius: USD_BADGE / 2,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center'
    },
    usdBadge: {
      width: USD_BADGE,
      height: USD_BADGE,
      borderRadius: USD_BADGE / 2
    },
    // Fixed-height reserved area for amount errors (balance / fee). Pinned so that
    // showing/hiding a 1- or 2-line error never shifts the footer below it.
    amountErrorSpace: {
      height: pixelByHeight(49),
      justifyContent: 'flex-start'
    },
    // Inline hint (warning icon + text) under a field.
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(6),
      marginTop: pixelByHeight(8)
    },
    hintIcon: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
    },
    // Reserved area below the address-book input for the invalid-address error or
    // the recipient status. minHeight keeps the layout stable for the common 1-line
    // states; the 2-line suspicious state (with GoPlus credit) grows downward.
    addressStatusSpace: {
      minHeight: pixelByHeight(49 - 6),
      marginTop: pixelByHeight(6),
      justifyContent: 'flex-start'
    },
    // Resolved address-book entry note (freeText), shown above the recipient status.
    // The 14px bottom margin is the gap between the note and the status row.
    addressBookFreeText: {
      marginBottom: pixelByHeight(14)
    },
    // Only when the address-book note is showing (taller status area) do we add a
    // 14px gap above "Quantity to send" so it doesn't sit too close to the content.
    quantityWithNote: {
      marginTop: pixelByHeight(14)
    },
    // Recipient status row: icon/loader + text column.
    statusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: pixelByWidth(8)
    },
    statusIcon: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      justifyContent: 'center',
      alignItems: 'center'
    },
    statusTextCol: {
      flex: 1
    },
    // "powered by GoPlus" credit under the suspicious-address message.
    goPlusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(4),
      marginTop: pixelByHeight(2)
    },
    goPlusLogo: {
      width: getSizeImgSquare('small'),
      height: sizeImageSquare(14)
    },
    // Balance / transaction-fee footer.
    footer: {
      gap: pixelByHeight(8)
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: pixelByHeight(14)
    },
    sliderWrap: {
      flex: 1,
      marginRight: pixelByWidth(12),
      paddingHorizontal: SLIDER_PAD,
      justifyContent: 'center'
    },
    sliderMeasure: {
      width: '100%'
    },
    gweiBox: {
      alignItems: 'flex-end',
      // FIXED width (not minWidth): the gwei value changes width as it updates
      // live while dragging; a fixed box keeps the flex:1 slider from reflowing
      // (which would re-measure trackWidth and make the bar/thumb jump).
      width: pixelByWidth(96)
    },
    // Submit / result step UI
    // Submit timeline sits below the gas slider, 32px clear of it.
    stepWrap: {
      gap: pixelByHeight(14),
      marginTop: pixelByHeight(32)
    },
    // The form above dims + goes non-interactive while a send is in progress.
    dimmedForm: {
      opacity: 0.4
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      width: '100%'
    },
    // "Sending" title + inline loading dots.
    sendingTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(6)
    },
    stepLineCol: {
      width: getSizeImgSquare('large'),
      alignItems: 'center'
    },
    // Standalone connector (fixed height) used when a result step (Success / Fail)
    // follows the Sending step directly with no hash/fallback row to carry the line.
    stepConnectorCol: {
      width: getSizeImgSquare('large'),
      height: pixelByHeight(40),
      alignItems: 'center'
    },
    stepLine: {
      width: pixelByWidth(3),
      backgroundColor: Colors.BG_BOX_SMALL,
      flex: 1
    },
    // Success / Fail result row (StatusMessage): vertically center the animation
    // against the title (+ message on failure), matching the RegisterAddress screen.
    statusResult: {
      alignItems: 'center'
    },
    iconCopy: {
      width: fontSize(),
      height: fontSize(),
      position: 'relative',
      top: 0.5
    },
    copyBtn: {
      width: CIRCLE,
      height: CIRCLE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderRadius: CIRCLE
    },
    abAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2
    },
    abAvatarImg: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2
    }
  })
}

export default createStyles
