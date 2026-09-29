import { StyleSheet } from 'react-native'
import { Colors, fontSize, getFontFamily, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'

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
    // The auto-fit input takes the flexible column; Max keeps its fixed circle.
    amountCol: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center'
    },
    // Text appearance ONLY — AutoFitAmountInput owns every layout-affecting prop
    // (width/height/padding/fontSize) and keeps the base font fixed while
    // auto-scaling a long value down to fit. Only color/fontFamily belong here.
    amountInput: {
      color: Colors.WHITE,
      fontFamily: getFontFamily(700)
    },
    // Small "Amount" hint shown while empty. Passed as placeholderStyle so it keeps
    // its own 15px size independent of the input's large auto-fit value font.
    amountPlaceholder: {
      fontSize: fontSize(15),
      color: Colors.TEXT_LOW,
      fontFamily: getFontFamily(400)
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
