import React, { createContext, useContext, useCallback, useMemo, useRef } from 'react'
import { Dimensions, findNodeHandle, UIManager } from 'react-native'
import { getHeightHeader, pixelByHeight } from 'common/styles'

// ============================================================================
// Scroll-a-focused-field-into-view, for inputs living INSIDE the chat thread.
//
// The chat screen deliberately takes full manual control of the keyboard:
// Android runs in SOFT_INPUT_ADJUST_NOTHING and the composer footer is lifted by
// our own translateY (see AISearch/page.js). That is exactly right for the
// composer — it is pinned to the keyboard — but it means the WINDOW never moves
// for anything else. So an input rendered inside a message bubble (Swap amount,
// Send amount/address, Supply, Add-liquidity, any WalletActionForm field) gets no
// help at all when it is focused: the keyboard slides up over it, and a field
// near the bottom of the thread ends up behind the keyboard or fully off-screen.
//
// A generic KeyboardAwareScrollView can't be dropped in here either — the thread
// is an INVERTED FlatList, and those libraries assume an upright scroll view
// (they compute "scroll down by the overlap", which inverted moves the content
// the wrong way).
//
// So this does the arithmetic itself, against the inverted axis:
//
//   - measureInWindow gives the field's live screen rect (py = its top edge in
//     screen coordinates), which is what we actually care about — it already
//     accounts for every transform between the field and the window.
//   - The keyboard's top edge is `screenH - keyboardHeight`. The composer floats
//     above that, so the real free area ends at `screenH - keyboardHeight -
//     footerHeight`.
//   - `overlap` is how far the field's BOTTOM pokes past that line. If it is
//     <= 0 the field is already comfortably visible and we do nothing — a
//     no-op scroll on focus is its own UX bug (the thread twitching every time
//     you tap a field you can already see).
//   - Inverted, contentOffset grows as you move toward OLDER messages, i.e.
//     content moves DOWN the screen as the offset grows. To lift a field UP by
//     `overlap`, the offset must therefore DECREASE by `overlap`.
//
// The scroll is clamped at 0 (the newest message — the list's resting position)
// because an inverted list has no content beyond it, and it is issued after the
// keyboard frame is known, so one animation does the whole job.
// ============================================================================

const ChatKeyboardContext = createContext(null)

// Breathing room between the focused field and the top of the composer, so the
// field never sits flush against it.
const GAP = pixelByHeight(16)

/**
 * How far to lift the thread's content so a focused field sits inside the
 * visible window. Positive = move content UP, negative = move it DOWN, 0 = the
 * field already fits and nothing should move.
 *
 * Split out from the native measuring purely so it can be tested — it is all of
 * the actual decision-making here.
 *
 * The window the field has to fit inside is:
 *   top    — under the floating blur header (the same height FlatListBlurHeader
 *            pads the inverted list by, so this really is where content starts
 *            being visible).
 *   bottom — above the keyboard AND the composer floating over it.
 */
export const computeLift = ({ fieldTop, fieldHeight, screenHeight, keyboardHeight, footerHeight }) => {
  const visibleTop = getHeightHeader(true) + GAP
  const visibleBottom = screenHeight - keyboardHeight - footerHeight - GAP

  // How far the field pokes past each edge. Only positive values are a problem;
  // a negative one means that edge already has room to spare.
  const below = (fieldTop + fieldHeight) - visibleBottom
  const above = visibleTop - fieldTop

  // Already fully inside — do nothing. Scrolling a field the user can already
  // see is its own bug (the thread twitching on every tap).
  if (below <= 0 && above <= 0) return 0

  // Only the top edge is cut off (the field sits under the header) — push the
  // content DOWN to reveal it.
  if (below <= 0) return -above

  // The clamp is the whole point here. `below` alone is wrong for a field TALLER
  // than the visible window — a 2-line address field, or a whole panel used as
  // the anchor — and for one already near the top: `below` stays positive
  // because the field's BOTTOM is low, so lifting by it shoves the field's TOP
  // up under the header, or clean off the screen.
  //
  // So a downward correction may only use the slack that actually exists above
  // the field (`-above`, the gap between its top and the top of the visible
  // window). When the field is taller than the window that slack is <= 0 and we
  // lift by nothing: its top edge is pinned, which is the readable choice — a
  // field is read from the top, and the caret on the first line must stay
  // visible.
  return Math.min(below, Math.max(0, -above))
}

// The keyboard takes ~250ms (iOS) to finish sliding up, and `keyboardWillShow`
// on iOS / `keyboardDidShow` on Android is what tells us its height. A focus
// fires BEFORE that, so a measure taken immediately would be scored against a
// stale (usually 0) keyboard height. Rather than guess, a focus with no keyboard
// up yet is PARKED and replayed the moment the height lands — see
// `notifyKeyboardHeight`. This is the delay used only for the already-open case
// (switching between two fields), where the height is already correct and we
// just let the layout settle.
const SETTLE_MS = 60

// How long a parked focus stays valid. A keyboard raised by a focus always
// reports its height well inside this; anything later belongs to a different
// interaction.
const PARK_TTL_MS = 1500

/**
 * Builds the scroller. Called by the chat SCREEN (not by a wrapper component)
 * because the screen itself is a consumer too: its keyboard listeners have to
 * push each settled height in through `notifyKeyboardHeight`. Returning the
 * value lets the screen both use it and hand it to the provider below.
 *
 * @param {object} listRef - ref to the inverted FlatList holding the messages
 * @param {number} footerHeight - measured height of the floating composer
 * @param {function} getKeyboardHeight - reads the CURRENT settled keyboard height
 */
export const useChatKeyboardScroller = ({ listRef, footerHeight, getKeyboardHeight }) => {
  // The focus we are waiting on a keyboard height for. Holds the node to
  // measure; replaced (not queued) if another field is focused in the meantime,
  // because only the newest focus is the one the user is looking at.
  const pendingRef = useRef(null)
  // Expiry for that parked focus. A focus that never raises an IME (a
  // non-editable field, a hardware keyboard) would otherwise leave its node
  // parked forever and replay it against the NEXT, unrelated keyboard opening —
  // yanking the thread for a field the user is no longer in. A park is only
  // honoured while it is fresh.
  const pendingAtRef = useRef(0)
  // Live values, read through refs so `scrollInputIntoView` can stay stable —
  // it is handed down through context into memoized form components, and a new
  // identity on every keyboard frame would re-render all of them.
  const footerRef = useRef(footerHeight)
  footerRef.current = footerHeight
  const getKbRef = useRef(getKeyboardHeight)
  getKbRef.current = getKeyboardHeight

  // The list's live scroll offset, fed by the screen's own onScroll. Read rather
  // than measured because an inverted FlatList exposes no synchronous getter,
  // and measuring the content view would cost a second native round-trip on
  // every focus.
  const currentOffsetRef = useRef(0)
  const setScrollOffset = useCallback((offset) => { currentOffsetRef.current = offset }, [])

  // Measure `node` against the current keyboard frame and scroll if it overlaps.
  const runScroll = useCallback((node) => {
    const list = listRef?.current
    if (!node || !list?.scrollToOffset) return
    const kb = getKbRef.current?.() || 0
    // No keyboard means no overlap to fix. (A focus that never brings an IME up
    // — a read-only field, a hardware keyboard — must not move the thread.)
    if (!kb) return

    UIManager.measureInWindow?.(node, (x, y, w, h) => {
      // A field that is unmounted or not yet laid out measures as undefined/0.
      if (typeof y !== 'number' || !h) return
      const delta = computeLift({
        fieldTop: y,
        fieldHeight: h,
        screenHeight: Dimensions.get('window').height,
        keyboardHeight: kb,
        footerHeight: footerRef.current
      })
      if (delta === 0) return

      // Inverted axis: content moves DOWN as the offset grows, so lifting the
      // content UP by `delta` means DECREASING the offset by it. Never past the
      // newest message (offset 0) — there is nothing beyond it to scroll to.
      const current = currentOffsetRef.current
      const next = Math.max(0, current - delta)
      if (next === current) return
      list.scrollToOffset({ offset: next, animated: true })
    })
  }, [listRef])

  /**
   * Call from a TextInput's `onFocus`, passing the input's ref (or the ref of
   * the row you want kept visible — passing the ROW is usually better, since it
   * keeps the field's label and balance on screen with it).
   */
  const scrollInputIntoView = useCallback((ref) => {
    const node = findNodeHandle(ref?.current || ref)
    if (!node) return
    if (getKbRef.current?.()) {
      // Keyboard already up (the user tapped straight from one field to
      // another): the height is correct now, just let layout settle.
      setTimeout(() => runScroll(node), SETTLE_MS)
    } else {
      // Keyboard still coming up — park it and let `notifyKeyboardHeight`
      // replay it once the real height is known.
      pendingRef.current = node
      pendingAtRef.current = Date.now()
    }
  }, [runScroll])

  // Called by the screen when the keyboard height settles. Replays a parked
  // focus against the now-known frame; a height of 0 (keyboard closing) just
  // drops it.
  const notifyKeyboardHeight = useCallback((h) => {
    const node = pendingRef.current
    const parkedAt = pendingAtRef.current
    pendingRef.current = null
    pendingAtRef.current = 0
    if (!h || !node) return
    // Stale park (see `pendingAtRef`): the keyboard that just opened is not the
    // one this focus asked for, so scrolling to that field would be wrong.
    if (Date.now() - parkedAt > PARK_TTL_MS) return
    runScroll(node)
  }, [runScroll])

  return useMemo(
    () => ({ scrollInputIntoView, notifyKeyboardHeight, setScrollOffset }),
    [scrollInputIntoView, notifyKeyboardHeight, setScrollOffset]
  )
}

/**
 * Hands the value from `useChatKeyboardScroller` down to every form in the
 * thread. Kept as a plain pass-through so the screen owns the state.
 */
export const ChatKeyboardProvider = ({ value, children }) => (
  <ChatKeyboardContext.Provider value={value}>
    {children}
  </ChatKeyboardContext.Provider>
)

/**
 * Read the scroller from any chat form.
 *
 * Safe outside the provider: returns a no-op, so a form rendered somewhere else
 * (a test, a drawer, a future reuse) keeps working untouched.
 */
export const useChatKeyboard = () => {
  const ctx = useContext(ChatKeyboardContext)
  return ctx || EMPTY
}

const EMPTY = {
  scrollInputIntoView: () => {},
  notifyKeyboardHeight: () => {},
  setScrollOffset: () => {}
}

export default ChatKeyboardProvider
