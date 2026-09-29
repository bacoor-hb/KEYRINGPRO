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
  onFocus,
  disabled = false
}) => {
  // Coerce defensively: `undefined` (unset Redux default) must render as a
  // normal empty controlled input, and any non-string that sneaks in must not
  // break the emptiness checks below.
  const text = value == null ? '' : String(value)

  // The font the value is ACTUALLY rendered in. `styles.input` sets fontFamily
  // after textStyle in the input's style array, so getFontFamily(700) always
  // wins there — a caller's fontFamily in textStyle never reaches the input.
  // The measurer must therefore render in this same font, and the width cache be
  // keyed by it: measuring a different (e.g. narrower system) font underestimates
  // every character, so the fitted scale comes out too large and the value
  // overflows its row. Callers that happen to pass this identical family never
  // saw it; a caller passing only a color did.
  //
  // Resolved per render, never hoisted to module scope: getFontFamily reads the
  // locale from Redux, which is unhydrated at import time and changes when the
  // user switches language.
  const fontFamily = getFontFamily(700)
  const cache = getCharWidthCache(fontFamily)

  const containerWidthRef = useRef(0)
  // The last trustworthy container width, mirrored into state purely to
  // re-trigger the sync effect above — every READ of the width goes through
  // containerWidthRef so the imperative path stays synchronous.
  const [measuredWidth, setMeasuredWidth] = useState(0)
  // The value `onLayout` must fit. onLayout is a prop callback captured in the
  // commit that mounted the container, so it can fire holding a `text` older
  // than the committed one (a restored value arriving in a later render than
  // the mount). Reading through a ref keeps it on the current value.
  const textRef = useRef(text)
  textRef.current = text
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
  //
  // `measuredWidth` is in the deps because a mount that ALREADY has a value —
  // this card restored from a persisted run, rather than a drawer opening empty
  // — has no other trigger. On such a mount the first layout effect runs before
  // the container has been laid out (width 0 → computeFitScale returns 1), and
  // when the width does arrive it lands in a ref, which re-renders nothing. The
  // measurer would normally save it by flipping cache.ready, but those widths
  // are cached per font for the whole app SESSION: on every mount after the
  // first the measurer never renders, cache.ready never changes, and the effect
  // never re-ran — so a restored value kept scale 1 and overflowed its row,
  // while typing (which scales imperatively) looked fine.
  useLayoutEffect(() => {
    applyScaleFor(text)
    applyPlaceholderFor(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cache.ready, measuredWidth])

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
        const w = e.nativeEvent.layout.width
        containerWidthRef.current = w
        applyScaleFor(textRef.current)
        // Only a trustworthy width is worth a re-render, and only when it
        // actually changed — onLayout fires on every rotation/reflow.
        if (w >= MIN_TRUSTED_CONTAINER_WIDTH) {
          setMeasuredWidth(prev => (prev === w ? prev : w))
        }
      }}
    >
      {/* One-time (per font, per app session) hidden character measurer. */}
      {!cache.ready && (
        <View style={styles.measurer} pointerEvents='none'>
          {AMOUNT_CHARS.split('').map(ch => (
            <Text
              key={ch}
              style={[textStyle, styles.measurerChar, { fontFamily }]}
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
            style={[styles.placeholder, { fontFamily }, { color: placeholderTextColor }, placeholderStyle]}
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
          editable={!disabled}
          value={text}
          onChangeText={handleChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
          onFocus={onFocus}
          style={[
            textStyle,
            styles.input,
            { fontFamily },
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
    includeFontPadding: false
  },
  // Mirrors `input`'s text metrics (the widths the fit is computed from). The
  // fontFamily is applied at the usage site, after textStyle, exactly as it is
  // for `input` — so the caller's textStyle cannot change what gets measured.
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
    textAlignVertical: 'center'
  },
  inputWithValue: {
    width: INPUT_LAYOUT_WIDTH
  },
  inputEmpty: {
    width: '100%'
  }
})

export default AutoFitAmountInput
