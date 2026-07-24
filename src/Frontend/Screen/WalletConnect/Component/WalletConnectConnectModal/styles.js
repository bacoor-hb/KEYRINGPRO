import { StyleSheet } from 'react-native'
import { Colors, getHeightHeaderDrawer, getSafeAreaValues, getSizeImgSquare, height, pixelByHeight, pixelByWidth } from 'common/styles'

const styles = StyleSheet.create({
  // No background / radius here: the drawer wrapper already renders
  // <MyLinearGradient variant='modal'> + a rounded-[32px] clip, so an opaque bg
  // would hide the gradient. flex:1 fills the fixed drawer height so the header
  // can stay pinned while the body below scrolls.
  container: {
    flex: 1
  },

  // Header (dApp avatar + name + Connect)
  header: {
    height: pixelByHeight(64),
    // paddingHorizontal: pixelByWidth(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    flex: 1,
    marginRight: pixelByWidth(12)
  },
  avatar: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderRadius: getSizeImgSquare('large'),
    backgroundColor: Colors.BG_ICON_NO_BG
  },
  dappName: {
    color: Colors.WHITE,
    flexShrink: 1
  },

  // Scrollable area below the fixed header.
  bodyScroll: {
    flex: 1,
    paddingBottom: getSafeAreaValues().bottom
  },
  body: {
    gap: pixelByHeight(14),
    paddingTop: getHeightHeaderDrawer() + pixelByHeight(8),
    paddingBottom: pixelByHeight(24)
  },

  // URL rows
  urlSection: {
    alignSelf: 'stretch'
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12)
    // paddingHorizontal: pixelByWidth(16)
  },
  urlRowInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    // Fixed row height (matches the dApp detail modal + legend rows) instead of padding.
    height: pixelByHeight(52),
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  urlText: {
    color: Colors.TEXT_MEDIUM,
    flex: 1
  },

  // Connectable chains
  chainsSection: {
    paddingHorizontal: pixelByWidth(16),
    marginBottom: pixelByHeight(0)
  },
  accountSection: {
    marginBottom: pixelByHeight(0)
  },
  // Case 2 (no active match): warning + "Add a network and connect" picker.
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    minHeight: pixelByHeight(46),
    marginBottom: pixelByHeight(14)

  },
  warningText: {
    flex: 1,
    color: Colors.TEXT_MEDIUM
  },
  pickerLabel: {
    color: Colors.WHITE
    // marginBottom: pixelByHeight(8)
  },
  // Boxed picker (same surface as the AI card): ~4 rows tall, then scrolls inside.
  pickerBox: {
    backgroundColor: Colors.BOX_SECONDARY,
    borderRadius: pixelByWidth(16),
    overflow: 'hidden',
    maxHeight: pixelByHeight(46 * 4),
    paddingRight: pixelByWidth(16),
    marginTop: pixelByHeight(12)
  },
  // Account picker (mobile deep link) — same surface as the chain picker box,
  // exactly 3 rows tall (row = 72) then scrolls.
  accountBox: {
    backgroundColor: Colors.BOX_SECONDARY,
    borderRadius: pixelByWidth(16),
    overflow: 'hidden',
    maxHeight: pixelByHeight(72 * 3),
    paddingHorizontal: pixelByWidth(12),
    marginTop: pixelByHeight(8)
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    // Fixed 72 (Figma) so 3 rows fill the box exactly; the divider is absolute so
    // it doesn't add to the height.
    height: pixelByHeight(72)
  },
  // Bottom divider inset so it starts past the avatar (left = avatar 40 + gap 12).
  accountDivider: {
    position: 'absolute',
    left: pixelByWidth(40 + 12),
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  // Selected = bright, others dimmed (same cue as the chain picker; opacity lives
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
  },
  // Separates the picker box from the AI info card below.
  pickerDivider: {
    height: 1,
    backgroundColor: Colors.BG_BOX_SMALL,
    marginTop: pixelByHeight(12)
  },
  chainIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: pixelByHeight(4)
  },
  chainOverlap: {
    marginLeft: -pixelByWidth(6)
  },
  chainLoadingDots: {
    width: getSizeImgSquare('medium'),
    height: getSizeImgSquare('medium')
  },
  chainsEmpty: {
    // paddingHorizontal: pixelByWidth(16),
    paddingVertical: pixelByHeight(8)
  },
  chainsEmptyText: {
    color: Colors.TEXT_LOW
  },

  // Info card
  infoCardWrap: {
    // paddingHorizontal: pixelByWidth(16)
  },
  infoCard: {
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByWidth(16),
    paddingVertical: pixelByWidth(12)
  },
  infoCardDanger: {
    backgroundColor: '#FF45451F'
  },
  // All AI info (description / phishing answer + reasons / fallback) scrolls
  // within a fixed max height.
  infoScroll: {
    maxHeight: height(30)
  },
  infoScrollContent: {
    gap: pixelByHeight(8),
    // Reserve room on the right so the scroll indicator doesn't overlap the text.
    paddingRight: pixelByWidth(10)
  },
  // Centers the three-dot loader while the AI assessment is in flight.
  infoLoadingWrap: {
    alignItems: 'center',
    paddingVertical: pixelByHeight(8)
  },
  infoCardLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: pixelByHeight(80)
  },
  infoText: {
    color: Colors.TEXT_MEDIUM
  },
  // Each reason is a bullet row: small dot + wrapping text, indented from the left.
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: pixelByWidth(8),
    paddingLeft: pixelByWidth(12)
  },
  reasonDot: {
    width: pixelByWidth(4),
    height: pixelByWidth(4),
    borderRadius: pixelByWidth(4),
    backgroundColor: Colors.TEXT_MEDIUM,
    // Nudge down so the dot sits on the first text line.
    marginTop: pixelByHeight(9)
  },
  reasonText: {
    flex: 1
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(0)
  },
  aiLabel: {
    color: Colors.TEXT_LOW
  },

  // Legend
  legendSection: {
    // paddingHorizontal: pixelByWidth(16),
    gap: pixelByHeight(8)
  },
  legendTitle: {
    color: Colors.WHITE
  },
  legendRows: {
    gap: pixelByHeight(0)
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    height: pixelByHeight(52)
  },
  legendText: {
    color: Colors.TEXT_MEDIUM,
    flex: 1
  },
  disclaimer: {
    color: Colors.TEXT_MEDIUM
  }
})

export default styles
