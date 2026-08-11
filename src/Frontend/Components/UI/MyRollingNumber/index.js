import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, View, StyleSheet } from 'react-native'
import BigNumber from 'bignumber.js'
import MyText, { VARIANT_CONFIG } from '../MyText'
import { getNumberParts } from '../MyNumber'
import { Colors, fontSize as scaleFont, pixelByWidth, DECIMAL_DOWN_PIXEL } from 'common/styles'

// Digits a spinning column cycles through. Only spinning columns build a reel;
// at rest a digit is a single character (see buildRestCells).
const REEL = '0123456789'

// Whole rotations a digit makes before landing. 2 reads as a deliberate spin
// without dragging; the strip is 10 lines per turn so this is also the cost knob.
const DEFAULT_SPINS = 2
// Spin time of the FIRST digit. Each digit to its right gets +STAGGER on top,
// so they decelerate out left-to-right and the last decimal settles last —
// that trailing settle is what reads as an odometer rather than a slide.
const DEFAULT_SPIN_DURATION = 900
const DEFAULT_STAGGER = 90
// How long the up/down tint stays after the last digit lands. Without a hold the
// color is gone almost as soon as the eye reaches it.
const DEFAULT_COLOR_HOLD = 700

// Marquee for numbers too long for the space they're given. MyTextTicker can't
// do this job — it measures `children.toString()`, and here the children are a
// row of column Views, not a string — so the scroll is driven here instead.
// Behaviour deliberately mirrors MyTextTicker's default 'scroll' mode, which is
// what the token name on the line above uses: pause, then travel left at a
// constant speed until the trailing copy takes the leading copy's place.
const MARQUEE_PAUSE = 1000
const MARQUEE_SPEED = 45
// Gap between the two copies, so the number reads as repeating rather than
// running into itself. The library calls this repeatSpacer.
const MARQUEE_SPACER = pixelByWidth(40)
// Below this the "overflow" is measurement noise, not a number that needs to
// scroll; starting a loop for it would jitter forever.
const MARQUEE_MIN_OVERFLOW = 2

// The step between reel lines is measured off a MULTI-line probe, never a single
// line. Yoga rounds a node's height to the pixel grid, so a one-line Text
// reports round(advance) rather than the advance itself — and that rounding then
// gets multiplied by the ~20 lines a spin travels. Ten lines share one rounding,
// so the error per line drops by the same factor.
const PROBE_LINES = 10
const PROBE_TEXT = Array.from({ length: PROBE_LINES }, () => '0').join('\n')
// Headroom so the probe is never height-constrained: Android clamps an
// absolutely positioned child to its parent's box, and a clamped probe would
// report one line no matter how many it holds.
const PROBE_HEADROOM = 6

const isDigit = (ch) => ch >= '0' && ch <= '9'

// Sign of (a - b) using BigNumber so full-precision balances (long decimal
// strings / BigNumber) compare exactly — Number() would collapse them first.
const compareValues = (a, b) => {
  const bnA = new BigNumber(a ?? 0)
  const bnB = new BigNumber(b ?? 0)
  if (bnA.isNaN() || bnB.isNaN()) return 0
  return bnA.comparedTo(bnB)
}

// Index of the decimal point, used to line the old and new strings up: '9.50'
// and '10.50' must compare their tenths against each other, not their 2nd char.
const dotIndex = (text) => {
  const i = text.indexOf('.')
  return i < 0 ? text.length : i
}

// Resting state: one plain character per cell. No reel, no clipping, nothing
// positioned — the number at rest is just a row of one-character Texts.
//
// That matters more than it looks. The clipped reel is the fragile part of this
// component: `overflow: 'hidden'` around an absolutely positioned child, inside
// a recycled FlatList row, on Fabric, is the exact pattern the project's
// fabric-native-views notes call out for rendering blank at random. Restricting
// it to the ~2s a spin lasts means the state a wallet MUST get right — the
// balance sitting still on screen — never depends on it. A glitch mid-animation
// is cosmetic; a digit missing from a balance is not.
//
// The swap between this and the spinning layout is width-neutral, which is why
// it is allowed here when handing back to a plain MyNumber was not: a resting
// character and a spinning column's sizer are the same character in the same
// style, so they measure the same. (A single MyNumber does not: a run of text is
// shaped as one unit, a row of one-character Texts one character at a time, and
// the two never agree — which showed up as the number visibly resizing.)
const buildRestCells = (text) =>
  text.split('').map((ch, i) => (
    isDigit(ch)
      ? { key: i, digit: true, to: Number(ch) }
      : { key: i, digit: false, text: ch }
  ))

// Build the spinning strips for prevText -> nextText.
//
// A column shows strip line `k` when translateY is -k * step, so counting
// k upward scrolls the digits UP. For an increase we therefore run k from 0 to
// `steps`; for a decrease we build the strip reversed and run k from `steps`
// back to 0. Either way the strip starts on the digit that was there before and
// ends on the new one, after `spins` full turns.
const buildRollCells = (prevText, nextText, direction, spins, lineCount) => {
  const shift = dotIndex(nextText) - dotIndex(prevText)

  return nextText.split('').map((ch, i) => {
    if (!isDigit(ch)) return { key: i, digit: false, text: ch }

    const to = Number(ch)
    const prevCh = prevText[i - shift]
    // No matching old digit (the number grew a place) — spin whole turns only.
    const from = prevCh != null && isDigit(prevCh) ? Number(prevCh) : to

    // Extra steps past the whole turns to land exactly on `to`, measured in the
    // direction we're scrolling.
    const gap = direction > 0 ? (to - from + 10) % 10 : (from - to + 10) % 10
    const steps = spins * 10 + gap

    // Up: line k is `from + k`, so line `steps` is `to`.
    // Down: line k is `to + k`, so line `steps` is `from` and line 0 is `to`.
    // The strip is padded out to `lineCount` on every column even though lines
    // past `steps` are never shown. The reel view states its height as
    // `step * lineCount`, so the strip has to actually contain that many lines
    // or the stated height would not match what is inside it. `steps` maxes out
    // at `spins * 10 + 9`, always one less than `lineCount`, so the landing line
    // is guaranteed to exist.
    const base = direction > 0 ? from : to
    const lines = []
    for (let k = 0; k < lineCount; k++) lines.push(REEL[(base + k) % 10])

    // `to` also sizes the column: making it exactly as wide as the digit it
    // lands on is what lets the spin end without the number resizing.
    return { key: i, digit: true, lines: lines.join('\n'), steps, direction, to }
  })
}

// A number that spins like an odometer whenever its value changes: each digit
// runs through several full 0-9 turns and eases to a stop, the columns settling
// left-to-right, tinted green when the value went up and red when it went down
// before fading back to its normal color.
//
// Only a real value change animates. First render, re-renders with the same
// value, and list-row recycling (see `identity`) all swap silently.
//
// At rest the number is a plain row of one-character Texts. Only while spinning
// does each digit become a 0-9 reel clipped to one line, and each reel is only
// as wide as the digit it lands on — so the switch back at the end is
// width-neutral and nothing moves. See buildRestCells for why the clipped form
// is kept to the animation and no further.
//
// A number wider than the space it's given scrolls continuously instead of
// spilling over its neighbours (see syncMarquee). The parent must therefore
// hand this component a bounded width — typically `flex: 1` — and must NOT
// shrink it to its contents, or nothing can tell that the number overflows.
//
// Props:
//   value      number|string|BigNumber — the number to display
//   identity   string — stable id of WHAT this number belongs to (e.g. a token
//              metaKey). FlatList recycles row instances, so without this a
//              recycled row would read "different token's balance" as a change
//              and animate. When identity changes the value is swapped silently.
//   spins      number — whole 0-9 turns per digit (default 2)
//   spinDuration / stagger — ms for the first digit, and the extra ms each digit
//              to its right takes so they land in sequence
//   upColor / downColor — tint applied while spinning (defaults GREEN / RED_TEXT)
//   colorHold  number — ms the tint lingers after the last digit lands
//   spinOnAppear bool — one-shot attention spin with NO value change, fired when
//              this flips true. For a token that has just turned up in the list:
//              there is no previous balance to roll from, so the digits simply
//              turn and land back where they were. Fires once per mounted
//              instance, and waits for `active` like everything else.
//   active     bool — false parks the component: a value arriving while it is
//              false is held, not animated, and plays the moment it flips back
//              to true. Pass the screen's focus state. Without it the spin runs
//              on a screen the user is not looking at (a native stack keeps the
//              previous screen mounted), so coming back from Send or Exchange
//              shows a balance that already finished changing.
/**
 * @param {number|string|BigNumber} value - Number to display
 * @param {string} identity - Stable id of the owning item; changing it swaps without animating
 * @param {number} fractionDigits - Decimal places (default 2)
 * @param {boolean} signed - Always show sign (+/-)
 * @param {boolean} fixedDecimals - Keep trailing zeros
 * @param {React.ReactNode} prefix - Static text before the number
 * @param {React.ReactNode} suffix - Static text after the number
 * @param {'default' | 'small' | 'subTitle' | 'title' | 'titleLarge'} variant - Text size variant
 * @param {number} fontWeight - Font weight override
 * @param {number} spins - Whole 0-9 turns per digit
 * @param {number} spinDuration - Spin time of the first digit in ms
 * @param {number} stagger - Extra ms per digit, left to right
 * @param {string} upColor - Tint while spinning up
 * @param {string} downColor - Tint while spinning down
 * @param {number} colorHold - Ms the tint lingers after landing
 * @param {boolean} active - False holds value changes until it flips true (pass screen focus)
 * @param {boolean} spinOnAppear - One-shot attention spin, no value change; fires when it turns true
 * @param {StyleProp<TextStyle>} style - Applied to the digit/separator text
 * @param {string} className - Tailwind class for the text
 */
const MyRollingNumber = ({
  value,
  identity,
  fractionDigits = 2,
  signed = false,
  fixedDecimals = false,
  prefix,
  suffix,
  variant = 'default',
  fontWeight,
  spins = DEFAULT_SPINS,
  spinDuration = DEFAULT_SPIN_DURATION,
  stagger = DEFAULT_STAGGER,
  upColor = Colors.GREEN,
  downColor = Colors.RED_TEXT,
  colorHold = DEFAULT_COLOR_HOLD,
  active = true,
  spinOnAppear = false,
  style,
  className
}) => {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.default

  // The LOGICAL line height handed to Text. What the OS actually renders is a
  // different number, and deliberately not our business — see `step`.
  const lineHeight = useMemo(() => Math.round(scaleFont(config.size) * 1.5), [config.size])
  const intFontSize = useMemo(() => scaleFont(config.size), [config.size])
  // Decimals render one step down, matching MyNumber's nested-decimal look. The
  // line height stays the same for every column so all the reels line up.
  const fracFontSize = useMemo(() => scaleFont(config.size - DECIMAL_DOWN_PIXEL), [config.size])

  // How far the reel must travel per digit — MEASURED, never computed.
  //
  // This was computed twice and wrong twice. `fontSize()` returns fixed logical
  // sizes while `allowFontScaling` defaults to true, so the rendered line is
  // taller than the logical value and the error compounds down the strip until
  // digits leave the clip window: balances shifted, cut in half, or blank apart
  // from the separators (those are plain auto-height Text, so they survive and
  // are the giveaway). Scaling by PixelRatio.getFontScale() looked like the fix
  // and holds on iOS, but Android 14 made TypedValue's SP conversion NON-LINEAR
  // (PixelUtil.toPixelFromSP -> applyDimension(COMPLEX_UNIT_SP)), so one linear
  // ratio cannot describe it and the correction overshoots.
  //
  // There is no formula available to JS here, so it is measured — but measured
  // off the SIZER, not the reel.
  //
  // The reel lives in an absolutely positioned view inside a column that clips
  // to one line. Android's layout clamps an absolute child to its parent's box,
  // so the reel reports ONE line's height no matter how many it contains, and
  // dividing that by the line count yields a step ~30x too small. Every column
  // then parks at `-digit * tiny`, i.e. each at its own slightly-wrong offset —
  // which is exactly the "every digit stopped somewhere different, the whole
  // number looks scrambled" report. iOS does not clamp, which is why it was fine
  // there and broken on Android only.
  //
  // The sizer has none of those problems: normal flow, one line, nothing
  // clipping it, no height imposed on it. Its height IS the step, no arithmetic.
  // And it is exactly the right number: Android's CustomLineHeightSpan forces
  // every line box — single or interior — to ceil(lineHeight), so one line
  // measured in isolation matches the reel's per-line advance.
  //
  // `lineHeight` is only the estimate for the first frame, before it lands.
  const reelLines = spins * 10 + 10
  const [measuredStep, setMeasuredStep] = useState(0)
  const step = measuredStep || lineHeight

  const onProbeLayout = useCallback((e) => {
    const height = e.nativeEvent.layout.height
    if (!height) return
    // Committing unmounts the probe (it only renders while unmeasured), so this
    // runs once and cannot oscillate.
    setMeasuredStep((prev) => prev || height / PROBE_LINES)
  }, [])

  const text = useMemo(() => {
    const { intPart, fracPart } = getNumberParts(value, fractionDigits, signed, fixedDecimals)
    return fracPart.length > 0 ? `${intPart}.${fracPart}` : intPart
  }, [value, fractionDigits, signed, fixedDecimals])

  // `cells` and their Animated.Values are built together and swapped as one
  // frame — a cell is meaningless without the value driving it. `seq` bumps on
  // every rebuild so the effect below knows to (re)start the animation.
  const buildFrame = useCallback((cells, seq) => ({
    cells,
    anims: cells ? cells.map(() => new Animated.Value(0)) : [],
    seq
  }), [])

  const [frame, setFrame] = useState(() => buildFrame(buildRestCells(text), 0))
  const [trend, setTrend] = useState(null) // 'up' | 'down' | null

  const displayed = useRef(text)
  const prevValue = useRef(value)
  const prevIdentity = useRef(identity)
  const running = useRef(null)
  const holdTimer = useRef(null)
  const mounted = useRef(true)
  // Latches once this instance has spun for any reason — see the appear effect.
  const appeared = useRef(false)

  // Marquee state. Both widths come from onLayout and are kept in refs, and the
  // offset is written straight into an Animated.Value — measuring never costs a
  // re-render, which matters for a component that lives in a long list.
  // translateX is safe to read back: transforms don't feed into layout, so
  // scrolling can't retrigger the measurement that started it.
  const marqueeX = useRef(new Animated.Value(0)).current
  const viewportWidth = useRef(0)
  const contentWidth = useRef(0)
  const marquee = useRef(null)
  // Widths the running loop was built from, so a re-fired layout can be ignored.
  const applied = useRef({ viewport: 0, content: 0 })
  // Drives rendering of the trailing copy, so unlike the measurements it has to
  // be state. It only flips when the number crosses the width of its box, not
  // on every measurement, so this does not re-render per frame.
  const [scrolling, setScrolling] = useState(false)

  const syncMarquee = useCallback(() => {
    const viewport = viewportWidth.current
    const content = contentWidth.current
    if (!viewport || !content) return

    // Starting the marquee flips the viewport's alignment, which moves the first
    // copy and fires its onLayout again. Without this the loop would be torn
    // down and restarted one beat after it began. Widths are what the marquee
    // is actually built from, so if they haven't moved there is nothing to redo.
    const settled = applied.current
    if (marquee.current && settled.viewport === viewport && settled.content === content) return
    applied.current = { viewport, content }

    marquee.current?.stop()
    marquee.current = null

    if (content - viewport <= MARQUEE_MIN_OVERFLOW) {
      // Fits: park at 0 and let the viewport's flex-end alignment hold it
      // against the right edge, exactly as if there were no marquee at all.
      marqueeX.setValue(0)
      setScrolling(false)
      return
    }

    setScrolling(true)

    // Continuous scroll, matching MyTextTicker's default mode: slide the whole
    // copy plus the gap off to the left, at which point the trailing copy has
    // landed exactly where the first one started, and restart from zero. The
    // reset is invisible because the two copies are identical. Note it travels
    // the FULL content width, not just the overflow — that is what makes it a
    // loop rather than a there-and-back.
    //
    // The pause at the start of each cycle is folded into the easing instead of
    // being an Animated.delay in a sequence. Two reasons, and the first one is
    // not a preference:
    //
    //   - Animated.loop(Animated.sequence([...])) does not actually loop. The
    //     sequence reports itself as non-native, so the loop recurses on the JS
    //     thread and calls sequence.reset() between iterations — but that only
    //     resets children up to `current`, and a completed sequence has already
    //     rewound `current` to 0. The timing is therefore never reset, so from
    //     the second iteration on it animates from -distance to -distance and
    //     nothing moves. It looks like the marquee ran once and stopped.
    //   - A lone timing reports itself as native, so Animated.loop hands the
    //     whole loop to the native driver: no JS callback per cycle at all.
    const distance = content + MARQUEE_SPACER
    const total = MARQUEE_PAUSE + (distance / MARQUEE_SPEED) * 1000
    const holdUntil = MARQUEE_PAUSE / total

    marqueeX.setValue(0)
    const loop = Animated.loop(Animated.timing(marqueeX, {
      toValue: -distance,
      duration: total,
      // Sit still for the pause, then travel at a constant speed. Timing bakes
      // the easing into a frame table up front, so a custom curve like this
      // still runs entirely on the native side.
      easing: (t) => (t <= holdUntil ? 0 : (t - holdUntil) / (1 - holdUntil)),
      useNativeDriver: true
    }))
    marquee.current = loop
    loop.start()
  }, [marqueeX])

  const onViewportLayout = useCallback((e) => {
    viewportWidth.current = e.nativeEvent.layout.width
    syncMarquee()
  }, [syncMarquee])

  const onContentLayout = useCallback((e) => {
    contentWidth.current = e.nativeEvent.layout.width
    syncMarquee()
  }, [syncMarquee])

  useEffect(() => {
    return () => {
      // Rows unmount mid-spin constantly while scrolling; stop the drivers and
      // drop the pending timer so none of them fire into a dead component. The
      // marquee especially — it loops forever, so nothing else would end it.
      mounted.current = false
      running.current?.stop()
      marquee.current?.stop()
      clearTimeout(holdTimer.current)
    }
  }, [])

  const roll = useCallback((direction, nextText) => {
    running.current?.stop()
    clearTimeout(holdTimer.current)
    setTrend(direction > 0 ? 'up' : 'down')
    setFrame((prev) => buildFrame(
      buildRollCells(displayed.current, nextText, direction, spins, reelLines),
      prev.seq + 1
    ))
    displayed.current = nextText
  }, [buildFrame, spins, reelLines])

  // Start the spin only once the new strips are actually on screen — kicking a
  // native-driven animation before its view mounts makes the column jump.
  useEffect(() => {
    const { cells, anims } = frame
    if (!cells) return

    let digitOrdinal = 0
    const runners = []

    cells.forEach((cell, i) => {
      if (!cell.digit || cell.steps == null) return
      const anim = anims[i]
      const travel = cell.steps * step
      // Up: 0 -> -travel (reel scrolls up). Down: -travel -> 0.
      const start = cell.direction > 0 ? 0 : -travel
      const end = cell.direction > 0 ? -travel : 0
      anim.setValue(start)
      runners.push(Animated.timing(anim, {
        toValue: end,
        // Each digit spins a little longer than the one to its left, so they
        // stop in sequence instead of all snapping at once.
        duration: spinDuration + digitOrdinal * stagger,
        // Fast out of the gate, easing down onto the final digit.
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }))
      digitOrdinal += 1
    })

    if (!runners.length) return
    const group = Animated.parallel(runners)
    running.current = group
    group.start(({ finished }) => {
      if (!finished || !mounted.current) return
      // Digits have landed: tear the reels back down to plain characters. The
      // swap is width-neutral (same characters, same style), so nothing moves —
      // and it gets the clipped, absolutely positioned subtree off screen for
      // everything except the animation itself, which is the whole point.
      setFrame((prev) => buildFrame(buildRestCells(displayed.current), prev.seq + 1))
      holdTimer.current = setTimeout(() => {
        if (mounted.current) setTrend(null)
      }, colorHold)
    })

    return () => group.stop()
    // Re-running on anything but a new frame would restart a spin mid-flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.seq])

  useEffect(() => {
    // Recycled onto a different item — not a value change. Reset silently.
    if (identity !== prevIdentity.current) {
      prevIdentity.current = identity
      prevValue.current = value
      running.current?.stop()
      clearTimeout(holdTimer.current)
      displayed.current = text
      setFrame((prev) => buildFrame(buildRestCells(text), prev.seq + 1))
      setTrend(null)
      return
    }

    // Parked. Deliberately leaves `prevValue` and the rendered frame on the OLD
    // value: that is what lets the spin start from where the user last saw the
    // number rather than jumping to the new one silently. `active` is in the
    // deps, so flipping it back on re-runs this and the held change plays then.
    // Several changes arriving while parked collapse into one spin from the
    // oldest value to the newest, which is the right thing to show.
    if (!active) return
    // No measurement yet, no spin. `step` is what positions the reel, and
    // spinning on the placeholder is what put the digits visibly out of line.
    // Holding costs a frame; `measuredStep` is in the deps so this resumes.
    if (!measuredStep) return

    const diff = compareValues(value, prevValue.current)
    if (diff === 0) return
    prevValue.current = value
    // A real change spins too, which is all the "this just arrived" spin was
    // there to achieve — latch it so the two don't fire back to back and leave
    // the value roll overwritten by a standing spin.
    appeared.current = true
    roll(diff > 0 ? 1 : -1, text)
  }, [value, text, identity, active, measuredStep, roll, buildFrame, reelLines])

  // Attention spin for a number that has just appeared. Nothing about the value
  // changed, so the effect above has nothing to do — this asks for a spin
  // directly. `roll` with the CURRENT text gives every column from === to, i.e.
  // `spins` whole turns landing back on the same digit, which is precisely the
  // "look at me" gesture wanted and the same path a real change takes.
  //
  // Latched, because the flag arrives one render AFTER the number appears (the
  // owner can only diff the list once it has rendered) and must not fire twice.
  // The latch is deliberately NOT set while parked, so a token that turns up
  // while the user is on another screen still gets its spin on return.
  useEffect(() => {
    if (!spinOnAppear || appeared.current || !active || !measuredStep) return
    appeared.current = true
    roll(1, text)
    // `text` deliberately absent: this fires on the flag, not on the value. A
    // value change while waiting is the other effect's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinOnAppear, active, measuredStep, roll])

  // While trending, an inline color overrides whatever the caller set (style
  // color or a `text-*` className) — MyText applies `style` after className.
  const trendColor = trend === 'up' ? upColor : trend === 'down' ? downColor : null
  const tint = trendColor ? { color: trendColor } : null

  // Everything after the decimal point renders one step smaller.
  const fracFrom = frame.cells.findIndex((cell) => !cell.digit && cell.text === '.')

  // One copy of the number. Rendered twice when the marquee is running — the
  // trailing copy is what makes the scroll read as continuous — so this has to
  // be a function rather than inline JSX.
  //
  // Both copies read the SAME Animated.Values for their reels, so a spin that
  // happens while the marquee is mid-cycle shows identically in both; there is
  // no second animation to keep in sync.
  const renderCopy = (copyKey, onLayout) => (
    <View key={copyKey} style={styles.row} onLayout={onLayout}>
      {prefix != null && (
        <MyText variant={variant} fontWeight={fontWeight} className={className} style={[styles.plainText, { lineHeight }, style, tint]}>
          {prefix}
        </MyText>
      )}

      {frame.cells.map((cell, i) => {
        const size = fracFrom >= 0 && i >= fracFrom ? fracFontSize : intFontSize
        const textStyle = [
          styles.cellText,
          { fontSize: size, lineHeight },
          style,
          tint
        ]

        if (!cell.digit) {
          return (
            <MyText key={cell.key} variant={variant} fontWeight={fontWeight} className={className} style={textStyle}>
              {cell.text}
            </MyText>
          )
        }

        // At rest a digit is just a character. No column, no clip, no absolute
        // child — see buildRestCells for why that is deliberate.
        if (cell.steps == null) {
          return (
            <MyText
              key={cell.key}
              variant={variant}
              fontWeight={fontWeight}
              className={className}
              style={textStyle}
            >
              {String(cell.to)}
            </MyText>
          )
        }

        return (
          <View key={cell.key} style={styles.column}>
            {/* Sizes the column, in BOTH directions. Width: the reel below is
                absolutely positioned, so without this in-flow digit the column
                would have to derive its width from a 30-line reel and collapses
                instead. It renders the digit the column LANDS on, not a fixed
                '0': Geist's figures are proportional, so a uniform width would
                space the number out noticeably — and it has to match the resting
                character exactly, or the number would resize when the spin ends.
                Wider digits passing through get clipped a little mid-spin, which
                is invisible while everything is moving. Height: one rendered
                line, whatever the OS made that — which is why the column has no
                height of its own. A computed height is what used to cut the
                digits in half. */}
            <MyText variant={variant} fontWeight={fontWeight} style={[textStyle, styles.sizer]}>
              {String(cell.to)}
            </MyText>
            <Animated.View
              style={[
                styles.reel,
                {
                  // Explicit height, even though the content would imply it.
                  // An absolutely positioned view with no height gets clamped to
                  // its parent's box on Android, and Android's ViewGroup clips
                  // children to bounds by default — so every reel line past the
                  // first simply never gets drawn, and any column that needs to
                  // show one of them renders blank. Stating the full height is
                  // what keeps the lines inside their own view and paintable.
                  height: step * reelLines,
                  // Positioned by the effect above before it starts them.
                  transform: [{ translateY: frame.anims[i] }]
                }
              ]}
            >
              <MyText variant={variant} fontWeight={fontWeight} className={className} style={textStyle}>
                {cell.lines}
              </MyText>
            </Animated.View>
          </View>
        )
      })}

      {suffix != null && (
        <MyText variant={variant} fontWeight={fontWeight} className={className} style={[styles.plainText, { lineHeight }, style, tint]}>
          {suffix}
        </MyText>
      )}
    </View>
  )

  // One layout, always. Resting columns are parked reels; spinning ones are the
  // same reels being scrolled. Nothing is ever swapped, faded, or re-measured
  // when a spin ends, so there is no moment for the number to change size.
  //
  // The viewport is the width the parent hands us, and it clips. A number that
  // fits sits flush right and never moves. One that doesn't gets pinned left
  // and scrolled continuously, with a spaced second copy following it — the
  // same scroll behaviour MyTextTicker gives the token name above it.
  return (
    <View
      style={[styles.viewport, scrolling ? styles.viewportStart : styles.viewportEnd]}
      onLayout={onViewportLayout}
    >
      {/* Measures the reel's line advance, then unmounts. Absolutely positioned
          with generous headroom so it takes part in no layout and is never
          height-clamped; invisible, and gone after the first commit. */}
      {measuredStep === 0 && (
        <View pointerEvents='none' style={[styles.probe, { height: lineHeight * PROBE_LINES * PROBE_HEADROOM }]}>
          <MyText
            variant={variant}
            fontWeight={fontWeight}
            style={[styles.cellText, { fontSize: intFontSize, lineHeight }]}
            onLayout={onProbeLayout}
          >
            {PROBE_TEXT}
          </MyText>
        </View>
      )}

      <Animated.View style={[styles.track, { transform: [{ translateX: marqueeX }] }]}>
        {/* Only the FIRST copy is measured. Measuring the track instead would
            fold in the spacer and the second copy, and the marquee would decide
            it overflows purely because it is already scrolling. */}
        {renderCopy('a', onContentLayout)}
        {scrolling && <View style={styles.marqueeSpacer} />}
        {scrolling && renderCopy('b')}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Bounds the number to the space the parent gives it, and clips rather than
  // letting a long balance spill over its neighbours.
  viewport: { flexDirection: 'row', overflow: 'hidden' },
  // A number that fits sits flush right, the way a balance is aligned.
  viewportEnd: { justifyContent: 'flex-end' },
  // A scrolling one is pinned left instead, so translateX starts from a known
  // zero and the leading digits are what's on screen before it sets off.
  viewportStart: { justifyContent: 'flex-start' },
  track: { flexDirection: 'row', alignItems: 'center' },
  marqueeSpacer: { width: MARQUEE_SPACER },
  row: { flexDirection: 'row', alignItems: 'center' },
  // Clips the reel down to the single visible digit. Deliberately has NO height
  // of its own — it takes it from the in-flow sizer, i.e. exactly one rendered
  // line. Computing that height is what used to slice the digits in half on
  // devices with a non-default system text size.
  column: { overflow: 'hidden' },
  sizer: { opacity: 0 },
  probe: { position: 'absolute', left: 0, top: 0, opacity: 0 },
  // Out of flow so the reel's full height never drives the column's layout;
  // left/right pin it to the width the sizer established. Its height is set
  // inline — see the note there, it is not optional on Android.
  reel: { position: 'absolute', top: 0, left: 0, right: 0 },
  // includeFontPadding is an Android default that adds the font's own padding on
  // top of lineHeight. Inside the reel it compounds over every line and throws
  // the stops off; on the prefix/suffix it makes those Texts TALLER than the
  // digit columns beside them, so `alignItems: center` lands them on a different
  // baseline and the whole row grows to match. Every Text here has to opt out,
  // or the number sits crooked on Android and looks fine on iOS.
  plainText: { includeFontPadding: false },
  cellText: { textAlign: 'center', includeFontPadding: false }
})

export default MyRollingNumber
