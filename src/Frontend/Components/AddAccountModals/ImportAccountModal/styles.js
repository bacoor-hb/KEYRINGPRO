import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, width } from 'common/styles'
import { FIELD_MIN_HEIGHT } from 'frontend/Screen/TokenDetailScreen/Component/SendToken/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: width(100),
    paddingBottom: pixelByHeight(24)
  },
  // Mirror RegisterAccountModal: fixed-height area field with the placeholder /
  // value vertically centered (alignItems: 'center' + textAlignVertical center).
  inputWrapperArea: {
    minHeight: FIELD_MIN_HEIGHT,
    alignItems: 'center'
  },
  inputTextArea: {
    height: 'auto'
  },
  clearBtn: {
    marginLeft: pixelByWidth(8),
    padding: pixelByWidth(2)
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    paddingTop: pixelByHeight(16)
  },
  errorMessage: {
    flex: 1
  }
})

export default styles
