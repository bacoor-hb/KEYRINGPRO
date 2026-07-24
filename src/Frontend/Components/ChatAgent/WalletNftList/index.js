import React, { memo, useMemo, useState } from 'react'
import { View, Image, TouchableOpacity } from 'react-native'
import { WebView } from 'react-native-webview'
import images from 'assets/Image'
import MyText from 'frontend/Components/UI/MyText'
import styles from './styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

// Decode a `data:image/svg+xml` URI (base64 or url-encoded) to raw SVG markup.
const decodeSvgDataUri = (src) => {
  try {
    const comma = src.indexOf(',')
    if (comma === -1) return null
    const raw = src.slice(comma + 1)
    return src.slice(0, comma).includes('base64')
      ? Buffer.from(raw, 'base64').toString('utf8')
      : decodeURIComponent(raw)
  } catch (e) {
    return null
  }
}

const isSvgSource = (src) =>
  typeof src === 'string' && (src.startsWith('data:image/svg+xml') || /\.svg(\?.*)?$/i.test(src))

// Normalise an SVG source to something safe to drop into an <img src="…">:
// base64 data URIs and http(s) .svg URLs pass through; a url-encoded/utf8 data
// URI is decoded then re-encoded as base64 so the markup can never break out of
// the HTML attribute. Returns null when the payload can't be decoded.
const toImgSrc = (src) => {
  if (!/^data:image\/svg\+xml/i.test(src)) return src
  if (/;base64,/i.test(src)) return src
  const markup = decodeSvgDataUri(src)
  return markup ? `data:image/svg+xml;base64,${Buffer.from(markup, 'utf8').toString('base64')}` : null
}

// Minimal, script-free HTML that fits the image to the cell. Rendering the SVG
// through an <img> (rather than inline) is what makes this safe: per the SVG
// spec an <img>-referenced document cannot run scripts or fetch external
// resources, so untrusted on-chain art is neutralised.
const svgHtml = (src) =>
  '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">' +
  '<style>html,body{margin:0;padding:0;height:100%;background:transparent;overflow:hidden}' +
  'img{width:100%;height:100%;object-fit:contain;display:block}</style></head>' +
  `<body><img src="${src}"/></body></html>`

// One NFT's artwork, sized to a fixed square cell.
//   - SVG (on-chain art) → sandboxed WebView. RN's react-native-svg can abort
//     natively (SIGABRT) on the New Architecture for complex art, which crashes
//     the whole app; the system WebView renders any SVG safely and can't take
//     the process down.
//   - http(s) URLs / raster data URIs → RN <Image>.
//   - missing / failed → the default NFT-viewer icon, so the grid never breaks.
const NftImage = ({ image }) => {
  const [failed, setFailed] = useState(false)

  const svgSrc = useMemo(() => (isSvgSource(image) ? toImgSrc(image) : null), [image])

  if (!image || failed) {
    return (
      <View style={styles.placeholder}>
        <Image
          source={images.keyringLogo2}
          style={styles.placeholderImage}
          resizeMode='contain'
        />
      </View>
    )
  }

  if (svgSrc) {
    return (
      <WebView
        source={{ html: svgHtml(svgSrc) }}
        originWhitelist={['*']}
        style={styles.webview}
        opaque={false}
        javaScriptEnabled={false}
        scrollEnabled={false}
        scalesPageToFit={false}
        // Software layer: reliable transparency for static thumbnails and avoids
        // hardware-layer WebView rendering glitches/crashes on some Android devices.
        androidLayerType='software'
        setBuiltInZoomControls={false}
        onError={() => setFailed(true)}
        onRenderProcessGone={() => setFailed(true)}
      />
    )
  }

  return (
    <Image
      source={{ uri: image }}
      style={styles.image}
      resizeMode='contain'
      onError={() => setFailed(true)}
    />
  )
}

const NftCard = ({ nft }) => (
  <View style={styles.card}>
    {/* pointerEvents none so the artwork never steals taps/scroll from the chat */}
    <View style={styles.imageWrap} pointerEvents='none'>
      <NftImage image={nft.image} />
    </View>
    <MyTextTicker variant='small' numberOfLines={1} style={styles.name}>
      {nft.name}
    </MyTextTicker>
    <MyTextTicker variant='small' numberOfLines={1} style={styles.meta}>
      {`#${nft.tokenId}`}
    </MyTextTicker>
  </View>
)

/**
 * Gallery of the NFTs a wallet holds in one collection. Rendered from the
 * `WalletNftList` UIPayload emitted by the agent's get-wallet-nfts tool, so the
 * (often large `data:` base64) images arrive as structured props and are drawn
 * by the FE directly — they never pass through the chat text.
 *
 * props: { walletAddress, collectionName, nfts: [{ name, tokenId, contractAddress, image, chain }] }
 */
// Cap how many cards render at once: each SVG card is a WebView, and a wallet
// could hold a very large number in one collection — mounting hundreds of
// WebViews would strain memory. The rest are summarised as "+N more".
const MAX_VISIBLE = 20

const WalletNftList = ({ props }) => {
  const [expanded, setExpanded] = useState(false)

  const nfts = Array.isArray(props?.nfts) ? props.nfts : []
  if (nfts.length === 0) return null

  const visible = expanded ? nfts : nfts.slice(0, MAX_VISIBLE)
  const extra = nfts.length - visible.length

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {visible.map((nft, idx) => (
          <NftCard key={`${nft.contractAddress}-${nft.tokenId}-${nft.chain}-${idx}`} nft={nft} />
        ))}
      </View>
      {extra > 0 && (
        <TouchableOpacity activeOpacity={0.7} onPress={() => setExpanded(true)}>
          <MyText variant='small' style={styles.meta}>
            {`+${extra} more`}
          </MyText>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default memo(WalletNftList)
