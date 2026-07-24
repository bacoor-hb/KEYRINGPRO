import { StyleSheet } from 'react-native'
import { Colors, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },
    // Header: file icon (black circle) + "Manage requests". No close button — swipe.
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      paddingHorizontal: pixelByWidth(16),
      paddingVertical: pixelByHeight(12)
    },
    // Modal-header icon convention: glyph inside a black round box.
    headerIconWrap: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      borderRadius: getSizeImgSquare('large'),
      backgroundColor: Colors.BLACK,
      alignItems: 'center',
      justifyContent: 'center'
    },
    headerIcon: {
      width: getSizeImgSquare('medium'),
      height: getSizeImgSquare('medium')
    },
    bodyScroll: {
      flex: 1
    },
    body: {
      // paddingHorizontal: pixelByWidth(16),
      marginTop: pixelByHeight(8),
      paddingBottom: getSafeAreaValues().bottom + pixelByHeight(8),
      gap: pixelByHeight(14)
    },
    // Each section card (same surface as the AI / input cards).
    card: {
      borderRadius: pixelByWidth(16),
      paddingHorizontal: pixelByWidth(12),
      paddingVertical: pixelByHeight(12),
      gap: pixelByHeight(8)
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: pixelByWidth(12)
    },
    rowValue: {
      flexShrink: 1,
      textAlign: 'right'
    },
    stackValue: {
      marginTop: pixelByHeight(4)
    },
    decodeItem: {
      gap: pixelByHeight(4)
    }
  })
}

export default createStyles
