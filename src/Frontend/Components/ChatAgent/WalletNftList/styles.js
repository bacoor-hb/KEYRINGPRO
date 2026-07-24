import { StyleSheet } from 'react-native'
import { pixelByWidth, pixelByHeight, Colors, width } from 'common/styles'

// Fixed square cell so the grid stays uniform regardless of each token's own
// aspect ratio. ~2 columns on a phone. Exported because the WebView (SVG branch)
// needs an explicit numeric size.
export const NFT_IMAGE_SIZE = width(100 / 2) - pixelByWidth(16) - pixelByWidth(16)

// Inner artwork size = the square cell minus the wrapper's padding on both
// sides, so the image fits *inside* the padded frame instead of overflowing it.
const NFT_IMAGE_PADDING = pixelByHeight(8)
const NFT_IMAGE_INNER = NFT_IMAGE_SIZE - NFT_IMAGE_PADDING * 2

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginVertical: pixelByHeight(6)
  },
  heading: {
    color: Colors.WHITE,
    marginBottom: pixelByHeight(8)
  },
  // Two-up grid: cards keep their fixed width and wrap; space-between supplies
  // the column gutter without depending on RN's `gap` support.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  card: {
    width: NFT_IMAGE_SIZE,
    // gap: pixelByHeight(8),
    marginBottom: pixelByHeight(16)
  },
  // Clips the artwork (Image or WebView) to rounded corners via overflow hidden
  // and reserves the square before it loads.
  imageWrap: {
    padding: NFT_IMAGE_PADDING,
    width: NFT_IMAGE_SIZE,
    height: NFT_IMAGE_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.GRAY4 || 'rgba(255,255,255,0.06)'
  },
  image: {
    width: NFT_IMAGE_INNER,
    height: NFT_IMAGE_INNER
  },
  // WebView-rendered SVG cell. Transparent so it blends into the bubble; the
  // fixed square keeps the grid uniform.
  webview: {
    width: NFT_IMAGE_INNER,
    height: NFT_IMAGE_INNER,
    backgroundColor: 'transparent'
  },
  placeholder: {
    width: NFT_IMAGE_INNER,
    height: NFT_IMAGE_INNER,
    alignItems: 'center',
    justifyContent: 'center'
  },
  // Default artwork shown when an NFT has no image / fails to load. Kept smaller
  // than the cell so it reads as an icon rather than a broken/stretched image.
  placeholderImage: {
    width: NFT_IMAGE_INNER * 0.5,
    height: NFT_IMAGE_INNER * 0.5,
    opacity: 0.3
  },
  name: {
    marginTop: pixelByHeight(8)
  },
  meta: {
    color: Colors.TEXT_MEDIUM,
    marginTop: pixelByHeight(2)
  }
})

export default styles
