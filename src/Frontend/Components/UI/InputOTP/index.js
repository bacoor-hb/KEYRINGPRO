import { View } from 'react-native'
import React from 'react'
import styles from './styles'
import MyText from '../MyText'

const PASSCODE_LENGTH = 4
const InputOTP = ({ length = PASSCODE_LENGTH, showValue = false, passcode = '' }) => {
  return (
    <View style={styles.pinRow}>
      {Array.from({ length }).map((_, idx) => {
        const filled = idx < passcode?.length
        return (
          <View key={idx} style={styles.pinBox}>
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
