import React, { useEffect, useState } from 'react'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'

// Stays hidden for `delay` ms, then mounts the DotLottie. It is mounted fresh
// with autoplay on, so it starts from frame 0 the moment it appears.
export default function DelayedDotLottie ({ delay = 1000, ...props }) {
  const [visible, setVisible] = useState(delay <= 0)

  useEffect(() => {
    if (delay <= 0) return
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  if (!visible) return null

  return (
    <DotLottie
      autoplay
      {...props}
    />
  )
}
