import { useCallback, useEffect, useState } from 'react'
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'

// Hydrates a react-query cache from AsyncStorage once on mount so that a query
// can show the last persisted result (even after the app was killed) before its
// own network refetch resolves.
//
// Returns:
//   persisted — the persisted value (undefined until the AsyncStorage read settles)
//   persist   — writer to call (e.g. from useQuery's onSuccess) to update the snapshot
//   hydrated  — false until the initial AsyncStorage read settles, then true.
//               Callers use this to avoid flashing a loader on cold-start: while the
//               read is still in flight (persisted === undefined AND !hydrated) we
//               don't yet know whether cached data exists, so we must NOT report
//               loading. Only once hydrated is true and there's still no data do we
//               treat it as a real first-ever load.
const usePersistedQueryData = (storageKey) => {
  const [persisted, setPersisted] = useState(undefined)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let mounted = true
    setPersisted(undefined)
    setHydrated(false)
    getDataFromAsyncStorage(storageKey).then((cached) => {
      if (!mounted) return
      if (cached != null) setPersisted(cached)
      setHydrated(true)
    })
    return () => {
      mounted = false
    }
  }, [storageKey])

  const persist = useCallback((value) => {
    if (value != null) storeDataToAsyncStorage(storageKey, value)
  }, [storageKey])

  return [persisted, persist, hydrated]
}

export default usePersistedQueryData
