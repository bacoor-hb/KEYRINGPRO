import { StyleSheet } from 'react-native'
import { getSafeAreaValues, getSizeImgSquare, height, pixelByHeight, pixelByWidth } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      paddingBottom: getSafeAreaValues().bottom
    },
    // Header: signature icon + "Signature request" title.
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      // paddingHorizontal: pixelByWidth(16),
      paddingVertical: pixelByHeight(12)
    },
    avatar: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      borderRadius: getSizeImgSquare('large')
    },
    body: {
      // paddingHorizontal: pixelByWidth(16),
      paddingTop: pixelByHeight(8),
      gap: pixelByHeight(14)
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    // Takes the width left of the avatar. No gap here — InfoAccountHeader's own
    // left padding already spaces the name/address off the avatar.
    accountInfo: {
      flex: 1
    },
    messageSection: {
      gap: pixelByHeight(8)
    },
    messageBox: {
      borderRadius: pixelByWidth(6),
      paddingHorizontal: pixelByWidth(8),
      paddingVertical: pixelByHeight(8),
      maxHeight: height(30)
    },
    buttons: {
      flexDirection: 'row',
      gap: pixelByWidth(14)
    }
  })
}

export default createStyles
