import { useCallback, useState } from 'react'
import { InteractionManager } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'

// Ceiling on how long the gate may wait for runAfterInteractions. Not a nicety:
// whatever holds off on this hook is holding back something the user is
// entitled to see — a balance odometer that is parked keeps the PREVIOUS number
// on screen — so a leaked interaction handle must not be able to hold it
// forever. Whichever fires first wins.
const FOCUS_FALLBACK_MS = 1000

// "This screen is the one on screen, and it has stopped moving."
//
// Written for the balance odometer, which must not spend its animation where
// nobody can see it. Two things have to be true:
//   - the screen is focused. A native stack keeps every screen below the top
//     one MOUNTED, so being rendered says nothing about being visible — and a
//     screen here can push others (the QR scanner, AI search) and have a
//     balance refresh land while it is behind them.
//   - its transition has finished. `useIsFocused` flips at the START of the
//     push/pop animation, which would spend the animation under a moving screen.
//
// Deliberately says nothing about drawers: a bottom sheet leaves the top of the
// screen visible, so a balance changing behind one is seen just fine.
//
// This is TokenList/page.js's `rowsVisible` extracted; that screen still has its
// own inline copy. Prefer the hook for new code.
const useOnScreenSettled = () => {
  const [settled, setSettled] = useState(false)

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => setSettled(true))
      const fallback = setTimeout(() => setSettled(true), FOCUS_FALLBACK_MS)
      return () => {
        task.cancel()
        clearTimeout(fallback)
        setSettled(false)
      }
    }, [])
  )

  return settled
}

export default useOnScreenSettled
