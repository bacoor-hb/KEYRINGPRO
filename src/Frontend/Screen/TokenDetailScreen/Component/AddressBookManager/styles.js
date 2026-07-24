import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSizeImgSquare, PADDING_TOP_CONTAINER_DRAWER, pixelByHeight, pixelByWidth, width } from 'common/styles'

const AVATAR_SIZE = getSizeImgSquare('large')
// Address-book entry avatars are smaller than account avatars (per Figma).
const AB_AVATAR_SIZE = getSizeImgSquare('medium')

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: PADDING_TOP_CONTAINER_DRAWER
    },
    // Whole page scrolls (outer). The Address book NFT list flows here, while the
    // My account list below has its own bounded inner scroll.
    pageContent: {
      paddingTop: getHeightHeaderDrawer()
    },
    sectionTitle: {
      color: Colors.WHITE,
      marginBottom: pixelByHeight(4)
    },
    // Space above the "Address book NFT" header so it clears the section above.
    sectionTitleSpaced: {
      marginTop: pixelByHeight(16)
    },
    // My account list scrolls internally once it exceeds ~3 rows; the rest of the
    // page (NFT list + footer) scrolls in the outer ScrollView.
    myAccountScroll: {
      maxHeight: pixelByHeight(72 * 3)
    },
    // Flat row (avatar + text), same layout as the WalletConnect account list. The
    // divider is absolute so it doesn't add to the row height; padding makes 1-line
    // (address book) and 2-line (account) rows both look balanced.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    rowInfo: {
      flex: 1,
      gap: pixelByHeight(2)
    },
    // Bottom divider inset so it starts past the avatar (left = avatar + gap).
    rowDivider: {
      position: 'absolute',
      left: AVATAR_SIZE + pixelByWidth(12),
      right: 0,
      bottom: 0,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.08)'
    },
    // Same divider but inset for the smaller address-book entry avatar.
    rowDividerNft: {
      position: 'absolute',
      left: AB_AVATAR_SIZE + pixelByWidth(12),
      right: 0,
      bottom: 0,
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.08)'
    },
    abAvatarWrap: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      justifyContent: 'center',
      alignItems: 'center'
    },
    // Round avatar wrapper for address-book entries (account avatars are already round).
    abAvatar: {
      width: AB_AVATAR_SIZE,
      height: AB_AVATAR_SIZE,
      borderRadius: AB_AVATAR_SIZE / 2
    },
    abAvatarImg: {
      width: AB_AVATAR_SIZE,
      height: AB_AVATAR_SIZE,
      borderRadius: AB_AVATAR_SIZE / 2
    },
    deleteBtn: {
      paddingHorizontal: pixelByWidth(4)
    },
    // Empty state for the Address book NFT section (matches the Figma intro): a
    // centered description + the phone illustration.
    emptyWrap: {
      alignItems: 'center',
      paddingTop: pixelByHeight(8)
    },
    emptyDesc: {
      textAlign: 'center'
    },
    emptyImg: {
      width: width(100) - pixelByWidth(64),
      aspectRatio: 990 / 1179
    },
    // In the empty state the link sits between the description and the image:
    // 14px above, 50px below (overrides linkRow's default top margin).
    emptyLink: {
      marginTop: pixelByHeight(14)
      // marginBottom: pixelByHeight(50)
    },
    // "What is Address Book NFT?" link (footer when there are entries).
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: pixelByWidth(6),
      marginTop: pixelByHeight(16)
    }
  })
}

export default createStyles
