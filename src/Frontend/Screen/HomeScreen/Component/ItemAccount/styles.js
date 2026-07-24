import { Colors, pixelByWidth, width } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    titleSection: {
      overflow: 'hidden'

    },
    containerTitle: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingRight: pixelByWidth(12),
      maxWidth: '100%',
      gap: pixelByWidth(12)

    },
    textOption: {
      flex: 1,
      flexShrink: 1,
      flexWrap: 'wrap',
      color: Colors.TEXT_MEDIUM
    },
    // Token balance: capped to ~45% of screen width and truncated to one line
    // (paired with numberOfLines={1}) so a very long balance can't overrun the
    // "Tokens" label. maxWidth (not flexShrink) is the reliable bound here — the
    // row's title uses flexBasis 0, which doesn't yield to flexShrink as expected.
    tokenBalance: {
      flexGrow: 0,
      flexShrink: 1,
      maxWidth: width(45),
      color: Colors.TEXT_LOW,
      textAlign: 'right'
    }

  })
}

export default createStyles
