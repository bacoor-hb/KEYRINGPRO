import { StyleSheet } from 'react-native'
import {
  Colors,
  fontSize,
  getFontFamily,
  getHeightHeaderDrawer,
  getSafeAreaValues,
  getSizeImgSquare,
  pixelByHeight,
  pixelByWidth,
  PADDING_TOP_CONTAINER_DRAWER
} from 'common/styles'
// The base font AutoFitAmountInput typesets its value at. Imported so the refund
// row's placeholder can match the value it stands in for.
import { AMOUNT_INPUT_FONT_SIZE } from '../Exchange/Components/AutoFitAmountInput'

const TOKEN_ICON = getSizeImgSquare('large')
const PROTOCOL_ICON = getSizeImgSquare('large')
// Circular buttons — the Max button in the amount field and the copy button
// beside the transaction hash. Same unit the Send drawer uses for both.
const CIRCLE = getSizeImgSquare('large')
const COPY_BTN = CIRCLE

// Design height of the amount rows, matching the Send drawer's so the two
// drawers' fields line up at the same size.
const FIELD_MIN_HEIGHT = pixelByHeight(74)

// A plain stylesheet, NOT a `createStyles()` factory. The factory took no
// arguments (the app is dark-mode only, see CLAUDE.md), so every importer that
// called it built a fresh, identical StyleSheet — four of them across this
// folder. One module-level object is shared by all of them instead.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: PADDING_TOP_CONTAINER_DRAWER
  },
  scrollView: {
    paddingTop: pixelByHeight(8)
  },
  content: {
    paddingTop: getHeightHeaderDrawer(),
    paddingBottom: getSafeAreaValues().bottom + pixelByHeight(16)
  },

  // ---- Market header (protocol icon + APY line) --------------------------
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    marginTop: pixelByHeight(4)
  },
  protocolIcon: {
    width: PROTOCOL_ICON,
    height: PROTOCOL_ICON,
    borderRadius: PROTOCOL_ICON / 2
  },
  marketTextWrap: {
    flex: 1,
    gap: pixelByHeight(2)
  },
  marketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  // ---- Contract address --------------------------------------------------
  // Section label ("Withdrawal amount", "Refund amount", the contract heading).
  //
  // Top margin only, and NO bottom margin: the field below supplies its own
  // 14px via `fieldRow.marginTop`, so adding a bottom margin here double-spaced
  // the label from its own field while leaving the sections themselves too
  // close together. Same division of labour as the Send drawer, where the
  // label carries no margin at all and the field owns the gap.
  sectionTitle: {

  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(6)
  },
  // The address wraps rather than eliding: a truncated contract address is not
  // something a user can verify, which is the only reason it is on screen.
  divider: {
    height: 1,
    backgroundColor: Colors.BG_BOX_SMALL,
    marginTop: pixelByHeight(8)
  },

  // ---- Amount fields -----------------------------------------------------
  // Transcribed from the Send drawer (SendToken/styles.js) so the withdrawal
  // and refund rows are visually the same control as the send amount rows:
  // [left token icon] + underlined section ([input] + [right button]).
  fieldRow: {
    flexDirection: 'row',
    // `stretch`, not `center` — the underlined section has to run the full
    // height of the row for the border to sit where the design puts it.
    alignItems: 'stretch',
    gap: pixelByWidth(12),
    minHeight: FIELD_MIN_HEIGHT,
    marginTop: pixelByHeight(14)
  },
  fieldSide: {
    justifyContent: 'center'
  },
  // Ticker shown at the right of the refund field, in the slot the amount field
  // gives its Max button. `flexShrink: 0` so a long receipt-token symbol
  // (gtusdcf, aEthUSDC) keeps its width instead of being squeezed by the
  // flex:1 value beside it — the auto-fit value scales down, the label does not.
  fieldSuffix: {
    flexShrink: 0
  },
  // The underline runs through the input AND the right button, but excludes
  // the left token icon, which sits outside this section.
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
  tokenIcon: {
    width: TOKEN_ICON,
    height: TOKEN_ICON
  },
  // Text appearance ONLY — AutoFitAmountInput owns every layout-affecting prop
  // (width / height / padding / fontSize) and keeps the base font fixed while
  // auto-scaling the value to fit. Only color / fontFamily belong here.
  amountInput: {
    color: Colors.WHITE,
    fontFamily: getFontFamily(700)
  },
  // Small "Amount" placeholder shown while empty. Passed to AutoFitAmountInput
  // as placeholderStyle so the hint keeps its own default size independent of
  // the input's large auto-fit value font. Also used for the refund row's
  // placeholder, which is a plain Text.
  amountPlaceholder: {
    fontSize: fontSize('default'),
    color: Colors.TEXT_LOW,
    fontFamily: getFontFamily(400)
  },
  // The refund row's empty-state "0". Unlike the amount field's small "Amount"
  // hint, this one is a stand-in for the VALUE itself, so it is typeset at the
  // value's own size — the row must not visibly change type size the moment a
  // figure arrives.
  //
  // Sized from AutoFitAmountInput's exported base rather than a literal 30, so
  // the two stay locked together if that base is ever retuned. Color comes from
  // the caller's className (dimmed while empty).
  // Mirrors AutoFitAmountInput's OWN placeholder style (same size, same weight,
  // same includeFontPadding) so the row's baseline does not shift when the
  // figure replaces it.
  amountRefundPlaceholder: {
    fontSize: AMOUNT_INPUT_FONT_SIZE,
    includeFontPadding: false,
    fontFamily: getFontFamily(700),
    lineHeight: AMOUNT_INPUT_FONT_SIZE * 1.5
  },
  // Fixed circle button (Max) — never squished by a long amount beside it.
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
  // Spinner shown in the refund row while a share preview is pending. Matches
  // AutoFitAmountInput's own row height so the field doesn't jump as it swaps
  // in and out.
  refundLoading: {
    height: getSizeImgSquare('large'),
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start'
  },

  // Fixed-height slot for the amount error, ALWAYS present whether or not a
  // message is showing — so an error appearing (or clearing as the user keeps
  // typing) never shifts the refund field and everything below it.
  //
  // Sized for ONE line: the hint's own 8px top margin plus a ~21px line of
  // `small` text (14 × 1.5), rounded up for descenders. The Send drawer
  // reserves 49px because its fee error can wrap to two lines; every message
  // here is a short single-line string, so borrowing that number left ~20px of
  // dead space above "Refund amount".
  //
  // `minHeight`, not a hard height: the reserve stops the layout shifting for
  // the messages we actually ship, and a longer one (a translation, a narrow
  // screen) grows the slot downward rather than being clipped.
  amountErrorSpace: {
    minHeight: fontSize('small') * 1.5,
    justifyContent: 'flex-start',
    marginVertical: pixelByHeight(8)
  },
  // The section label that FOLLOWS the reserved error slot. That slot is
  // already 49px of clear space, so the label's usual 20px top margin stacks
  // on top of it and opens a ~77px hole above "Refund amount". Cancel it and
  // let the reserve be the whole gap — the same way the Send drawer runs its
  // footer straight off its own error space.
  sectionTitleAfterError: {
    marginTop: 0
  },
  // Inline hint (icon + text) inside the reserved area above.
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(6)
  },
  hintIcon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(6),
    marginTop: pixelByHeight(8),
    justifyContent: 'space-between'
  },

  // ---- Progress timeline -------------------------------------------------
  // Mirrors the Send drawer's timeline (SendToken/styles.js) so both signable
  // operations on this screen report progress with the same visual language.
  stepWrap: {
    gap: pixelByHeight(14),
    marginTop: pixelByHeight(32)
  },
  // The form above dims + goes non-interactive while a withdrawal is running.
  dimmedForm: {
    opacity: 0.4
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    width: '100%'
  },
  // Step title + inline loading dots.
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(6)
  },
  stepLineCol: {
    width: getSizeImgSquare('large'),
    alignItems: 'center'
  },
  // Standalone connector (fixed height) for when a result row follows the
  // first step directly, with no hash row to carry the line.
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
  statusResult: {
    alignItems: 'center'
  },
  copyBtn: {
    width: COPY_BTN,
    height: COPY_BTN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL,
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: COPY_BTN
  }
})

export default styles
