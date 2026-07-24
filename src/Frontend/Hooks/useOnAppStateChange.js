import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

export function useOnAppStateChange (handleAppStateChange) {
  const handler = useRef(handleAppStateChange)

  useEffect(() => {
    handler.current = handleAppStateChange
  }, [handleAppStateChange])

  useEffect(() => {
    // Initial check
    handler.current(AppState.currentState)

    // Check when appState changes
    const listener = AppState.addEventListener('change', (appState) => {
      handler.current(appState)
    })

    return listener.remove
  }, [])
}
