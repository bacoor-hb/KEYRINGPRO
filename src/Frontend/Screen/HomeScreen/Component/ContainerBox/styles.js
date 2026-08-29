import { StyleSheet } from 'react-native'

const buildStyles = () => {
  return StyleSheet.create({
    containerBox: {
      position: 'relative',
      overflow: 'hidden'
    }

  })
}

// Built once, then cached. These values are static (the app is dark-mode only),
// so rebuilding the sheet on every render only burned CPU and — worse — handed
// children a brand new style identity each time, defeating their memoization.
let cachedStyles = null

const createStyles = () => {
  if (!cachedStyles) {
    cachedStyles = buildStyles()
  }
  return cachedStyles
}

export default createStyles
