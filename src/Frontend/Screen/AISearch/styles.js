import { StyleSheet } from 'react-native'
import { Colors, pixelByWidth, pixelByHeight, fontSize, getSafeAreaValues, getSizeImgSquare } from 'common/styles'

const BTN_SIZE = getSizeImgSquare('large')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: pixelByHeight(16)
  },
  list: {
    flex: 1,
    // Break out of MyViewPage's 16px padding so the scroll (clip) boundary sits
    // at the screen edge. The 16px inset is re-applied inside via `listContent`,
    // so content stays in the same place but interactive liquid-glass press
    // effects now have room inside the list and aren't clipped at the edge.
    marginHorizontal: -pixelByWidth(16)
  },
  listContent: {
    paddingHorizontal: pixelByWidth(16),
    // Pin a SHORT conversation to the top of the screen (the design), instead of
    // letting it collapse to the bottom above the input. Inverted, the content
    // container is flipped, so its flex-end is the screen's TOP — the rows pack
    // there and the empty space falls below them.
    //
    // flexGrow is what makes the container taller than its content in the first
    // place (so there IS free space to distribute); justifyContent is what puts
    // that space on the right side. flexGrow alone would stretch/centre nothing
    // useful — it must be paired with the alignment.
    //
    // Once the thread is longer than the viewport this is inert: there is no
    // free space left, so the list behaves exactly as before and still rests on
    // the newest message.
    flexGrow: 1,
    justifyContent: 'flex-end'
    //
    // No vertical padding here: clearance for the floating INPUT lives on the
    // ListHeaderComponent (page.js), which inverted is what renders at the
    // bottom of the screen, and clearance for the floating HEADER is added by
    // FlatListBlurHeader as paddingBottom (the flip makes that the top edge).
  },
  // Floats over the list so messages scroll underneath and show through the
  // liquid-glass input (iOS 26 style). Transparent itself — only the glass pill
  // blurs what's behind it.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(24),
    paddingHorizontal: pixelByWidth(16),
    paddingTop: pixelByHeight(8),
    paddingBottom: getSafeAreaValues().bottom
  },
  // Scrim behind the floating input. `top` (fade height) and `bottom` (extends
  // down behind the keyboard) are set inline since they depend on the keyboard.
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0
  },
  // Solid circular send/stop button (no liquid glass — see page.js). A plain
  // filled pill so every tap registers; styled to match the input's fallback fill.
  roundBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    paddingHorizontal: 0,
    borderRadius: BTN_SIZE / 2,
    borderColor: Colors.BG_BOX_SMALL,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Dimmed send button when there's nothing to send (replaces the old
  // ChatAgent/GlassView `disable` prop).
  roundBtnDisabled: {
    opacity: 0.5
  },
  searchWrap: {
    flex: 1,
    height: BTN_SIZE,
    borderRadius: 24
  },
  searchInner: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8),
    paddingHorizontal: pixelByWidth(16)
  },
  searchIcon: {
    width: getSizeImgSquare('title'),
    height: getSizeImgSquare('title')
  },
  AIicon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },
  input: {
    flex: 1,
    color: Colors.WHITE,
    fontSize: fontSize(16.5),
    paddingVertical: 0
  },
  textIntroduce: {
    marginBottom: pixelByHeight(6)
  },
  // Floating jump-to-bottom button, centered above the input. The wrapper is
  // full-width (box-none) so only the button itself catches taps.
  scrollDownWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  scrollDownBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Thinking state: no fixed width — the glass pill hugs the typing dots and
  // grows with them, while keeping the round-end height/radius of the button.
  scrollDownBtnThinking: {
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    paddingHorizontal: pixelByWidth(14),
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollDownIcon: {
    width: getSizeImgSquare('title'),
    height: getSizeImgSquare('title')
  }
})

export default styles
