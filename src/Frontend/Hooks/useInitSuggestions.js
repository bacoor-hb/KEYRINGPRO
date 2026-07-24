import { useCallback, useEffect, useRef, useState } from 'react'
import {
  areSuggestionsVisible,
  refreshSuggestions,
  dismissSuggestions,
  markSuggestionsLeft
} from 'common/aiSearchHistory'

/**
 * Drives the AI Search init suggestion pills for one (address, session) thread.
 *
 * The rules, in full:
 *  - Showing pills STAY showing. Only a user interaction (`dismiss`) takes them
 *    down, so navigating away and back — at any speed, any number of times —
 *    can never hide them.
 *  - Once dismissed they stay hidden until ONE absence from the screen has
 *    lasted SUGGESTIONS_IDLE_MS. Every departure restarts that clock, so
 *    returning early costs the time already served. Sitting on the screen does
 *    not count at all, so they can never reappear underneath someone who is
 *    still reading.
 *  - Killing the app clears everything, so a relaunch always shows them again.
 *
 * @param {object}   params
 * @param {string}   params.address     Wallet address for the thread. Empty
 *   until it resolves, which this hook waits for rather than acting on.
 * @param {string}   [params.session]   AI_SEARCH_SESSION bucket.
 * @param {object}   [params.navigation] React Navigation object for this screen.
 * @returns {{ visible: boolean, dismiss: () => void }}
 */
export default function useInitSuggestions ({ address, session, navigation }) {
  const [visible, setVisible] = useState(false)

  // Read by listeners and by the unmount cleanup, which must see the CURRENT
  // thread rather than the one captured when they were registered.
  const addressRef = useRef(address)
  addressRef.current = address
  const sessionRef = useRef(session)
  sessionRef.current = session

  // Re-evaluate whenever the thread changes. `address` starts empty and resolves
  // a render later, so this runs again the moment it lands — a mount is not a
  // single point in time and treating it as one is what previously left threads
  // stuck hidden.
  useEffect(() => {
    if (!address) return
    setVisible(refreshSuggestions(address, session))
  }, [address, session])

  // Leaving starts the idle clock; returning re-evaluates it.
  //
  // The unmount cleanup has EMPTY deps on purpose: it is the departure stamp for
  // a screen that is popped (goBack), where a 'blur' handler races the very
  // unmount that removes it and may never fire. Anything in the dependency array
  // would re-run this cleanup on a plain re-render and stamp a departure that
  // never happened.
  useEffect(() => () => markSuggestionsLeft(addressRef.current, sessionRef.current), [])

  // 'blur'/'focus' cover the case where the screen stays MOUNTED under another
  // one, which the unmount cleanup and the thread effect both miss.
  useEffect(() => {
    if (!navigation?.addListener) return
    const onBlur = () => markSuggestionsLeft(addressRef.current, sessionRef.current)
    const onFocus = () => {
      // Until the address resolves there is no thread to answer for, and acting
      // on that would hide pills that ought to be showing.
      if (!addressRef.current) return
      setVisible(refreshSuggestions(addressRef.current, sessionRef.current))
    }
    const blurSub = navigation.addListener('blur', onBlur)
    const focusSub = navigation.addListener('focus', onFocus)
    return () => { blurSub?.(); focusSub?.() }
  }, [navigation])

  // The user interacted (tapped a pill, or sent any message).
  const dismiss = useCallback(() => {
    dismissSuggestions(addressRef.current, sessionRef.current)
    setVisible(false)
  }, [])

  // Guard the render on the address too: `visible` is false for the first render
  // of every mount, and areSuggestionsVisible is the authority once it is known.
  return {
    visible: visible && !!address && areSuggestionsVisible(address, session),
    dismiss
  }
}
