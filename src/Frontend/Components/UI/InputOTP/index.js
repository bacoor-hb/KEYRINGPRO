import { View } from 'react-native'
import React from 'react'
import styles from './styles'
import MyText from '../MyText'

const PASSCODE_LENGTH = 4
const InputOTP = ({ length = PASSCODE_LENGTH, showValue = false, passcode = '' }) => {
  // The box size is tuned for 4 digits; six of them (KeyRing Hard Wallet cards)
  // would run past a 375pt design width. Shrink the boxes and the gap instead of
  // letting the row overflow the screen.
  const isCompact = length > PASSCODE_LENGTH
  return (
    <View style={[styles.pinRow, isCompact && styles.pinRowCompact]}>
      {Array.from({ length }).map((_, idx) => {
        const filled = idx < passcode?.length
        return (
          <View key={idx} style={[styles.pinBox, isCompact && styles.pinBoxCompact]}>
            {filled ? (
              showValue ? (
                <MyText>
                  {passcode[idx]}
                </MyText>
              ) : (
                <View style={styles.pinDot} />
              )
            ) : (
              <View style={styles.pinDash} />
            )}
          </View>
        )
      })}
    </View>
  )
}

export default InputOTP
