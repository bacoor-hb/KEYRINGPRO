import { StyleSheet } from 'react-native'
import { getHeightHeaderDrawer, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const ROW_HEIGHT = pixelByHeight(72)

// Both sheets pin the same TitleDrawer at top 0, so the header icon sits at the
// same y in each — what differs is the first row. The parent sheet's first row is
// a 52-tall MyRowItem holding a 28 icon; a row here is 72 tall holding a 44
// avatar. Each centres its icon, so the avatar's TOP edge lands slightly lower
// than the parent's icon top: (72 - 44) / 2 vs (52 - 28) / 2. Pull the list up by
// exactly that difference (~2px) so the header-icon → first-icon gap is identical.
// Aligning the icon CENTRES instead would overshoot by 8px — the icons are
// different sizes, and it is the visible gap between their edges that must match.
const FIRST_ICON_OFFSET = (ROW_HEIGHT - getSizeImgSquare('large')) / 2 -
  (pixelByHeight(52) - getSizeImgSquare('medium')) / 2

const styles = StyleSheet.create({
  // No bg/radius here — the drawer wrapper renders the gradient + rounded clip.
  container: {
    flex: 1
  },
  // Scrollable area below the pinned (absolute + blurred) title: the parent
  // sheet's paddingTop, minus the first-icon offset above.
  bodyScroll: {
    flex: 1
  },
  // The container is unpadded (like the parent sheet), so the rows carry the
  // 16px side inset themselves. Top/bottom padding lives HERE rather than on
  // bodyScroll: Android does not count the ScrollView's own style padding in the
  // native scroll range, so a long list would lose that much off its end.
  body: {
    paddingHorizontal: pixelByWidth(16),
    paddingTop: getHeightHeaderDrawer() + pixelByHeight(8) - FIRST_ICON_OFFSET,
    paddingBottom: getSafeAreaValues().bottom + pixelByHeight(24)
  },
  // Same row as the connect modal's account picker, without its divider.
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    // Fixed 72 (Figma) — FIRST_ICON_OFFSET above depends on it.
    height: ROW_HEIGHT
  },
  // Selected = bright, others dimmed (same cue as the connect modal; opacity lives
  // on the touchable so Fabric never re-flattens a plain View → no recycle crash).
  accountSelected: {
    opacity: 1
  },
  accountUnselected: {
    opacity: 0.4
  },
  accountInfo: {
    flex: 1,
    gap: pixelByHeight(2)
  }
})

export default styles
