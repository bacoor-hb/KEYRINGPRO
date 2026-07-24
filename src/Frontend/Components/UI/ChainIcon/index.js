import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Colors, getSizeImgSquare } from 'common/styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { getChainIconByChain } from 'common/chain'
import images from 'assets/Image'

/**
 * Standalone chain icon with white ring. No overflow:'hidden' to avoid Fabric
 * clip-layer crash on unmount.
 *
 * @param {number|string} chainId - chainId or chainType for icon lookup
 * @param {number} [size] - outer ring diameter in px (default small)
 * @param {StyleProp<ViewStyle>} [style] - override ring container style
 * @param {string} [uri] - explicit icon URL override
 */
const ChainIcon = ({ chainId, size = getSizeImgSquare('small'), style, uri }) => {
  const chainIcon = uri || (chainId != null ? getChainIconByChain(chainId) : null)
  const ringStyle = {
    width: size,
    height: size,
    borderRadius: size / 2
  }
  const innerStyle = {
    width: size - 2,
    height: size - 2,
    borderRadius: (size - 2) / 2
  }

  return (
    <View style={[styles.ring, ringStyle, style]}>
      <ImageRender
        uri={chainIcon}
        uriDefault={images.UIV2.icons.unknowChain}
        style={innerStyle}
        resizeMode='cover'
      />
    </View>
  )
}

const styles = StyleSheet.create({
  ring: {
    backgroundColor: Colors.BLACK,
    borderWidth: 1,
    borderColor: Colors.WHITE,
    justifyContent: 'center',
    alignItems: 'center'
  }
})

export default ChainIcon
