import React from 'react'
import { View, TouchableOpacity } from 'react-native'

import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import styles from '../styles'

// The amount-row primitives, transcribed from the Send drawer so both drawers'
// fields are the same control rather than two lookalikes that drift apart.
//
// Kept out of the screen file because they are pure presentation with no
// knowledge of a withdrawal: the same three pieces build the withdrawal row, the
// refund row, and any row a later section needs.

/**
 * Circular action button at the right of a field (the Max button).
 *
 * `onPress` doubles as the enabled flag — pass null to render it inert, which is
 * how the caller disables Max while the position is still loading.
 */
export const CircleButton = ({ onPress, label }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    disabled={!onPress}
    style={styles.iconBtn}
    onPress={onPress}
  >
    <MyText variant='small' className='text-brand'>{label}</MyText>
  </TouchableOpacity>
)

/** Inline hint (icon + colored text), used inside the reserved error slot. */
export const HintRow = ({ icon, className, text }) => (
  <View style={styles.hintRow}>
    {icon ? <MyIcon uri={icon} style={styles.hintIcon} resizeMode='contain' /> : null}
    <MyText variant='small' className={className}>{text}</MyText>
  </View>
)

/**
 * One amount row: [left token icon] + an underlined section holding the value
 * and an optional right-hand control.
 *
 * The underline deliberately runs through the value AND the right control but
 * NOT the left icon, which sits outside the bordered section — the same anatomy
 * the Send drawer uses.
 */
export const Field = ({ leftIcon, rightButton, children, style }) => (
  <View style={[styles.fieldRow, style]}>
    {leftIcon ? <View style={styles.fieldSide}>{leftIcon}</View> : null}
    <View style={styles.fieldLine}>
      <View style={styles.fieldInputPlain}>{children}</View>
      {rightButton ? <View style={styles.fieldSide}>{rightButton}</View> : null}
    </View>
  </View>
)
