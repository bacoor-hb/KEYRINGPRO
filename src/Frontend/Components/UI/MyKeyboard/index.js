import React, { useContext } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { cn } from 'common/tailwind'
import { IconType, MODE_THEME } from 'common/constants/app'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import createStyles from './styles'

/**
 * @param {(key: string) => void} onPress - Callback when a key is pressed
 * @param {() => void} onDelete - Callback when delete key is pressed
 * @param {string} classNameHorizontal - Tailwind class for each row
 * @param {string} classNameVertical - Tailwind class for the outer container
 */
const MyKeyboard = ({ onPress = () => { }, onDelete = () => { }, classNameHorizontal, classNameVertical }) => {
  const { modeTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode)

  const rows = [
    ['1', '2', '3', '4', '5'],
    ['6', '7', '8', '9', '0'],
    ['a', 'b', 'c', 'd', 'e'],
    [null, null, 'f', null, 'delete', null, null]
  ]

  const renderKey = (key, index) => {
    if (key === null) {
      return (
        <View
          key={`empty-${index}`}
          style={styles.empty}
        />
      )
    }

    if (key === 'delete') {
      return (
        <TouchableOpacity
          key='delete'
          onPress={onDelete}
          activeOpacity={0.5}
          style={styles.key}
        >
          <MyIcon
            name='backspace-outline'
            typeIcon={IconType.Ionicons}
            variant='medium'
            color='white'
            style={styles.icon}
          />
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity
        key={key}
        onPress={() => onPress(key)}
        activeOpacity={0.5}
        style={styles.key}
      >
        <MyText
          variant='subTitle'
          style={styles.text}
          fontWeight={700}
        >
          {key}
        </MyText>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container} className={cn('w-full', classNameVertical)}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row} className={classNameHorizontal}>
          {row.map((key, keyIndex) => renderKey(key, keyIndex))}
        </View>
      ))}
    </View>
  )
}

export default MyKeyboard
