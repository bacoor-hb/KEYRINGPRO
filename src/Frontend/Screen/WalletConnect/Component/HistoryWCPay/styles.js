import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, sizeImageSquare, fontSize, getSafeAreaValues } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      gap: pixelByHeight(8),
      flex: 1,
      paddingTop: pixelByHeight(14),
      paddingBottom: pixelByHeight(14)

    },
    itemRow: {
      gap: pixelByHeight(4)
    },
    accountContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(8),
      position: 'relative'
    },
    containerIconChain: {
      position: 'absolute',
      bottom: sizeImageSquare(-3),
      right: sizeImageSquare(-3)
    },
    emptyWrap: {
      flex: 1,
      paddingHorizontal: pixelByWidth(16),
      paddingTop: pixelByHeight(48),
      alignItems: 'center'
    },
    emptyIcon: {
      marginBottom: pixelByHeight(8)
    },
    emptyTitle: {
      fontSize: fontSize('small')
    },
    emptySpacer: {
      paddingVertical: pixelByHeight(50)
    },
    listContent: {
      paddingTop: pixelByHeight(64) - pixelByHeight(14),
      paddingBottom: getSafeAreaValues().bottom
    }
  })
}

export default createStyles
