import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, getSizeImgSquare } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    modalContent: {
      flex: 1
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
      alignItems: 'center',
      marginBottom: pixelByHeight(32)
    },
    modalTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    modalTitleText: {
    },
    modalDetailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      paddingVertical: pixelByHeight(16),
      borderBottomWidth: 1
    },
    modalDetailText: {
      marginLeft: pixelByWidth(12),
      flex: 1
    },
    gasFeeSection: {
      width: '100%',
      marginTop: pixelByHeight(24)
    },
    gasFeeLabelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: pixelByHeight(8)
    },
    slider: {
      width: '100%',
      height: pixelByHeight(40)
    },
    powerIconContainer: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large')
    },
    powerIcon: {
      width: getSizeImgSquare('medium'),
      height: getSizeImgSquare('medium')
    }
  })
}

export default createStyles
