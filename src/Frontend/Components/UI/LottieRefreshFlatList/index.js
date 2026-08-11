import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, FlatList } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  interpolate,
  withTiming,
  cancelAnimation,
  Extrapolation
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import LottieView from 'lottie-react-native'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import images from 'assets/Image'
import { getHeightHeader, pixelByHeight, sizeImageSquare } from 'common/styles'

// App-standard haptic options (matches the rest of the app).
const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }

// three-dots-loading.json plays frames 0 → 54.
const LOTTIE_END_FRAME = 54

// FlatList wrapped so its scroll can drive reanimated worklets on the UI thread.
const ReanimatedFlatList = Animated.createAnimatedComponent(FlatList)

/**
 * Pull-to-refresh with a custom Lottie, built on reanimated so it feels exactly
 * like the native RefreshControl — only the spinner is our animation.
 *
 * Two phases, mirroring the native control:
 * - DRAGGING (finger down, before release): an overlay Lottie sits in the
 *   overscroll gap and is dragged down with the pull (UI thread → no lag). Its
 *   frame is scrubbed to the pull depth — small pull holds an early frame, hard
  *   pull a later one (shallow pull = early frame, hard pull = later frame).
 * - REFRESHING (after release, while `refreshing` is true): a real spacer at the
 *   TOP OF THE LIST animates open and holds the looping Lottie. Because it lives
 *   inside the list content, it SCROLLS WITH THE LIST just like RefreshControl —
 *   scroll up and the spinner scrolls away with the rows.
 *
 * The overlay is only shown while dragging; once refreshing takes over, the
 * in-list spacer owns the animation so there's no double indicator.
 *
 * Note: we scrub via the imperative ref (`play(frame, frame)`) instead of the
 * `progress` prop, which crashes on mount under the New Architecture.
 *
 * Cross-platform pull detection: iOS reports a NEGATIVE scroll offset when you
 * overscroll past the top (rubber-band), but Android clamps the offset to 0 (it
 * uses a stretch/glow, not positional overscroll), so reading `contentOffset.y`
 * alone never fired the pull on Android. Instead we drive the pull from a
 * `Pan` gesture's `translationY` — this behaves identically on both platforms.
 * The gesture only produces a `pull` while the list is scrolled to the very top
 * (offset ≈ 0) and the finger is moving down, so normal scrolling is untouched.
 *
 * This renders its OWN FlatList (blur-header spacer built in) — pass the usual
 * FlatList props straight through.
 */
/**
 * @param {boolean} refreshing - Whether a refresh is currently in progress
 * @param {Function} onRefresh - Callback fired when the pull-to-refresh threshold is crossed
 * @param {number} [threshold] - Pull distance in px to trigger a refresh
 * @param {number} [topOffset] - Top offset for the overlay spinner position
 * @param {number} [size] - Width/height of the Lottie spinner
 * @param {object} [source] - Lottie animation source
 * @param {number} [minVisibleMs] - Minimum time the spinner stays visible after opening
 * @param {boolean} [showWhileRefreshing] - Whether to show the in-list spinner during refresh
 * @param {boolean} [blurHeader] - Whether to render a blur header spacer at the top
 * @param {number} [heightHeaderBlur] - Custom height for the blur header spacer
 * @param {React.Component} [ListHeaderComponent] - Additional header component rendered below the spinner
 */
const LottieRefreshFlatList = ({
  refreshing,
  onRefresh,
  threshold = pixelByHeight(72),
  topOffset = getHeightHeader(true),
  size = sizeImageSquare(48),
  source = images.threeDotsLoading,
  // Minimum time the spinner stays up once opened. Guards against a parent whose
  // refresh resolves almost instantly (e.g. cached data) — without this the
  // spinner would open and close in the same frame and look like it "vanished".
  minVisibleMs = 900,
  // When false, the in-list spinner is NOT shown during the refresh phase — only
  // the drag-phase scrub runs. Use this on screens that already show their own
  // loading indicator while the refetch is in flight (e.g. TokenList's header
  // GIF), so we don't stack two loaders.
  showWhileRefreshing = true,
  blurHeader = true,
  heightHeaderBlur,
  ListHeaderComponent,
  ...listProps
}) => {
  const overlayLottieRef = useRef(null)
  const inListLottieRef = useRef(null)
  // UI-thread scroll offset of the list. Used to know when the list is at the
  // very top (offset ≈ 0) — the pull gesture is only allowed to start there.
  const scrollY = useSharedValue(0)
  // How far the finger has pulled DOWN past the top, clamped to `threshold`.
  // Driven by the Pan gesture's translationY (not by overscroll offset), so it
  // works the same on iOS and Android. 0 whenever we're not pulling.
  const pullY = useSharedValue(0)
  // Last integer Lottie frame we scrubbed to, tracked on the UI thread so the
  // reaction only crosses to JS (to call the imperative play()) when the frame
  // actually changes — not on every sub-pixel pull change. This is the key to
  // not spamming the JS thread / bridge on low-end devices.
  const lastScrubFrame = useSharedValue(-1)
  // 1 only while the finger is actively dragging the pull. A momentum fling that
  // reaches the top leaves this at 0, so we don't flash the pull indicator.
  const isDragging = useSharedValue(0)
  // True once the pull has crossed the threshold and we've kicked off the
  // full-playthrough on the overlay. While set, we stop scrubbing frames to the
  // pull depth and just let the animation run to the end (LOTTIE_END_FRAME).
  // Once past the refresh threshold, play the full animation to completion.
  const playedFullRef = useRef(false)

  // `active` = the in-list spinner is showing. We own this locally instead of
  // reading `refreshing` directly, because a parent may set `refreshing` LATE
  // (e.g. deferred via InteractionManager) or never (offline/skip). We flip it on
  // the instant the user releases past the threshold so the spinner never blinks
  // out between "released" and "parent started refreshing".
  const [active, setActive] = useState(false)
  // UI-thread mirror of `active` so worklets can branch on it.
  const isActive = useSharedValue(0)
  // Overlay Lottie loops only once the pull has reached the threshold and the
  // finger is still down — so it keeps spinning until the user releases,
  // instead of playing once and freezing on the last frame.
  const [overlayLooping, setOverlayLooping] = useState(false)

  const safetyTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  const sawRefreshingRef = useRef(false)
  const openedAtRef = useRef(0)

  const clearTimers = () => {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
  }

  const openSpinner = useCallback(() => {
    if (!showWhileRefreshing) return
    clearTimers()
    openedAtRef.current = Date.now()
    setActive(true)
  }, [showWhileRefreshing])

  // Close, but never before the spinner has been up for `minVisibleMs`.
  const closeSpinner = useCallback(() => {
    if (closeTimerRef.current) return
    const remaining = Math.max(0, minVisibleMs - (Date.now() - openedAtRef.current))
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setActive(false)
    }, remaining)
  }, [minVisibleMs])

  // Bridge the parent's `refreshing` to our locally-owned spinner.
  useEffect(() => {
    if (refreshing) {
      // Parent confirmed a refresh is running — stay open, cancel any pending close.
      sawRefreshingRef.current = true
      if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null }
      if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null }
      if (!active) openSpinner()
    } else if (active) {
      // refreshing === false while we're showing. Two cases:
      // - We already SAW refreshing go true and it's now done → close (respecting
      //   minVisible so a fast/cached refresh doesn't flash).
      // - It never went true yet → the parent may still be about to start
      //   (deferred), so wait out a grace period before closing ourselves.
      if (sawRefreshingRef.current) {
        closeSpinner()
      } else if (!safetyTimerRef.current) {
        safetyTimerRef.current = setTimeout(() => {
          safetyTimerRef.current = null
          if (!sawRefreshingRef.current) closeSpinner()
        }, 2000)
      }
    }
  }, [refreshing, active, openSpinner, closeSpinner])

  useEffect(() => {
    isActive.value = active ? 1 : 0
    if (active) {
      inListLottieRef.current?.play()
    } else {
      playedFullRef.current = false
      sawRefreshingRef.current = false
      setOverlayLooping(false)
      overlayLottieRef.current?.reset()
      inListLottieRef.current?.reset()
    }
  }, [active, isActive])

  // Start the overlay loop only after LottieView has re-rendered with loop=true,
  // so it keeps replaying (0 → end) until the finger lifts instead of playing once
  // and freezing on the last frame.
  useEffect(() => {
    if (overlayLooping && !active) {
      overlayLottieRef.current?.reset()
      overlayLottieRef.current?.play(0, LOTTIE_END_FRAME)
    }
  }, [overlayLooping, active])

  useEffect(() => clearTimers, [])

  // Fired from the UI thread the instant the user lifts their finger (gesture
  // onEnd) if they had pulled past the threshold. Runs on JS to open the spinner
  // + kick the parent refresh.
  const triggerRefresh = useCallback(() => {
    if (active) return
    openSpinner()
    onRefresh && onRefresh()
  }, [active, openSpinner, onRefresh])

  // Track the list's own scroll offset so the pull gesture can tell whether the
  // list is at the very top (offset ≈ 0) — the only place a pull may begin.
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y
    }
  })

  // Pull-to-refresh gesture. Drives `pullY` from the finger's downward travel,
  // which works on both iOS and Android (unlike overscroll offset). Runs
  // simultaneously with the FlatList's own scroll so normal scrolling is
  // unaffected; we only produce a pull when the list is already at the top.
  const panGesture = Gesture.Pan()
    // Only claim vertical drags, and only after ~10px of downward movement, so
    // horizontal swipes and taps are left to the list/rows.
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onBegin(() => {
      pullY.value = 0
      lastScrubFrame.value = -2
    })
    .onUpdate((e) => {
      // A pull only counts when the list is at the top and the finger is moving
      // down. Anywhere else, this is a normal scroll — keep pullY at 0.
      const atTop = scrollY.value <= 0.5
      if (isActive.value === 0 && atTop && e.translationY > 0) {
        cancelAnimation(pullY)
        isDragging.value = 1
        // Resistance: divide by 2 so the indicator trails the finger like a
        // native rubber-band instead of moving 1:1.
        pullY.value = Math.min(e.translationY / 2, threshold)
      } else {
        isDragging.value = 0
        pullY.value = withTiming(0, { duration: 150 })
      }
    })
    .onEnd(() => {
      if (isActive.value === 0 && pullY.value >= threshold) {
        runOnJS(triggerRefresh)()
      }
    })
    .onFinalize(() => {
      // Retract the overlay smoothly instead of snapping to 0. isDragging flips
      // off immediately so the overlay style stops following pullY, but the
      // spring-back still reads nice on the in-flight frame.
      isDragging.value = 0
      pullY.value = withTiming(0, { duration: 150 })
    })

  // The FlatList's built-in scroll gesture. Compose it so the pan runs
  // SIMULTANEOUSLY with scrolling — otherwise the pan would swallow the drag and
  // the list couldn't scroll at all.
  const nativeGesture = Gesture.Native()
  const composedGesture = Gesture.Simultaneous(panGesture, nativeGesture)

  // Scrub the OVERLAY Lottie frame while dragging. Skip redundant frames so
  // play() isn't spammed (that caused the stutter). Never scrub while refreshing
  // — the in-list Lottie is looping on its own then.
  //
  // Once the pull reaches the threshold (refresh position), instead of pinning
  // the last frame we let the animation play THROUGH to the end once, from
  // wherever the scrub left off. After that we ignore further scrubbing until the
  // pull drops back below the threshold (finger eased off without releasing).
  // Apply a single, already-quantized integer frame. `frame === -1` means the
  // pull has crossed the threshold → switch to the full loop instead of scrubbing.
  // The heavy imperative play() only runs here, and the reaction below guarantees
  // this is called at most once per integer frame — so at most ~54 times for a
  // full pull instead of once per pixel.
  const scrubToFrame = useCallback((frame) => {
    if (active) return
    if (frame < 0) {
      if (!playedFullRef.current) {
        playedFullRef.current = true
        // Reached the refresh position: LOOP the whole animation from the start
        // and keep looping until the finger lifts. Only flip the `loop` state here;
        // the actual play() is kicked from an effect once LottieView has re-rendered
        // with loop=true, otherwise it plays once and freezes on the last frame.
        setOverlayLooping(true)
      }
      return
    }
    // Below threshold again — stop looping and allow a fresh scrub + a new
    // full-loop on the next reach.
    if (playedFullRef.current) setOverlayLooping(false)
    playedFullRef.current = false
    overlayLottieRef.current?.play(frame, frame)
  }, [active])

  // Quantize the pull to an integer Lottie frame ON THE UI THREAD, and only hop
  // to JS when that frame changes. A pull past the threshold maps to the sentinel
  // -1 (→ full loop). This keeps cross-thread + bridge calls to a minimum, which
  // is what caused the stutter on low-end devices.
  useAnimatedReaction(
    () => {
      if (isActive.value === 1 || isDragging.value === 0) return -2 // idle sentinel
      if (pullY.value >= threshold) return -1 // threshold reached → full loop
      return Math.round((pullY.value / threshold) * LOTTIE_END_FRAME)
    },
    (frame) => {
      if (frame === -2) return // not dragging — nothing to scrub
      if (frame !== lastScrubFrame.value) {
        lastScrubFrame.value = frame
        runOnJS(scrubToFrame)(frame)
      }
    }
  )

  // One light haptic the moment the drag first crosses the threshold (like the
  // native pull-to-refresh "click"), telling the user "let go now to refresh".
  const bumpHaptic = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
  }, [])

  useAnimatedReaction(
    () => isActive.value === 0 && isDragging.value === 1 && pullY.value >= threshold,
    (reached, prev) => {
      // Fire only on the rising edge (false → true), so it buzzes once per pull
      // rather than continuously while held past the threshold.
      if (reached && !prev) runOnJS(bumpHaptic)()
    }
  )

  // Overlay indicator (drag phase only). Hidden the moment refreshing takes over
  // so the in-list spacer is the single source of the spinner.
  const overlayStyle = useAnimatedStyle(() => {
    if (isActive.value === 1) {
      return { opacity: 0, transform: [{ translateY: 0 }] }
    }
    // Only follow the pull driven by an active finger drag. A momentum fling
    // (isDragging === 0) is ignored so the indicator doesn't flash when the user
    // flings a long list up to the top.
    const pull = isDragging.value === 1 ? pullY.value : 0
    return {
      // Fade in from the first bit of pull and reach full opacity by ~70% of the
      // pull, so the anim looks bright through most of the drag.
      opacity: interpolate(pull, [0, threshold * 0.35, threshold * 0.7], [0, 0.5, 1], Extrapolation.CLAMP),
      transform: [{ translateY: pull }]
    }
  }, [threshold])

  // In-list spacer: a real box at the top of the list that opens to `size` while
  // refreshing, holding the looping Lottie. It scrolls with the list content.
  const spacerStyle = useAnimatedStyle(() => ({
    height: withTiming(isActive.value === 1 ? size : 0, { duration: 220 }),
    opacity: withTiming(isActive.value === 1 ? 1 : 0, { duration: 180 })
  }), [size])

  return (
    <View style={{ flex: 1 }}>
      {/* Drag-phase overlay — rides the finger in the overscroll gap. */}
      <Animated.View
        pointerEvents='none'
        style={[
          {
            position: 'absolute',
            top: topOffset - size,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 10
          },
          overlayStyle
        ]}
      >
        <LottieView
          ref={overlayLottieRef}
          source={source}
          loop={overlayLooping}
          autoPlay={false}
          style={{ width: size, height: size }}
        />
      </Animated.View>

      <GestureDetector gesture={composedGesture}>
        <ReanimatedFlatList
          {...listProps}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          ListHeaderComponent={(
            <View>
              {blurHeader && <View style={{ height: heightHeaderBlur || getHeightHeader(true) }} />}
              {/* Refreshing-phase indicator — real content at the top of the list,
                so it scrolls away with the rows like the native RefreshControl. */}
              <Animated.View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, spacerStyle]}>
                <LottieView
                  ref={inListLottieRef}
                  source={source}
                  loop={active}
                  autoPlay={false}
                  style={{ width: size, height: size }}
                />
              </Animated.View>
              {ListHeaderComponent}
            </View>
          )}
        />
      </GestureDetector>
    </View>
  )
}

export default LottieRefreshFlatList
