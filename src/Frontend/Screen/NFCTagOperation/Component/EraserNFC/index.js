import I18n from 'assets/Lang'
import React from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import MyButton from 'frontend/Components/UI/MyButton'
import MyText from 'frontend/Components/UI/MyText'
import { pixelByHeight } from 'common/styles'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

const EraserNFC = ({ callback }) => {
  const styles = createStyles()
  return (
    <MyViewPage isUseDrawer style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('NFC.resetNFCKeyCard')}
        leftIcon={images.UIV2.icons.resetRed}
        rightElement={(
          <MyButton onPress={callback} size='small' label={I18n.t('MenuScreen.ResetWallet.reset')} variant='dangerous' />
        )}
      />
      <ScrollViewBlurHeader
        isUseDrawer
        style={{ paddingTop: pixelByHeight(8) }}
        contentContainerStyle={{ flex: 1 }}
      >
        <MyText className='text-center text-medium'>
          {I18n.t('v2.nfcOperation.eraseConfirm')}
        </MyText>
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default EraserNFC
