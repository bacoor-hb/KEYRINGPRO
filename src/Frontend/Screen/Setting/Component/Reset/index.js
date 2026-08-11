import React from 'react'
import I18n from 'assets/Lang'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import createStyles from './styles'
import images from 'assets/Image'
import MyButton from 'frontend/Components/UI/MyButton'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import ReduxService from 'common/redux'
import { requestReauth } from 'common/secureVault'
import { storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { KEYSTORE } from 'common/constants/redux'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import { pixelByHeight } from 'common/styles'

const RestWallet = () => {
  const styles = createStyles()

  const clearMoreDataLocal = (keyStore = []) => {
    keyStore.forEach(key => {
      storeDataToAsyncStorage(key, null)
    })
  }

  const resetWallet = async () => {
    const ok = await requestReauth({ keepOnSuccess: true })
    if (!ok) return
    await ReduxService.restoreWallet()

    clearMoreDataLocal([
      KEYSTORE.HISTORY_BACKUP,
      KEYSTORE.HISTORY_WC_PAY,
      KEYSTORE.LIST_CHAIN_SUPPORT_EXCHANGE
    ])
  }

  return (
    <MyViewPage isUseDrawer style={[styles.container]}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('MenuScreen.ResetWallet.reset')}
        leftAction={() => { }}
        leftIcon={images.UIV2.icons.settings.reset}
        rightElement={(
          <MyButton size='small' variant='dangerous' label={I18n.t('MenuScreen.ResetWallet.reset')} style={{ minWidth: 100 }} onPress={resetWallet} />
        )}
      />
      <ScrollViewBlurHeader
        style={{ paddingTop: pixelByHeight(8) }}
        isUseDrawer
        contentContainerStyle={{ flex: 1 }}
      >
        <StatusMessage
          variant='warning'
          message={I18n.t('v2.setting.resetWarning')}
          iconConfig={{
            className: 'm-auto'
          }}
        />
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default RestWallet
