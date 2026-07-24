import { useEffect } from 'react'
import BootSplash from 'react-native-bootsplash'

const AppEmptyForFirebaseNotiWhenAppQuit = () => {
  useEffect(() => {
    (async () => {
      await BootSplash.hide({ fade: true })
    })()
  }, [])

  return null
}

export default AppEmptyForFirebaseNotiWhenAppQuit
