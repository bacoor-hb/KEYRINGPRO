import { View, ScrollView, TouchableOpacity } from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import AddressBookService from 'common/addressBook'
import createStyles from './styles'
import { NavigationActions } from 'src/navigation/NavigationService'
import { getHeightHeader, getSafeAreaValues, pixelByHeight, pixelByWidth } from 'common/styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import { NAME_SCREEN } from 'common/constants/navigation'
import ItemOption from './Component/ItemOption'
import ContainerBox from './Component/ContainerBox'
import ItemAccount from './Component/ItemAccount'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import { useSelector } from 'react-redux'
import ListChain from './Component/ListChain'
import { requestReauth } from 'common/secureVault'
import Header from './Component/Header'
import { getVisibleTotalUSD } from 'src/Services/TokenListV2'
import { STANDARD_CHAIN } from 'common/constants/app'
import ReduxService from 'common/redux'
import { getCurrencySymbolData, splitDecimalNumber, lowerCase } from 'common/function'
import BigNumber from 'bignumber.js'
import useLiquidityTotalUSD from 'frontend/Hooks/useLiquidityTotalUSD'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import useCheckNewAppVersion from 'frontend/Hooks/useCheckNewAppVersion'

const HomePage = (props) => {
  const { func } = props
  const { accountListRedux } = useSelector(state => state)
  const accountTokenListRedux = useSelector(state => state.accountTokenListRedux)
  useSelector(state => state.localeRedux)
  const styles = createStyles()

  // Prompt for an app update on the home screen (App Store / Play Store check).
  const versionUpdateModal = useCheckNewAppVersion()

  // Offline → show a noInternet icon on the right of the "Account box" title
  // (same icon as TokenList).
  const isOnline = useSelector(state => state.internetData)
  // Collapse state for the Liquidity management section — tap the title row to
  // expand/collapse its box, same as an account row's Tokens section.
  const [isShowLiquidity, setIsShowLiquidity] = useState(true)

  // Order accounts by total visible USD value (desc). Non-EVM accounts are not
  // part of the V2 balance pipeline (no computed total), so they always sink to
  // the bottom in their original relative order — same as before this sort.
  const sortedAccountList = useMemo(() => {
    const totalOf = (acc) =>
      getVisibleTotalUSD(accountTokenListRedux?.[lowerCase(acc?.address || '')])
    const isEvm = (acc) => acc?.chain === STANDARD_CHAIN.Evm
    return [...(accountListRedux || [])].sort((a, b) => {
      const aEvm = isEvm(a)
      const bEvm = isEvm(b)
      if (aEvm !== bEvm) return aEvm ? -1 : 1
      if (!aEvm) return 0
      return totalOf(b) - totalOf(a)
    })
  }, [accountListRedux, accountTokenListRedux])

  // Total USD of liquidity positions — computed on demand when this screen mounts
  // (fetches the registered address' pools and sums the active/non-hidden ones).
  // Raw USD; the display applies the fiat rate.
  const { totalLiquidityUSD: liquidityTotalUSD, isLoading: isLoadingLiquidity, hasRegisteredAddress: hasRegisteredLiquidityAddress } = useLiquidityTotalUSD()

  // Populate addressBookInfo so ItemAccount can render registered avatars.
  useEffect(() => {
    if (accountListRedux?.length) {
      AddressBookService.resolveEmailToAliasForListAccount()
    }
  }, [accountListRedux?.length])

  const handleRoutePage = (keyScreen, params) => {
    NavigationActions.navigate(keyScreen, params)
  }

  const renderAccountBox = () => {
    const listOption = [
      {
        title: I18n.t('v2.network.title'),
        icon: images.UIV2.icons.network,
        onPress: () => handleRoutePage(NAME_SCREEN.network),
        rightContent: (
          <ListChain />
        )
      },
      {
        title: I18n.t('SecurityScreen.createBackupFile'),
        icon: images.UIV2.icons.home.createBackupFile,
        onPress: async () => {
          const ok = await requestReauth()
          if (ok) handleRoutePage(NAME_SCREEN.backUpWallet)
        }
      },
      {
        title: I18n.t('v2.home.restoreBackup'),
        icon: images.UIV2.icons.home.restoreUsingBackupFile,
        onPress: () => func.openRestoreFromFileModal()
      },
      {
        title: I18n.t('v2.home.nfcTagOperation'),
        icon: images.UIV2.icons.home.NFCKeycardOperation,
        onPress: () => handleRoutePage(NAME_SCREEN.nFCTagOperation)
      },
      {
        title: I18n.t('SecurityScreen.security'),
        icon: images.UIV2.icons.home.security,
        onPress: () => handleRoutePage(NAME_SCREEN.security)
      },
      {
        title: I18n.t('v2.home.otherSettings'),
        icon: images.UIV2.icons.otherSettings,
        noBorder: true,
        onPress: () => handleRoutePage(NAME_SCREEN.settings)
      }
    ]
    return (

      <View>
        {/* paddingTop (header clearance) lives here, not on the page container,
          so this anchor measures the FULL top region — header gap + the
          "Account box" title — and the restore drawer anchors right below it
          instead of overlapping the header. */}
        <View style={{ paddingTop: getHeightHeader(true) }}>
          <TitleScreen
            title={I18n.t('v2.home.accountBox')}
            rightContent={!isOnline && (
              <MyIcon
                uri={images.UIV2.icons.noInternet}
                variant='medium'
                style={styles.headerOfflineIcon}
              />
            )}
          />
        </View>
        <ContainerBox noAnimation>

          {
            listOption.map((item, index) => {
              return (
                <ItemOption
                  {...item}
                  rightContent={item.rightContent}
                  noBorder={item.noBorder}
                  title={item.title}
                  icon={item.icon}
                  key={`account-box-${index}`} />
              )
            })
          }

        </ContainerBox>

      </View>

    )
  }

  // const renderStableCoin = () => {
  //   const listOption = [
  //     {
  //       title: 'USD',
  //       icon: images.UIV2.icons.stableCoinUSD,
  //       noBorder: false
  //     },
  //     {
  //       title: 'EUR',
  //       icon: images.UIV2.icons.stableCoinEUR,
  //       noBorder: true
  //     }
  //   ]
  //   return (
  //     <View style={{ gap: pixelByHeight(12), opacity: 0.5 }}>
  //       <View style={styles.containerTitle}>
  //         <MyText variant='subTitle'>
  //           Stablecoin
  //         </MyText>
  //         <MyIcon
  //           uri={images.UIV2.icons.arrowRDownBlue}
  //           style={styles.iconArrowDown}
  //         />
  //       </View>
  //       <ContainerBox noAnimation>

  //         {
  //           listOption.map((item, index) => {
  //             return (
  //               <ItemOption noBorder={item.noBorder} key={`stable-coin-${index}`} title={item.title} icon={item.icon} />
  //             )
  //           })
  //         }
  //       </ContainerBox>

  //     </View>

  //   )
  // }

  const renderLiquidity = () => {
    const fiatRateRedux = ReduxService.getFiatRateRedux()
    const currencyRedux = ReduxService.getCurrencyRedux()

    const totalLiquidityByFiat = liquidityTotalUSD * fiatRateRedux

    const { symbol: currencySymbol, position: currencyPosition } = getCurrencySymbolData(currencyRedux)
    const currencyPrefix = currencyPosition === 'prefix' ? currencySymbol : ''
    const currencySuffix = currencyPosition === 'suffix' ? ` ${currencySymbol}` : ''

    const quantityLiquidity = splitDecimalNumber(BigNumber(totalLiquidityByFiat).decimalPlaces(2), BigNumber.ROUND_DOWN)
    const listOption = [
      {
        title: I18n.t('v2.home.myLiquidity'),
        icon: images.UIV2.icons.liquidityManager,
        noBorder: true,
        onPress: () => handleRoutePage(NAME_SCREEN.liquidityManagement),
        // No registered address yet -> nothing to show on the right.
        rightContent: !hasRegisteredLiquidityAddress
          ? null
          : isLoadingLiquidity
            ? <MyDotsLoading source={images.threeDotsWhiteLoading} />
            : (
              <MyText className='text-low'>
                {currencyPrefix}{quantityLiquidity.first}{currencySuffix}
              </MyText>
            )
      }
    ]
    return (
      <View style={{ gap: pixelByHeight(12) }}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.containerTitle}
          onPress={() => setIsShowLiquidity(prev => !prev)}>
          <View
            className='flex-row flex-1'
            style={{ gap: pixelByWidth(8) }}>

            <MyTextTicker variant='subTitle'>
              {I18n.t('v2.liquidity.title')}
            </MyTextTicker>
          </View>
          <MyIcon
            uri={isShowLiquidity ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand}
            style={styles.iconArrowDown}
          />

        </TouchableOpacity>
        {
          isShowLiquidity && (
            <ContainerBox>

              {
                listOption.map((item, index) => {
                  return (
                    <ItemOption
                      noBorder={item.noBorder}
                      key={`liquidity-${index}`}
                      title={item.title}
                      icon={item.icon}
                      onPress={item.onPress}
                      rightContent={item.rightContent} />
                  )
                })
              }
            </ContainerBox>
          )
        }

      </View>

    )
  }

  const renderAccount = () => {
    return sortedAccountList.map((item, index) => {
      // Key by a STABLE account identity, not the sorted position. `index` here is
      // the position after sorting by balance, so it changes whenever a row's
      // balance loads and the list re-orders — using it in the key would remount
      // the moved rows and reset their local expand state (an auto-expanded first
      // account that isn't tracked in accountsUsing would silently collapse).
      // The original index in accountListRedux is stable across re-sorts (same
      // element refs) and still disambiguates any duplicate/missing address, which
      // is the uniqueness the plain address+chain key lacked.
      const stableIndex = (accountListRedux || []).indexOf(item)
      return (
        <ItemAccount
          accountData={item}
          key={`account-detail-${item?.address || ''}-${item?.chain || ''}-${stableIndex}`}
          indexAccount={index} />
      )
    })
  }

  return (
    <View className='flex-1'>
      <Header func={func} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <MyViewPage style={styles.container}>
          {renderAccountBox()}
          {/* {renderStableCoin()} */}
          {
            renderLiquidity()
          }
          {renderAccount()}

        </MyViewPage>
      </ScrollView>
      <View style={{ bottom: getSafeAreaValues().bottom, right: pixelByWidth(16) }} className='absolute '>
        <MyButton noMinWidth onPress={() => handleRoutePage(NAME_SCREEN.addAccount)} style={styles.btnAdd} size='floating'>
          <MyIcon uri={images.UIV2.icons.addWhite} />
        </MyButton>
      </View>
      {versionUpdateModal}
    </View>
  )
}

export default HomePage
