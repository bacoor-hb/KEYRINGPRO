
import I18n from 'assets/Lang'
import React from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import MyButton from 'frontend/Components/UI/MyButton'
import MyText from 'frontend/Components/UI/MyText'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import { pixelByHeight } from 'common/styles'

const CopyNFCTag = ({ callback, isReadCopy = false }) => {
  const styles = createStyles()
  return (
    <MyViewPage isUseDrawer style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('NFC.copyCard')}
        leftIcon={images.UIV2.icons.copyBlue}
        rightElement={(
          <MyButton onPress={callback} size='small' label={isReadCopy ? I18n.t('NFC.read') : I18n.t('Initial.copy')} variant='primary' />
        )}
      />
      <ScrollViewBlurHeader
        isUseDrawer
        style={{ paddingTop: pixelByHeight(8) }}
        contentContainerStyle={{ flex: 1 }}
      >
        <MyText className='text-center text-medium'>
          {isReadCopy ? I18n.t('v2.nfcOperation.readFirst') : I18n.t('v2.nfcOperation.nowCopy')}
        </MyText>
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default CopyNFCTag
