import React from 'react'
import { View } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import ListActionRow from 'frontend/Components/UI/ListActionRow'

const WalletConnectDetail = ({ item, onDisconnect }) => {
  const styles = createStyles()

  const renderInfoConnect = () => {
    const arr = [
      {
        icon: images.UIV2.icons.network,
        title: I18n.t('Initial.address')
      },
      {
        icon: images.UIV2.icons.connectBrand,
        title: I18n.t('Initial.address')
      }
    ]

    return (
      <ListActionRow data={arr} />
    )
  }

  return (
    <MyViewPage style={styles.modalContent}>

      <TitleDrawer
        title={item?.name}
        leftIcon={images[item.icon]}
        leftConfig={{
          style: { padding: 0 },
          variant: 'large'
        }}
        rightElement={(
          <MyButton
            variant='dangerous'
            noMinWidth
            size='small'
            style={styles.powerIconContainer}
            onPress={onDisconnect}
          >
            <MyIcon uri={images.UIV2.icons.shutDown} style={styles.powerIcon} />
          </MyButton>
        )}

      />
      {renderInfoConnect()}

      <View style={styles.gasFeeSection}>
        <View style={styles.gasFeeLabelRow}>
          <MyText>{I18n.t('WalletConnect.gasFee')}</MyText>
          <MyText>1x Gwei</MyText>
        </View>
        <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, position: 'relative', marginTop: 12 }}>
          <View style={{ position: 'absolute', left: '30%', top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: 'white' }} />
        </View>
      </View>

      <MyText variant='small' style={styles.infoText}>
        {I18n.t('v2.walletConnect.reloadHint')}
      </MyText>

      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%', marginTop: 32 }} />
    </MyViewPage>
  )
}

export default WalletConnectDetail
