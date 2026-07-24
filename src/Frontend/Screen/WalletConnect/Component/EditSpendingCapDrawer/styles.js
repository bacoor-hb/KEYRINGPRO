import { StyleSheet } from 'react-native'
import { Colors, fontSize, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

const ICON_BOX = getSizeImgSquare('large')
const CIRCLE = getSizeImgSquare('large')

const createStyles = () => {
  return StyleSheet.create({
    // No bg/radius: the drawer wrapper already renders the gradient + rounded clip.
    // flex:1 fills the fixed drawer height so the header stays pinned.
    container: {
      flex: 1
    },
    // Header: [icon box] [title] ......... [Save]
    header: {
      height: pixelByHeight(64),
      paddingHorizontal: pixelByWidth(16),
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    headerIconBox: {
      width: ICON_BOX,
      height: ICON_BOX,
      borderRadius: ICON_BOX / 2,
      backgroundColor: Colors.BLACK,
      justifyContent: 'center',
      alignItems: 'center'
    },
    // Title takes the remaining width so Save is pushed to the right edge.
    headerTitle: {
      flex: 1
    },
    body: {
      paddingTop: pixelByHeight(8)
    },
    // Amount field: NO left icon and NO surrounding box — just a bottom line that
    // runs through the input and the round Max button (matches the Send drawer).
    fieldLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      minHeight: pixelByHeight(62),
      borderBottomWidth: 1.5,
      borderBottomColor: Colors.BG_BOX_SMALL
    },
    // Input + symbol share the flexible column (relative for the placeholder overlay).
    amountCol: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center'
    },
    // Constant fontSize so typing the first digit doesn't re-layout/clip the value
    // (same approach as the Send drawer amount field). paddingLeft keeps the first
    // bold glyph's left bearing from clipping.
    amountInput: {
      flex: 1,
      padding: 0,
      paddingLeft: pixelByWidth(2),
      fontSize: fontSize(30),
      fontWeight: '700',
      color: Colors.WHITE
    },
    // Small "Amount" placeholder overlaid while empty — keeps a 15px hint without
    // shrinking the TextInput's own fontSize (which would clip the first digit).
    amountPlaceholderWrap: {
      position: 'absolute',
      left: pixelByWidth(2),
      top: 0,
      bottom: 0,
      justifyContent: 'center'
    },
    amountPlaceholder: {
      fontSize: fontSize(15),
      color: Colors.TEXT_LOW
    },
    // Round Max button — circle with dark bg + border, brand-blue label.
    maxBtn: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      flexShrink: 0,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      justifyContent: 'center',
      alignItems: 'center'
    },
    // Balance row sits below the field: label left / value right (both text-medium).
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: pixelByHeight(14),
      paddingHorizontal: pixelByWidth(0)
    },
    balanceValueRow: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center'
    },
    balanceLoading: {
      width: pixelByWidth(20),
      height: pixelByWidth(20)
    }
  })
}

export default createStyles
