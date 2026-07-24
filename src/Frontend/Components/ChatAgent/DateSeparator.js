import React, { memo } from 'react'
import { View } from 'react-native'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import styles from './styles'

// Returns the milliseconds at the start of the day for a timestamp, so two
// timestamps on the same calendar day compare equal.
export const startOfDay = (ts) => {
  const d = new Date(ts || Date.now())
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Whether a message should show a date separator above it: true for the first
// message, or whenever its day differs from the previous message's day.
export const shouldShowDateSeparator = (current, previous) => {
  if (!previous) return true
  return startOfDay(current?.timestamp) !== startOfDay(previous?.timestamp)
}

// Human label for a day: Today / Yesterday, otherwise a full date.
const formatDayLabel = (ts) => {
  const day = startOfDay(ts)
  const today = startOfDay(Date.now())
  const oneDay = 24 * 60 * 60 * 1000
  if (day === today) return I18n.t('v2.common.today')
  if (day === today - oneDay) return I18n.t('v2.common.yesterday')
  return new Date(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Centered day label rendered between messages from different days.
const DateSeparator = ({ timestamp }) => (
  <View style={styles.dateSeparator}>
    <MyText variant='small' className='text-medium' style={styles.dateSeparatorText}>
      {formatDayLabel(timestamp)}
    </MyText>
  </View>
)

export default memo(DateSeparator)
