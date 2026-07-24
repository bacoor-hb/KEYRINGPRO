import React, { useEffect, useState } from 'react'
import MyText from 'frontend/Components/UI/MyText'
import I18n from 'assets/Lang'

// Build the localized "Update: ..." relative-time string from the last balance
// sync ts. Each bucket is a full sentence with a {{value}} placeholder so
// translators can position the number freely per language; singular vs plural is
// chosen by key (minute/minutes, hour/hours, day/days). No seconds granularity —
// it reads "now" for the whole first minute.
const formatSyncAgo = (ts) => {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return I18n.t('v2.balanceSync.now')
  const m = Math.floor(s / 60)
  if (m < 60) return I18n.t(`v2.balanceSync.${m === 1 ? 'minute' : 'minutes'}`, { value: m })
  const h = Math.floor(m / 60)
  if (h < 24) return I18n.t(`v2.balanceSync.${h === 1 ? 'hour' : 'hours'}`, { value: h })
  const d = Math.floor(h / 24)
  return I18n.t(`v2.balanceSync.${d === 1 ? 'day' : 'days'}`, { value: d })
}

// Self-contained ticking label so only this one line re-renders (not the whole
// TokenList / its rows). Self-rescheduling timeout: during the first minute the
// text stays "now", so we just wake exactly at the 60s mark (no wasted re-renders
// while it says "now"); after that, minute granularity, so tick every 30s.
const BalanceSyncLabel = ({ lastSyncedAt, style }) => {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!lastSyncedAt) return
    let id
    const schedule = () => {
      const ageSec = (Date.now() - lastSyncedAt) / 1000
      const delay = ageSec < 60 ? (60 - ageSec) * 1000 : 30000
      id = setTimeout(() => {
        setTick((n) => n + 1)
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(id)
  }, [lastSyncedAt])

  if (!lastSyncedAt) return null
  return (
    <MyText variant='small' style={style}>{formatSyncAgo(lastSyncedAt)}</MyText>
  )
}

export default BalanceSyncLabel
