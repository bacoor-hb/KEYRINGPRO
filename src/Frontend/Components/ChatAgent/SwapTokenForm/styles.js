import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, sizeImageSquare, getSizeImgSquare, Colors } from 'common/styles'

// Built to read as the app's own Exchange screen, not as a chat widget that
// happens to swap. The sell/buy panels, the circular arrow badge straddling the
// seam between them, and the pill percentage buttons are all lifted from
// `Screen/TokenDetailScreen/Component/Exchange/styles.js` — a user who has
// swapped in the app should recognise this immediately.
//
// The one deliberate difference is scale: this sits inside a chat bubble rather
// than a full drawer, so the outer card keeps the chat's own margin and the
// panels are spaced by 2px (as Exchange spaces its pair) rather than a screen's
// worth of padding.
const styles = StyleSheet.create({
  card: { marginTop: pixelByHeight(12) },

  // Boxed background around the whole form + its submit button — the same
  // wrapper every other in-chat form uses, so this card reads as one of them.
  // Owns the spacing between its top-level blocks (header / token pair / error /
  // submit) via `gap`, so no child carries a vertical margin of its own.
  formBox: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(16),
    padding: pixelByHeight(12),
    gap: pixelByHeight(14)
  },

  // Header block: title row + the divider under it, spaced as one unit.
  headerBlock: { gap: pixelByHeight(12) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: pixelByWidth(8) },
  headerTitle: { flex: 1 },
  headerMeta: { flexDirection: 'row', gap: pixelByWidth(6), borderRadius: pixelByWidth(24) },
  tag: {
    paddingHorizontal: pixelByWidth(12),
    paddingVertical: pixelByHeight(3),
    borderRadius: pixelByWidth(11),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.BG_BOX_SECONDARY
  },
  divider: { height: pixelByHeight(1) },

  // The sell/buy pair. 2px apart so the arrow badge below bridges them as one
  // control rather than two stacked cards — exactly Exchange's spacing.
  pairBlock: { gap: pixelByHeight(2) },

  // One token panel (sell or buy). Exchange's `containerItem`, but on the
  // SECONDARY background: it now sits inside the form box rather than on the
  // chat, so it has to read as inset against that box instead of matching it.
  panel: {
    borderWidth: 1,
    backgroundColor: Colors.BG_BOX_SECONDARY,
    borderColor: Colors.BG_BOX_SMALL,
    borderRadius: 16,
    gap: pixelByWidth(14),
    paddingVertical: pixelByHeight(12),
    paddingHorizontal: pixelByWidth(12)
    // No extra paddingBottom: both panels now end in the fiat row, which
    // reserves its own height. The asymmetric bottom padding was there to give
    // the receive panel — which had nothing under its amount — roughly the
    // height the sell panel got from its balance line, and keeping it on top of
    // a real row would just read as a gap.
  },
  // The panel's top row: "Sell"/"Buy" on the left, the percentage pills right.
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: pixelByWidth(12),
    height: getSizeImgSquare('large')
  },
  panelOptions: { flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12) },
  // Token icon + amount, side by side.
  panelBody: { flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12) },
  // minWidth: 0 is what keeps the amount inside the card. AutoFitAmountInput
  // lays its TextInput out at a fixed 5000px (so the native field never scrolls
  // or elides its own text — the fit is done with a transform instead), and a
  // flex item's default minWidth is `auto`, i.e. its content width. Without this
  // the 5000px box becomes the row's minimum: the input paints past the card,
  // over the symbol on its right, and off screen. There is deliberately no
  // overflow:'hidden' in that component (it half-paints the native input under
  // Fabric), so this is the containment.
  panelAmount: { flex: 1, minWidth: 0 },

  // Circular percentage pill — Exchange's `btnOption`, same size as the arrow
  // badge so the two rows line up optically.
  btnOption: {
    borderColor: Colors.BG_BOX_SMALL,
    borderRadius: 100,
    borderWidth: 1,
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1D1E24'
  },
  btnOptionSelected: { backgroundColor: '#2B2B31' },

  // The direction badge, centred ON the seam between the two panels. Absolutely
  // positioned over a 10px spacer so it overlaps both without adding height —
  // Exchange's `containerIconDown`.
  arrowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  arrowAnchor: { width: sizeImageSquare(10), height: sizeImageSquare(10), position: 'relative' },
  arrowBadge: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -getSizeImgSquare('large') / 2 },
      { translateY: -getSizeImgSquare('large') / 2 }
    ],
    zIndex: 1,
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL,
    backgroundColor: Colors.BG_BOX_SECONDARY,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center'
  },

  // Text appearance ONLY — AutoFitAmountInput owns every layout-affecting prop
  // (width/height/padding/fontSize). Adding a height here re-clips the
  // large-font glyphs. Copied verbatim from Exchange for that reason.
  input: { color: Colors.WHITE },

  // The receive side is quoted, never typed — it is an output, not something the
  // user is editing. Rendering it (and its '0' placeholder) at medium emphasis
  // instead of full white says that, and keeps the sell amount the one thing in
  // the card reading at full strength.
  inputReadOnly: { color: Colors.TEXT_MEDIUM },

  // The fiat value under each panel's amount — Exchange's own USD row, which it
  // sizes to `getSizeImgSquare('large')` and keeps mounted at zero opacity when
  // there is nothing to show. Same treatment here: the height is reserved on
  // BOTH panels, so an arriving price (or a first typed digit) never reflows the
  // pair or slides the arrow badge off the seam between them.
  fiatRow: { height: getSizeImgSquare('large'), flexDirection: 'row', alignItems: 'center' },
  fiatRowHidden: { opacity: 0 },

  // Reserved space for a quote failure, so showing or hiding the reason never
  // shifts the button below it. The slot keeps a FIXED height and the message is
  // positioned absolute inside it — a two-line reason then overflows instead of
  // relaying out the card, which is the same trade WalletActionForm makes for
  // its field errors. Quoting itself is no longer announced here: it renders as
  // the submit button's own spinner, which cannot reflow anything.
  errorSlot: { minHeight: pixelByHeight(14) * 1.5 },
  errorText: { position: 'absolute', top: 0, left: 0, right: 0 },

  // The x402 fee line + the swap button, spaced as one block.
  submitBlock: { gap: pixelByHeight(8) },

  // Once the swap is under way the inputs stop being something to act on — the
  // card is a record of what was signed. Dimming pushes it visually behind the
  // status timeline, where the user's attention belongs from then on.
  //
  // Safe to toggle opacity only because the panels always carry a
  // backgroundColor: Fabric never flattens them, so they can't flip between
  // flattened/un-flattened mid mount-transaction (which crashes with "Attempt
  // to recycle a mounted view"). Keep those backgrounds if this moves.
  submitted: { opacity: 0.7 }
})

export default styles
