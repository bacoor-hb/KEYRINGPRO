import { createContext, useContext, useEffect } from 'react'
import { useSharedValue } from 'react-native-reanimated'

// A host that opens with an animation (drawer, alert, …) runs that animation ON
// TOP of / around the glass surfaces inside it. iOS materializes the liquid
// glass on whatever transform state the view has at commit time, so a surface
// committed WHILE its host is still animating renders broken and never repaints.
//
// The host publishes an animation-progress SharedValue here (0 → 1, where 1 =
// fully settled). `useHostSettled` reads it to promote a surface to real glass
// only once the host stopped animating. Default null = "no animated host around
// me" → settled immediately (static-screen surfaces are unaffected).
const GlassSettleContext = createContext(null)

export const GlassSettleProvider = GlassSettleContext.Provider

export const useGlassSettleProgress = () => useContext(GlassSettleContext)

// Convenience wrapper for hosts that only know settle as a BOOLEAN (e.g. an
// Animatable alert firing onAnimationEnd) rather than a reanimated value. Bridges
// the boolean to a SharedValue (0/1) and provides it. `settled=false` until the
// open animation ends, then true.
export const SettleGate = ({ settled, children }) => {
  const progress = useSharedValue(settled ? 1 : 0)
  useEffect(() => {
    progress.value = settled ? 1 : 0
  }, [settled, progress])
  return <GlassSettleProvider value={progress}>{children}</GlassSettleProvider>
}

export default GlassSettleContext
