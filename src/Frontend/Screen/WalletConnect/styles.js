import { StyleSheet } from 'react-native'
import { Colors, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      // paddingBottom: pixelByHeight(24)
      paddingBottom: getSafeAreaValues().bottom
    },
    headerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: pixelByHeight(24)
    },
    accountInfo: {
      marginLeft: pixelByWidth(12)
    },
    textAccountName: {
    },
    textAccountAddress: {
      opacity: 0.6
    },
    listContainer: {
      paddingTop: pixelByHeight(8)
    },
    // Row: [avatar 40 + source badge] gap [content (name flex + chevron) + divider]
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      paddingLeft: pixelByWidth(0)
    },
    avatarWrap: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      // The source badge is pinned with a negative right/bottom offset (it overhangs
      // the avatar), so the wrap must not clip it.
      overflow: 'visible'
    },
    dappIcon: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      borderRadius: getSizeImgSquare('large'),
      backgroundColor: Colors.BG_ICON_NO_BG
    },
    // Connection-source badge (PC / mobile) pinned to the avatar's bottom-right.
    // dappDesktop/dappMobile are complete badges (coloured circle + glyph).
    badge: {
      position: 'absolute',
      right: -sizeImageSquare(2),
      bottom: -sizeImageSquare(2),
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
    },
    badgeImg: {
      width: '100%',
      height: '100%',
      // Override ImageRender's built-in overflow:'hidden' wrapper so the badge edge
      // isn't clipped.
      overflow: 'visible'
    },
    rowContent: {
      flex: 1,
      height: pixelByHeight(62),
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      borderBottomWidth: 1,
      borderBottomColor: Colors.BG_BOX_SMALL
    },
    dappName: {
      flex: 1,
      color: Colors.TEXT_MEDIUM
    },
    chevron: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
    },
    emptyWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: pixelByHeight(12),
      paddingVertical: pixelByHeight(48)
    },
    emptyIcon: {
      marginBottom: pixelByHeight(8)
    },
    containerButton: {
      gap: pixelByWidth(24)
    }

  })
}

export default createStyles
