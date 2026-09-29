import { initialWindowMetrics } from 'react-native-safe-area-context'
import { getDataFromSyncStorage, storeDataToSyncStorage } from './storage/syncStorage'

const DEFAULT_VALUE_BOTTOM = 24
const DEFAULT_VALUE_TOP = 24
const DEFAULT_VALUE_ANDROID_TOP = 10

// Safe-area insets resolver with MMKV cache.
// Guards null initialWindowMetrics (crash on notification cold-start)
// and persists real measured insets across launches.

// Returns raw initialWindowMetrics or null when unavailable.
export const getInitialWindowMetrics = () => {
  try {
    if (initialWindowMetrics && initialWindowMetrics.insets) {
      return initialWindowMetrics
    }

    return null
  } catch (error) {
    return null
  }
}

// Returns cached insets, else falls back to metrics then defaults.
export const getSafeAreaValues = () => {
  const cached = getDataFromSyncStorage('safeArea', null)

  if (cached) {
    return cached
  }

  const metrics = getInitialWindowMetrics()

  if (metrics) {
    const { top, bottom } = metrics.insets
    const normalized = normalize(top, bottom)
    writeToStorage(normalized)

    return normalized
  }

  return getDefaults()
}

// Persists real measured insets (from useSafeAreaInsets) to cache.
export const setSafeAreaValues = (values) => {
  const bottom = values?.bottom ?? DEFAULT_VALUE_BOTTOM
  const top = values?.top ?? DEFAULT_VALUE_TOP

  const normalized = normalize(top, bottom)
  writeToStorage(normalized)
}

// Clamps insets to minima and forces Android top value.
const normalize = (top, bottom) => {
  let normalizedTop = top
  let normalizedBottom = bottom

  if (normalizedBottom < DEFAULT_VALUE_BOTTOM) {
    normalizedBottom = DEFAULT_VALUE_BOTTOM
  }

  if (normalizedTop < DEFAULT_VALUE_TOP) {
    normalizedTop = DEFAULT_VALUE_TOP
  }

  if (!ISIOS) {
    normalizedTop = DEFAULT_VALUE_ANDROID_TOP
  }

  return { top: normalizedTop, bottom: normalizedBottom }
}

// Fallback values when no cache and no metrics available.
const getDefaults = () => ({
  top: ISIOS ? DEFAULT_VALUE_TOP : DEFAULT_VALUE_ANDROID_TOP,
  bottom: DEFAULT_VALUE_BOTTOM
})

// Writes normalized insets to cache.
const writeToStorage = (values) => {
  storeDataToSyncStorage('safeArea', values)
}
