import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { cn } from 'common/tailwind'
import MyText from 'frontend/Components/UI/MyText'
import createStyles from './styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'

const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'BACK']
]

/**
 * @param {(key: string) => void} [onPress] - callback when a digit key is pressed
 * @param {(() => void) | null} [onDelete] - callback when backspace is pressed
 * @param {string} [classNameHorizontal] - Tailwind class for row layout
 * @param {string} [classNameVertical] - Tailwind class for keypad container
 */
const MyKeyboardNumber = ({ onPress = () => { }, onDelete = null, classNameVertical }) => {
  const styles = createStyles()

  return (
    <View style={styles.keypad} className={cn('w-full', classNameVertical)}>
      {KEYPAD.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.keypadRow}>
          {row.map((key, colIdx) => {
            if (key === null) {
              return <View key={colIdx} style={styles.keySpacer} />
            }
            return (
              <TouchableOpacity
                key={colIdx}
                style={key === 'BACK' ? styles.keyBack : styles.key}
                onPress={() => {
                  if (key === 'BACK' && onDelete) {
                    onDelete()
                  } else {
                    onPress(key)
                  }
                }}
                activeOpacity={0.6}
              >
                {key === 'BACK' ? (
                  <ImageRender resizeMode='contain' uri={images.UIV2.icons.backspace} style={styles.keyIcon} />
                ) : (
                  <MyText style={styles.keyText}>{key}</MyText>
                )}
              </TouchableOpacity>
            )
          })}
        </View>
      ))}
    </View>
  )
}

export default MyKeyboardNumber
