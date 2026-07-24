import { View } from 'react-native'
import I18n from 'assets/Lang'
import React from 'react'
import images from 'assets/Image'
import { getSizeImgSquare } from 'common/styles'
import createStyles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'

const HeaderScan = ({ _this }) => {
  const { state, handleToBack, onPasteWalletConnectCode: handleEnterPassCode } = _this
  const { isLoadingWalletConnectPay: isLoadingScan } = state

  const styles = createStyles()
  return (
    <View
      style={styles.container}>
      <View
        style={{
          position: 'relative',
          width: '100%'

        }}>
        {/* <ImageRender uri={images.UIV2.bgHeaderBlur} style={{ position: 'absolute', width: width(100), height: topNavBar + heightHeader, top: 0, left: 0 }} /> */}
        <View style={styles.containerContent}>
          <MyButton
            isDisable={isLoadingScan}
            style={styles.btnBack}
            noMinWidth
            isCircleBtn
            onPress={handleToBack}
            label={(
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <MyIcon style={{ width: getSizeImgSquare('small'), height: getSizeImgSquare('small') }} uri={images.UIV2.icons.arrowLeftWhite} />
              </View>
            )} />
          <MyButton
            isDisable={isLoadingScan}
            size='small'
            noMinWidth
            onPress={handleEnterPassCode}
            label={I18n.t('v2.wcPay.pasteCode')} />
        </View>
      </View>

    </View>
  )
}

export default HeaderScan
