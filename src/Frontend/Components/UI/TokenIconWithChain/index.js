import React from 'react'
import { View, StyleSheet } from 'react-native'
import { sizeImageSquare, Colors, getSizeImgSquare } from 'common/styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { getChainIconByChain } from 'common/chain'
import images from 'assets/Image'

const TOKEN_SIZE = getSizeImgSquare('large')
const BADGE_SIZE = getSizeImgSquare('small')

const styles = StyleSheet.create({
  container: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE
  },
  tokenIcon: {
    width: TOKEN_SIZE,
    height: TOKEN_SIZE,
    borderRadius: TOKEN_SIZE / 2,
    backgroundColor: Colors.BG_ICON_NO_BG
  },
  // White ring around the chain badge (same pattern as ListChain/ChainRow). No
  // overflow:'hidden' so the native FastImage/SvgUri inside isn't clipped — that
  // clip layer crashes Fabric on unmount.
  badgeWrap: {
    position: 'absolute',
    right: -sizeImageSquare(2),
    bottom: -sizeImageSquare(2),
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: Colors.BLACK,
    borderWidth: 1,
    borderColor: Colors.WHITE,
    justifyContent: 'center',
    alignItems: 'center'
  },
  // Core = BADGE_SIZE minus the LITERAL 2px ring (1px each side). Subtract a plain
  // 2, not `sizeImageSquare(2)` — the border isn't scaled by sizeImageSquare, so
  // scaling the 2 only matches when the ratio is exactly 1.
  badgeIcon: {
    width: BADGE_SIZE - 2,
    height: BADGE_SIZE - 2,
    borderRadius: (BADGE_SIZE - 2) / 2
  }
})

/**
 * @param {string} [chainIconUrl] - explicit chain badge icon URL
 * @param {string} tokenIconUri - token icon URL
 * @param {number|string} [chainId] - chain for auto-resolved badge icon
 * @param {StyleProp<ViewStyle>} [style] - override container style
 * @param {boolean} [hideChainBadge] - hide the chain badge overlay
 */
const TokenIconWithChain = ({ chainIconUrl, tokenIconUri, chainId, style, hideChainBadge = false }) => {
  const chainIcon = chainId ? getChainIconByChain(chainId) : null

  return (
    <View style={[styles.container, style]}>
      <ImageRender uri={tokenIconUri} uriDefault={images.UIV2.icons.unknowToken} style={styles.tokenIcon} resizeMode='cover' />
      {!hideChainBadge && !!(chainIcon || chainIconUrl) && (
        <View style={styles.badgeWrap}>
          <ImageRender uri={chainIconUrl || chainIcon} style={styles.badgeIcon} resizeMode='cover' />
        </View>
      )}
    </View>
  )
}

export default TokenIconWithChain
