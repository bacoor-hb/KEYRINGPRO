import { useState } from 'react'
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated'
import { useGlassSettleProgress } from '../MyDrawer/GlassSettleContext'

// Tells a glass surface WHEN its host has stopped animating, so the native
// LiquidGlassView is only ever materialized on a SETTLED view (iOS drops the
// glass if it's committed mid-animation and never repaints it — and if it's
// committed while the host is still scaling/fading, the glass breaks).
//
// Why not a timer: a fixed delay is a guess — too long and every button sits on
// its flat fallback long enough to visibly "pop" to glass (flicker); too short
// and it promotes before the host finished opening (lost / broken effect).
// Instead we read the REAL signal each animated host publishes through
// GlassSettleContext — a progress SharedValue (0 → 1). We flip ready the moment
// it lands at ~1, exactly when that host's open animation stops, no guessing:
//   - Drawer (zoom): AnimatedContent's scale/opacity spring — it settles LATER
//     than the sheet's own slide, so it's the one that matters.
//   - Drawer (slide): the BottomSheet's animatedIndex reaching its snap index.
//   - Alert: the card's zoomIn finishing (onAnimationEnd → alertSettled).
//
// Outside any animated host there is no provider → progress is null → nothing is
// animating us → ready immediately (glass shows at once, no flicker). This is
// what keeps every static-screen button unaffected.
export default function useHostSettled () {
  const progress = useGlassSettleProgress()
  // No animated host → settled from the first render.
  const [settled, setSettled] = useState(progress == null)

  useAnimatedReaction(
    () => {
      if (progress == null) return true
      // The spring overshoots slightly then settles at 1; treat "basically 1" as
      // settled so we don't wait on the tail oscillation.
      return progress.value >= 0.99
    },
    (isSettled, prev) => {
      if (isSettled && !prev) runOnJS(setSettled)(true)
    },
    [progress]
  )

  return settled
}
