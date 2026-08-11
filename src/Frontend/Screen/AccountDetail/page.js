import React, { useMemo } from 'react'
import I18n from 'assets/Lang'
import { View, TouchableOpacity } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { IconType, STANDARD_CHAIN } from 'common/constants/app'
import images from 'assets/Image'
import createStyles from './styles'
import { getSafeAreaValues, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import { useSelector } from 'react-redux'
import ViewExplorer from './Component/ViewExplorer'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { isAccountFromKeyCard } from 'common/wallet'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import MyButton from 'frontend/Components/UI/MyButton'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import BottomGradientBar from 'frontend/Components/UI/BottomGradientBar'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const AccountDetailPage = ({ _this }) => {
  const { handleShowOption } = _this
  const { activeAccount, accountListRedux } = useSelector(state => state)
  const { account } = activeAccount
  // The SAME question the screen's actions ask before touching a key (see
  // isAccountFromKeyCard), not a raw `accountType === COLD` read. A legacy
  // BTC/Solana account restored from an old backup can carry its keycard link on
  // `rootAddress` — the EVM account of the same card — so the plain field read
  // left those screens presenting a hot account while every action on it demanded
  // a card tap. What the UI claims and what the app enforces must come from one
  // source. Memoised: it reads secure storage.
  const isAccountNFC = useMemo(() => isAccountFromKeyCard(account), [account])
  const isAccountViewOnly = account?.accountType === ACCOUNT_TYPE.VIEW_ONLY
  const isAccountEVm = account?.chain === STANDARD_CHAIN.Evm
  // Hide "Delete Account" when it's the only account left — the user must keep
  // at least one account.
  const canDeleteAccount = (accountListRedux?.length ?? 0) > 1

  const styles = createStyles()

  const handleRoutePage = (screenName) => {
    NavigationActions.navigate(screenName)
  }

  const renderAddress = () => {
    const address = account?.address?.toString()

    if (address?.length > 0) {
      const arrText = ['']
      for (let idx = 0; idx < address.length; idx++) {
        arrText.push(address[idx])
      }

      const prefixLength = 10
      const suffixLength = 9

      return (
        <MyText style={styles.addressText}>
          {
            arrText.map((text, index) => {
              if (index <= prefixLength || index > address.length - suffixLength) {
                return (
                  <MyText fontWeight={700} variant='title' key={index}>{text}</MyText>
                )
              }
              return (
                <MyText fontWeight={700} variant='title' className='text-medium' key={index}>{text}</MyText>
              )
            })
          }
        </MyText>
      )
    }
    return null
  }

  const renderInfoAccount = () => {
    const disable = isAccountViewOnly
    return (
      <View style={{ gap: pixelByHeight(12) }}>
        <MyText variant='subTitle' fontWeight={700} style={styles.sectionTitle}>{I18n.t('v2.accountDetail.accountManagement')}</MyText>
        {/* <ListActionRow data={listMenu} /> */}
        <View>
          <MyRowItem
            disable={disable}
            onPress={() => handleShowOption('view_private_key')}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.viewPrivateKey} />
              </View>
            )}
          >
            <View className='flex flex-row justify-between items-center'>
              <MyText className='text-medium'>
                {I18n.t('SecurityScreen.viewPrivateKey')}
              </MyText>
              <MyIcon
                variant='small'
                resizeMode='contain'
                uri={isAccountNFC ? images.UIV2.icons.icNFCTagOperation : images.UIV2.icons.arrowRightLow}
              />
            </View>
          </MyRowItem>

          {canDeleteAccount && (
            <MyRowItem
              onPress={() => handleShowOption('delete')}
              lefIcon={(
                <View style={styles.containerLeftIcon}>
                  <MyIcon uri={images.UIV2.icons.deleteBrand} />
                </View>
              )}
            >
              <View className='flex flex-row justify-between items-center'>
                <MyText className='text-medium'>
                  {I18n.t('v2.accountDetail.deleteAccount')}
                </MyText>
                <MyIcon
                  variant='small'
                  resizeMode='contain'
                  uri={isAccountNFC ? images.UIV2.icons.icNFCTagOperation : images.UIV2.icons.arrowRightLow}
                />
              </View>
            </MyRowItem>
          )}
        </View>
      </View>
    )
  }

  const renderViewExplorer = () => {
    let opacityBlockchain = 1
    let opacityRevoke = 1
    let opacityNft = 1

    if (!isAccountEVm) {
      opacityBlockchain = 0.5
      opacityRevoke = 0.5
      opacityNft = 0.5
    }

    return (
      <View>
        {/* blockscan */}
        <MyRowItem
          style={{ opacity: opacityBlockchain }}
          lefIcon={(
            <View style={styles.containerLeftIcon}>
              <MyIcon uri={images.UIV2.icons.blockScan} />
            </View>
          )}
        >
          <ViewExplorer />
        </MyRowItem>

        {/* revoke */}
        <MyRowItem
          style={{ opacity: opacityRevoke }}
          lefIcon={(
            <View style={styles.containerLeftIcon}>
              <MyIcon uri={images.UIV2.icons.revoke} />
            </View>
          )}
        >
          <ViewExplorer typeView='revoke' />
        </MyRowItem>

        {/* nft viewer */}
        <MyRowItem
          style={{ opacity: opacityNft }}
          lefIcon={(
            <View style={styles.containerLeftIcon}>
              <MyIcon uri={images.UIV2.icons.nftViewer} />
            </View>
          )}
        >
          <ViewExplorer typeView='nftViewer' />
        </MyRowItem>
      </View>
    )
  }

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>

      <ScrollViewBlurHeader contentContainerStyle={styles.containerContent} showsVerticalScrollIndicator={false}>
        <View style={styles.addressContainer}>
          {renderAddress()}
          <View style={{ justifyContent: 'space-between', flexDirection: 'column', alignSelf: 'stretch' }}>
            <TouchableOpacity onPress={() => handleShowOption('qr_address')} activeOpacity={0.7} style={styles.qrButton}>
              <MyIcon
                name='qr-code-outline'
                typeIcon={IconType.Ionicons}
                variant='title'
                color='white'
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShowOption('share-link')} activeOpacity={0.7} style={styles.qrButton}>
              <MyIcon
                name='share-social-outline'
                typeIcon={IconType.Ionicons}
                variant='title'
                color='white'
              />
            </TouchableOpacity>
          </View>
        </View>
        {renderInfoAccount()}
        {
          isAccountEVm && (
            <View style={{ gap: pixelByHeight(12) }}>
              <MyText variant='subTitle' fontWeight={700} style={[styles.sectionTitle, { marginTop: pixelByWidth(6) }]}>{I18n.t('v2.common.link')}</MyText>
              {renderViewExplorer()}

            </View>
          )
        }
        <View style={{ height: getSafeAreaValues().bottom + sizeImageSquare(60) }} />

      </ScrollViewBlurHeader>

      {
        isAccountNFC && (
          <BottomGradientBar>
            <View className='flex items-center mx-auto'>
              <MyIcon uri={images.UIV2.icons.coldNFCWallet} style={styles.iconCold} />
            </View>
          </BottomGradientBar>

        )
      }
      {
        isAccountEVm && account?.accountType === ACCOUNT_TYPE.HOT && (
          <BottomGradientBar>
            <MyButton onPress={() => handleRoutePage(NAME_SCREEN.exportToNFCTag)} className='w-full'>
              <MyTextTicker className='text-medium'>
                {I18n.t('v2.accountDetail.advancedProtection')}
              </MyTextTicker>
            </MyButton>
          </BottomGradientBar>
        )
      }

    </MyViewPage>
  )
}

export default AccountDetailPage
