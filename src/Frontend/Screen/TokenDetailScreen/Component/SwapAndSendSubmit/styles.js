import { StyleSheet } from 'react-native'
import { Colors, fontSize, getSafeAreaValues, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare, getFontFamily, getHeightHeaderDrawer, PADDING_TOP_CONTAINER_DRAWER } from 'common/styles'

const CIRCLE = getSizeImgSquare('large')
const TOKEN_ICON = getSizeImgSquare('large')
const AVATAR_SIZE = getSizeImgSquare('large')

export const FIELD_VPAD = pixelByHeight(8)
export const FIELD_MIN_HEIGHT = pixelByHeight(74)
export const FIELD_HEIGHT_FALLBACK = FIELD_MIN_HEIGHT

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: PADDING_TOP_CONTAINER_DRAWER
    },
    content: {
      paddingTop: getHeightHeaderDrawer(),
      paddingBottom: getSafeAreaValues().bottom + pixelByHeight(16)
    },
    addressInputWrapper: {
      minHeight: FIELD_HEIGHT_FALLBACK
    },
    addressAreaWrapper: {
      height: FIELD_HEIGHT_FALLBACK,
      alignItems: 'center',
      paddingVertical: 0
    },
    addressAreaInput: {
      height: undefined,
      paddingVertical: FIELD_VPAD
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: pixelByWidth(12),
      minHeight: FIELD_HEIGHT_FALLBACK
      // marginTop: pixelByHeight(14)
    },
    inputTopGap: {
      marginTop: pixelByHeight(14)
    },
    fieldSide: {
      justifyContent: 'center'
    },
    fieldLine: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: pixelByWidth(12),
      borderBottomWidth: 1.5,
      borderBottomColor: Colors.BG_BOX_SMALL
    },
    fieldInputPlain: {
      flex: 1,
      justifyContent: 'center'
    },
    amountInput: {
      color: Colors.WHITE,
      fontFamily: getFontFamily(700)
    },
    amountPlaceholder: {
      fontSize: fontSize('default'),
      color: Colors.TEXT_LOW,
      fontFamily: getFontFamily(400)
    },
    iconBtn: {
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
    tokenIcon: {
      width: TOKEN_ICON,
      height: TOKEN_ICON
    },
    amountErrorSpace: {
      minHeight: pixelByHeight(49),
      justifyContent: 'flex-start'
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(6)
      // marginTop: pixelByHeight(8)
    },
    hintIcon: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
    },
    addressStatusSpace: {
      minHeight: pixelByHeight(49 - 6),
      marginTop: pixelByHeight(6),
      justifyContent: 'flex-start'
    },
    addressBookFreeText: {
      marginBottom: pixelByHeight(14)
    },
    quantityWithNote: {
      marginVertical: pixelByHeight(14)
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: pixelByWidth(8)
    },
    statusIcon: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small'),
      justifyContent: 'center',
      alignItems: 'center'
    },
    statusTextCol: {
      flex: 1
    },
    goPlusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(4),
      marginTop: pixelByHeight(2)
    },
    goPlusLogo: {
      width: getSizeImgSquare('small'),
      height: sizeImageSquare(14)
    },
    footer: {
      gap: pixelByHeight(8)
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    stepWrap: {
      gap: pixelByHeight(14),
      marginTop: pixelByHeight(32)
    },
    dimmedForm: {
      opacity: 0.4
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12),
      width: '100%'
    },
    sendingTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(6)
    },
    stepLineCol: {
      width: getSizeImgSquare('large'),
      alignItems: 'center'
    },
    stepConnectorCol: {
      width: getSizeImgSquare('large'),
      height: pixelByHeight(40),
      alignItems: 'center'
    },
    stepLine: {
      width: pixelByWidth(3),
      backgroundColor: Colors.BG_BOX_SMALL,
      flex: 1
    },
    statusResult: {
      alignItems: 'center'
    },
    copyBtn: {
      width: CIRCLE,
      height: CIRCLE,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: Colors.BG_BOX_SMALL,
      backgroundColor: Colors.BG_INPUT_FIELD,
      borderRadius: CIRCLE
    },
    abAvatar: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2
    },
    abAvatarImg: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2
    },
    slippageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: pixelByHeight(14)
    }
  })
}

export default createStyles
