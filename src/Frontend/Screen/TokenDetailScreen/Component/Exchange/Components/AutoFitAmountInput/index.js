import React, { useLayoutEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Colors, fontSize, getFontFamily, getSizeImgSquare } from 'common/styles'
import { computeFitScale } from '../../helpers'

// ---------------------------------------------------------------------------
// AutoFitAmountInput
//
// A single-line amount TextInput at a large base font that keeps the WHOLE
// number visible by shrinking it to fit its row — no "…", no digits hidden by
// the input scrolling internally.
//
// How it fits (and why not by changing fontSize):
//  - Changing fontSize changes the line-box height → the text jumps vertically
//    and re-lays-out every keystroke. Instead the fontSize is FIXED and the
//    text is fitted with a left-anchored `scale` transform: GPU-only, no
//    layout, no vertical movement.
//  - The input gets a huge fixed layout width (INPUT_LAYOUT_WIDTH) so the
//    native field never scrolls/elides its own text; the transform alone
//    decides what fits.
//
// Why the scale is applied imperatively (setNativeProps), synchronously in
// onChangeText BEFORE the parent's state work:
//  - The new digit and its fitted scale must land in the SAME frame. Waiting
//    for a React round-trip shows one frame of overflowing text, and a parent
//    re-render carrying a stale value-derived scale causes a visible
//    overshoot-then-snap. So render NEVER derives the scale from `value`; the
//    committed value is re-synced via useLayoutEffect (covers Max button /
//    quote-computed values / parent sanitization changing the text).
//
// Fabric (New Architecture) rules this component obeys — each was a real,
// hard-to-reproduce paint bug (clipped/"half character" placeholder); see
// .claude/skills/fabric-native-views:
//  - NO overflow:'hidden' anywhere here: a clip layer over a native child
//    (the TextInput) mislays/half-paints it. Worst case without the clip is a
//    pasted number too long even for MIN_SCALE painting past the row.
//  - The transform lives on a plain wrapper View (collapsable={false}), never
//    on the native TextInput. Its declared style holds a CONSTANT scale of 1:
//    it never depends on `value`, so re-renders can't re-send a stale scale,
//    and a recycled native view can never leak a previous transform — the
//    declared prop resets it on every (re)mount.
//  - Per-character widths are measured ONCE PER FONT for the whole app session
//    (module cache below). The hidden measurer therefore mounts at most once
//    per font — repeatedly mounting/unmounting measurement nodes inside an
//    animating drawer was another Fabric paint-glitch source.
// ---------------------------------------------------------------------------

export const AMOUNT_INPUT_FONT_SIZE = fontSize(30)

// Default readability floor: shrink at most to ≈ fontSize('small'), then allow
// overflow. Callers that want the value to keep shrinking to fit (no floor) pass a
// tiny `minScale` (e.g. the Send drawer's amount fields) — see the prop below.
const DEFAULT_MIN_SCALE = fontSize('small') / AMOUNT_INPUT_FONT_SIZE

// Fixed layout width of the input — wide enough that its text never scrolls
// internally at the base font size. Fitting is done purely with the transform.
const INPUT_LAYOUT_WIDTH = 5000

// Container widths below this are transient layout artifacts (drawer opening),
// not real measurements — render unscaled until a trustworthy width arrives.
const MIN_TRUSTED_CONTAINER_WIDTH = AMOUNT_INPUT_FONT_SIZE / 2

// Every character a decimal amount can contain (decimal-pad keyboard; the
// parent's sanitizer keeps committed values inside this set).
const AMOUNT_CHARS = '0123456789.,-'

// fontFamily -> { widths: { char: px }, ready } — measured once per font per
// app session, shared by every instance.
const charWidthsByFont = {}

const getCharWidthCache = (fontKey) => {
  if (!charWidthsByFont[fontKey]) {
    charWidthsByFont[fontKey] = { widths: {}, ready: false }
  }
  return charWidthsByFont[fontKey]
}

const AutoFitAmountInput = ({
  value,
  onChangeText,
  placeholder,
  // Placeholder color. Defaults to the low-emphasis text color (matches the
  // Send drawer's "Amount" hint); Exchange passes Colors.WHITE for its '0'.
  placeholderTextColor = Colors.TEXT_LOW,
  // Extra style for the placeholder overlay only (e.g. a smaller fontSize).
  // The overlay is rendered independently of the input's large fixed font, so
  // a caller can show a small hint without touching the value's size.
  placeholderStyle,
  keyboardType = 'decimal-pad',
  maxLength,
  // Lower bound the value may shrink to (fraction of the base font). Defaults to
  // the readability floor (≈ fontSize('small')); below the floor the text is
  // allowed to overflow. Callers that want the value to ALWAYS fit (shrink with
  // no floor) pass a tiny value like 0.01 — e.g. the Send drawer's amount fields.
  minScale = DEFAULT_MIN_SCALE,
  // Text appearance only (color, fontFamily). Layout-affecting props
  // (width/height/padding/fontSize) are owned by this component.
  textStyle,
  onFocus
}) => {
  // Coerce defensively: `undefined` (unset Redux default) must render as a
  // normal empty controlled input, and any non-string that sneaks in must not
  // break the emptiness checks below.
  const text = value == null ? '' : String(value)

  const fontKey = StyleSheet.flatten(textStyle)?.fontFamily || 'system'
  const cache = getCharWidthCache(fontKey)

  const containerWidthRef = useRef(0)
  const scaleWrapperRef = useRef(null)
  const placeholderRef = useRef(null)
  // Only forces a re-render when this font's measurements complete (to drop
  // the measurer and re-run the sync effect) — all reads go through `cache`.
  const [, onCacheReady] = useState(0)

  const handleCharLayout = (char, w) => {
    // Ignore zero/invalid widths from intermediate layout passes — a stored 0
    // would poison the width sums and mis-scale the text forever.
    if (w > 0 && cache.widths[char] == null) {
      cache.widths[char] = w
      cache.ready = Object.keys(cache.widths).length >= AMOUNT_CHARS.length
    }
    if (cache.ready) {
      onCacheReady(n => n + 1)
    }
  }

  // The ONLY place that touches the transform. Always imperative, always on
  // the plain wrapper View.
  const applyScaleFor = (str) => {
    const scale = cache.ready
      ? computeFitScale({
        text: str,
        containerWidth: containerWidthRef.current,
        charWidths: cache.widths,
        minScale,
        minTrustedWidth: MIN_TRUSTED_CONTAINER_WIDTH
      })
      : 1
    scaleWrapperRef.current?.setNativeProps({ style: { transform: [{ scale }] } })
  }

  // Toggle the placeholder overlay imperatively so it hides in the SAME frame as
  // the keystroke — the native TextInput paints the typed digit instantly, while
  // `text` (from props) only updates a frame later after the parent's state
  // round-trip. Driving the overlay off React (via setNativeProps here) means the
  // placeholder disappears the moment the first char is typed and never sits on
  // top of the value. The React render still gates it on `!text.length`, so a
  // committed value keeps it hidden and an emptied value brings it back.
  const applyPlaceholderFor = (str) => {
    placeholderRef.current?.setNativeProps({ style: { opacity: str && str.length ? 0 : 1 } })
  }

  // Re-sync for non-typing changes (Max button, quote-computed values, parent
  // sanitization) and once measurements/container width become available.
  // useLayoutEffect runs before paint, so there is no one-frame flash.
  useLayoutEffect(() => {
    applyScaleFor(text)
    applyPlaceholderFor(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cache.ready])

  const handleChangeText = (nextText) => {
    // Same-frame fit: hide the placeholder + scale first, then hand the text to
    // the parent's (heavier) state/redux work.
    applyPlaceholderFor(nextText)
    applyScaleFor(nextText)
    onChangeText && onChangeText(nextText)
  }

  return (
    <View
      style={styles.container}
      onLayout={e => {
        containerWidthRef.current = e.nativeEvent.layout.width
        applyScaleFor(text)
      }}
    >
      {/* One-time (per font, per app session) hidden character measurer. */}
      {!cache.ready && (
        <View style={styles.measurer} pointerEvents='none'>
          {AMOUNT_CHARS.split('').map(ch => (
            <Text
              key={ch}
              style={[textStyle, styles.measurerChar]}
              onLayout={e => handleCharLayout(ch, e.nativeEvent.layout.width)}
            >
              {ch}
            </Text>
          ))}
        </View>
      )}
      {/* Placeholder rendered SendToken-style: an absolute overlay shown only
        while the input is empty, instead of the native `placeholder` prop. This
        lets the hint carry its OWN font/size (via placeholderStyle) independent
        of the input's large fixed value font — e.g. a small "Amount" hint that
        doesn't grow the value's line box. pointerEvents='none' so taps still
        reach the input beneath it. */}
      {!text.length && !!placeholder && (
        <View
          ref={placeholderRef}
          collapsable={false}
          style={styles.placeholderWrap}
          pointerEvents='none'
        >
          <Text
            numberOfLines={1}
            style={[styles.placeholder, { color: placeholderTextColor }, placeholderStyle]}
          >
            {placeholder}
          </Text>
        </View>
      )}
      <View
        ref={scaleWrapperRef}
        collapsable={false}
        style={styles.scaleWrapper}
      >
        <TextInput
          value={text}
          onChangeText={handleChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={onFocus}
          style={[
            textStyle,
            styles.input,
            // While empty (overlay placeholder showing) use a normal full-width
            // box so the input lays out/paints like any static text. The huge
            // width is only needed once there is a value to auto-fit.
            text.length ? styles.inputWithValue : styles.inputEmpty
          ]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Fixed row height so the surrounding row never resizes; the input centers
  // inside at its natural line height (its glyphs may be taller than old
  // fixed heights tuned for a smaller font — never pin its height).
  container: {
    height: getSizeImgSquare('large'),
    flex: 1,
    justifyContent: 'center'
  },
  measurer: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    flexDirection: 'row'
  },
  // Absolute placeholder overlay (SendToken-style): pinned to the input's left
  // edge and vertically centered so it sits exactly where the first glyph would.
  // Shown only while empty; never affects the input's layout.
  placeholderWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center'
  },
  // Placeholder defaults to the SAME large font as the value (so Exchange's '0'
  // reads at the amount size, as before). A caller wanting a small hint (like the
  // Send drawer's "Amount") passes placeholderStyle={{ fontSize: fontSize('default') }}.
  // Color comes from placeholderTextColor at the call site.
  placeholder: {
    fontSize: AMOUNT_INPUT_FONT_SIZE,
    includeFontPadding: false,
    fontFamily: getFontFamily(700)
  },
  measurerChar: {
    fontSize: AMOUNT_INPUT_FONT_SIZE,
    includeFontPadding: false
  },
  // Anchors scaling to the left edge & vertical center so the first digit
  // never moves. Declared scale is a constant 1 — see the header notes.
  scaleWrapper: {
    width: '100%',
    transform: [{ scale: 1 }],
    transformOrigin: 'left center'
  },
  input: {
    padding: 0,
    margin: 0,
    fontSize: AMOUNT_INPUT_FONT_SIZE,
    // Android: keep the glyph centered without the font's extra padding.
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontFamily: getFontFamily(700)
  },
  inputWithValue: {
    width: INPUT_LAYOUT_WIDTH
  },
  inputEmpty: {
    width: '100%'
  }
})

export default AutoFitAmountInput
