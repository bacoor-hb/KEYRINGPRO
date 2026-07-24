import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, fontSize, getSafeAreaValues } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      gap: pixelByHeight(8)
    },
    listToken: {
      paddingBottom: getSafeAreaValues().bottom
    },
    containerToken: {
      display: 'flex',
      flexDirection: 'row',
      gap: pixelByWidth(12)
    },
    emptyWrap: {
      flex: 1,
      paddingHorizontal: pixelByWidth(16),
      paddingTop: pixelByHeight(48),
      alignItems: 'center'
    },
    emptyTitle: {
      fontSize: fontSize('small')
    },
    emptyIcon: {
      marginBottom: pixelByHeight(8)
    },
    emptySpacer: {
      paddingVertical: pixelByHeight(50)
    }

  })
}

export default createStyles
