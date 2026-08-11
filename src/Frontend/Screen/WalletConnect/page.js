import React, { useMemo } from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'
import { useSelector } from 'react-redux'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import createStyles from './styles'
import { getSizeImgSquare } from 'common/styles'
import { lowerCase } from 'common/function'
import MyButton from 'frontend/Components/UI/MyButton'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import { getUrlIconWalletConnect } from 'common/walletconnect'

const WalletConnectPage = ({ _this, func }) => {
  const { handleViewHistoryWCP } = _this
  const activeAccount = useSelector((s) => s.activeAccount)
  const { account } = activeAccount
  const walletConnectRedux = useSelector((s) => s.walletConnectRedux)
  const styles = createStyles()

  const addr = lowerCase(account?.address || '')

  // Real connected dApps for the current account. Each WC session entry is bound
  // to one account via `accountAddress` (older entries fall back to the first
  // accountArr namespace's address).
  const connections = useMemo(() => {
    return (walletConnectRedux || [])
      .filter((item) => item?.isWalletConnectV2 && item?.session?.topic)
      .filter((item) => {
        const owner = item?.accountAddress || lowerCase(item?.accountArr?.[0]?.split(':')?.[2] || '')
        return !owner || owner === addr
      })
      .map((item) => ({
        topic: item.session.topic,
        name: item?.session?.peer?.metadata?.name || 'Dapp',
        url: item?.session?.peer?.metadata?.url || '',
        icon: item?.session?.peer?.metadata?.icons?.[0] || '',
        // true => connected from a mobile dApp (deep link), false => desktop.
        isFromDeepLink: !!item?.isFromDeepLink
      }))
  }, [walletConnectRedux, addr])

  const renderConnectionItem = (item) => {
    return (
      <TouchableOpacity
        key={item.topic}
        activeOpacity={0.7}
        style={styles.row}
        onPress={() => func.handleOpenDetail(item)}
      >
        <View style={styles.avatarWrap}>
          <ImageRender
            uri={getUrlIconWalletConnect(item.icon, item.url)}
            uriDefault={images.walletConnectIcon}
            style={styles.dappIcon}
            resizeMode='contain'
          />
          {/* Connection-source badge: mobile (phone) or desktop (monitor). The
              positioning lives on this wrapper View; badgeImg sets overflow:'visible'
              so ImageRender's built-in overflow:hidden box doesn't clip the edge. */}
          <View style={styles.badge}>
            <MyIcon
              uri={item.isFromDeepLink ? images.UIV2.icons.dappMobile : images.UIV2.icons.dappDesktop}
              variant='small'
              resizeMode='contain'
              style={styles.badgeImg}
            />
          </View>
        </View>
        <View style={styles.rowContent}>
          <MyText style={styles.dappName} numberOfLines={1}>{item.name}</MyText>
          <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' resizeMode='contain' />
        </View>
      </TouchableOpacity>
    )
  }

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <MyIcon uri={images.UIV2.icons.noData} style={styles.emptyIcon} variant='extraLarge' resizeMode='contain' />
      <MyText variant='small' className='text-low'>{I18n.t('v2.walletConnect.noConnectedDapps')}</MyText>
    </View>
  )

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>

      <TitleScreen title={I18n.t('Initial.WalletConnectPay.wc')} />

      <ScrollView contentContainerStyle={styles.listContainer}>
        {connections.length ? connections.map(renderConnectionItem) : renderEmpty()}
      </ScrollView>

      <View style={styles.containerButton} className='flex flex-row justify-between'>
        <View className='flex flex-1'>
          <MyButton size='small' onPress={handleViewHistoryWCP} className='w-full'>
            <MyTextTicker>
              {I18n.t('v2.walletConnect.payHistory')}
            </MyTextTicker>
          </MyButton>
        </View>
        <MyButton onPress={() => NavigationActions.navigate(NAME_SCREEN.scanScreen)} noMinWidth variant='small' style={{ width: getSizeImgSquare('large'), height: getSizeImgSquare('large') }}>
          <MyIcon uri={images.walletConnectIcon} variant='medium' />
        </MyButton>
      </View>
    </MyViewPage>
  )
}

export default WalletConnectPage
