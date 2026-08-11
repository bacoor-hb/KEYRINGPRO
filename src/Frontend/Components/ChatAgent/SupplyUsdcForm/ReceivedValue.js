import React from 'react'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import { View } from 'react-native'
import { pixelByWidth } from 'common/styles'

/**
 * The figure + unit inside the "Est. Received" panel.
 *
 * Presentation only, shared by every protocol so the row looks identical
 * whatever produced the number; each protocol decides WHAT the number is.
 * A null value renders "0" — the resting state before an amount is typed, and
 * what a vault shows while its preview is still in flight.
 */
export default function ReceivedValue ({ value, unit }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: pixelByWidth(8)
      }}>
      <View
        style={{
          flex: 1
        }}>
        <MyTextTicker variant='default' className='font-semibold'>
          {value == null ? '0' : value}
        </MyTextTicker>
      </View>
      <View>
        <MyText className='text-medium'>{unit}</MyText>
      </View>

    </View>
  )
}
