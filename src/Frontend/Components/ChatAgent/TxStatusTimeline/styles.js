import { StyleSheet } from 'react-native'
import { width, height, pixelByHeight, pixelByWidth, getSizeImgSquare } from 'common/styles'

const COPY_SIZE = getSizeImgSquare('large')
const ICON_SIZE = getSizeImgSquare('large') // MyIcon variant='large' renders at 40

// Layout only — colors live in Tailwind className, text sizing in MyText variants.
const styles = StyleSheet.create({
  // ─── status timeline (compact; icon column + connector + body) ──────────────
  statusWrap: { marginTop: height(1.5), gap: pixelByHeight(6) },
  stepRow: { flexDirection: 'row' },
  stepRowCenter: { flexDirection: 'row', alignItems: 'center' },
  // Success/Fail result row (StatusMessage) — vertically center the animation
  // against the title, matching the RegisterAddress / SendToken result rows.
  statusResult: { alignItems: 'center' },
  // Icon column (matches MyIcon variant='large') + centered connector below.
  stepLeft: { width: ICON_SIZE, alignItems: 'center', marginRight: pixelByWidth(12), gap: pixelByHeight(6) },
  connector: { width: pixelByWidth(2), flex: 1, marginVertical: pixelByHeight(4), minHeight: pixelByHeight(16), borderRadius: 1 },
  stepBody: { flex: 1, paddingBottom: pixelByHeight(6) },
  stepBodyLast: { flex: 1 },
  stepDesc: { marginTop: pixelByHeight(2) },
  // "Sending" title + inline loading dots while the broadcast hash is pending.
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  // Only the gap from the title — size comes from MyDotsLoading's default variant.
  titleDots: { marginLeft: width(1) },
  // Explorer fallback shown under "Sending" until the tx hash arrives.
  explorerHint: { marginTop: pixelByHeight(8) },
  explorerLink: { marginTop: pixelByHeight(4) },

  ctaWrap: { marginTop: height(1) },

  hashRow: { flexDirection: 'row', alignItems: 'center', gap: pixelByWidth(12), marginTop: pixelByHeight(8) },
  hashTextWrap: { flex: 1 },
  copyBtn: { width: COPY_SIZE, height: COPY_SIZE, alignItems: 'center', justifyContent: 'center', borderRadius: COPY_SIZE }
})

export default styles
