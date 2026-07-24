import { View, TouchableOpacity } from 'react-native'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useIsFocused } from '@react-navigation/native'
import { getVisibleTotalUSD, refreshAccountTokens, isStaleForActiveChains } from 'src/Services/TokenListV2'
import { lowerCase } from 'common/function'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { NAME_SCREEN } from 'common/constants/navigation'
import { getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'
import ItemOption from '../ItemOption'
import ContainerBox from '../ContainerBox'
import { NavigationActions } from 'src/navigation/NavigationService'
import createStyles from './styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import { STANDARD_CHAIN } from 'common/constants/app'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'
import { ACCOUNT_TYPE } from 'common/constants/account'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'

const ItemAccount = ({ indexAccount, accountData }) => {
  const dispatch = useDispatch()
  const { activeAccount } = useSelector(s => s)
  const { accountsUsing } = activeAccount
  const address = accountData?.address || ''
  const localeRedux = useSelector(state => state.localeRedux)

  const [isShow, setIsShow] = useState(false)

  const styles = createStyles()

  const addressBookAvatar = useSelector(
    (state) => (state.addressBookInfo?.[lowerCase(address)]?.info?.avatar || '').trim()
  )
  const accountEntry = useSelector(
    (state) => state.accountTokenListRedux?.[lowerCase(address)]
  )
  const walletConnectRedux = useSelector((state) => state.walletConnectRedux)
  // Number of dApps this account is connected to over WalletConnect V2. Each
  // session is bound to one account via `accountAddress` (older entries fall
  // back to the first accountArr namespace's address).
  const connectedDappCount = useMemo(() => {
    const addr = lowerCase(address)
    return (walletConnectRedux || [])
      .filter((item) => item?.isWalletConnectV2 && item?.session?.topic)
      .filter((item) => {
        const owner = item?.accountAddress || lowerCase(item?.accountArr?.[0]?.split(':')?.[2] || '')
        return !owner || owner === addr
      }).length
  }, [walletConnectRedux, address])
  // Derive from live tokens (filtered by !isHidden) so the total stays in sync
  // with the TokenList screen when the user hides/unhides tokens.
  const totalUSD = useMemo(() => getVisibleTotalUSD(accountEntry), [accountEntry])
  const isTokenLoading = useSelector((state) => !!state.tokenLoadingRedux?.[lowerCase(address)])
  // Track whether this account has ever finished a FULL token load. Used to keep
  // the loader visible for the whole first load — `lastSyncedAt` is set on the
  // first chain commit, so gating on it would flash an intermediate 0/partial
  // total as the remaining chains commit progressively. Initialized from a
  // persisted snapshot if one already exists (restored/previous session).
  const hasLoadedOnceRef = useRef(!!accountEntry?.lastSyncedAt)
  useEffect(() => {
    // A full refresh is done once the loading flag clears with tokens present.
    if (!isTokenLoading && accountEntry?.lastSyncedAt) {
      hasLoadedOnceRef.current = true
    }
  }, [isTokenLoading, accountEntry?.lastSyncedAt])
  // Show the three-dot loader only during the FIRST load (until ALL chains
  // settle); later silent refreshes keep showing the existing balance.
  const showTokenLoader = isTokenLoading && !hasLoadedOnceRef.current

  useEffect(() => {
    if (!accountsUsing) {
      if (indexAccount === 0) {
        setIsShow(true)
      }
    }

    if (accountsUsing?.length === 0) {
      if (indexAccount === 0) {
        setIsShow(true)
      }
    }

    if (accountsUsing?.length > 0) {
      if (accountsUsing.includes(address)) {
        setIsShow(true)
      }
    }
  }, [])

  const activeEvmChainIds = useSelector((state) => state.activeEvmChainIdsRedux)
  const isFocused = useIsFocused()

  // Refresh an EVM row's balances when it's expanded AND its cached tokens are
  // stale — i.e. never synced, OR the active chain list changed since the last
  // full sync (chain added/removed on the Network screen). Same fetch as the
  // restore flow; it flips the per-address loading flag (three-dot loader).
  //
  // Gated on isFocused so toggling chains on the Network screen (Home blurred)
  // doesn't refetch mid-edit — only on returning to Home, once. `isShow` is the
  // true expanded state (local), so this also covers the auto-expanded first row
  // that isn't tracked in accountsUsing. Covers both triggers: row opening
  // (isShow flips) and focus regained after a chain change. isTokenLoading +
  // staleness guards dedupe the progressive-commit re-renders.
  useEffect(() => {
    if (!isFocused || !isShow || !address) return
    if (accountData?.chain !== STANDARD_CHAIN.Evm) return
    if (!isStaleForActiveChains(accountEntry, activeEvmChainIds)) return
    if (ReduxService.isTokenLoading(address)) return
    refreshAccountTokens(address)
    // accountEntry read for the staleness check; listing only its sync markers
    // (not the whole object) avoids re-running on every progressive token commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, isShow, address, accountData?.chain, activeEvmChainIds, accountEntry?.lastSyncedAt, accountEntry?.syncedChainIds])

  const handleRoutePage = (screenName) => {
    ReduxService.setActiveAccount(accountData)
    NavigationActions.navigate(screenName, { indexAccount })
  }

  const listOption = useMemo(() => {
    const arrOption = [
      {
        title: (
          <MyText className=' text-medium flex-1'>
            {accountData?.address}
          </MyText>
        ),
        leftElement: <AvatarAccount account={accountData} />,
        rightElement: (
          <View style={[styles.iconArrow]}>
            <MyIcon
              uri={images.UIV2.icons.arrowRightLow}
              variant='small'
            />
          </View>
        ),
        onPress: () => handleRoutePage(NAME_SCREEN.accountDetail)
      }

    ]
    if (accountData.chain === STANDARD_CHAIN.Evm) {
      arrOption.push(
        {
          title: I18n.t('v2.home.tokens'),
          icon: images.UIV2.icons.home.token,
          rightContent: showTokenLoader
            ? <MyDotsLoading source={images.threeDotsWhiteLoading} />
            : (
              <FiatBalance
                valueUSD={totalUSD}
                numberOfLines={1}
                style={styles.tokenBalance} />
            ),
          onPress: () => {
            ReduxService.setActiveAccount(accountData)
            NavigationActions.navigate(NAME_SCREEN.tokenList, { address: accountData?.address })
          }
        }
      )
      if (accountData.accountType === ACCOUNT_TYPE.COLD || accountData.accountType === ACCOUNT_TYPE.HOT) {
        arrOption.push({
          title: I18n.t('Initial.WalletConnectPay.wc'),
          icon: images.UIV2.icons.home.walletConnect,
          rightContent: connectedDappCount > 0 && (
            <MyText className='text-low'>
              {connectedDappCount}
            </MyText>
          ),
          onPress: () => handleRoutePage(connectedDappCount > 0 ? NAME_SCREEN.walletConnect : NAME_SCREEN.scanScreen)
        })
      }

      arrOption.push(...[

        {
          title: I18n.t('v2.home.sendHistory'),
          icon: images.UIV2.icons.home.send,
          onPress: () => handleRoutePage(NAME_SCREEN.sendHistory)
        },
        {
          title: I18n.t('v2.home.receivedHistory'),
          icon: images.UIV2.icons.home.receivedHistory,
          onPress: () => handleRoutePage(NAME_SCREEN.receivedHistory)
        }
      ])
    }

    return arrOption
  }, [accountData, addressBookAvatar, totalUSD, address, connectedDappCount, showTokenLoader, localeRedux])

  const openAccountToUse = () => {
    if (isShow) {
      setIsShow(false)
      let arrTemp = [...(accountsUsing || [])]
      arrTemp = arrTemp.filter(addressUsing => addressUsing !== address)
      const activeAccountTemp = {
        ...activeAccount,
        accountsUsing: arrTemp
      }

      dispatch(StorageReduxAction.setActiveAccount(activeAccountTemp))
    } else {
      const activeAccountTemp = {
        ...activeAccount,
        accountsUsing: [...(accountsUsing || []), address]
      }

      dispatch(StorageReduxAction.setActiveAccount(activeAccountTemp))
      setIsShow(true)
    }
  }

  return (
    <View style={{ gap: pixelByHeight(12) }}>
      <TouchableOpacity activeOpacity={1} style={[styles.containerTitle, { minHeight: pixelByHeight(36) }]} onPress={openAccountToUse}>
        <View className='flex flex-row items-center flex-1'>

          <MyTextTicker fontWeight={700} numberOfLines={1} className='flex text-ellipsis overflow-hidden' variant='subTitle'>
            {accountData?.name || `Account ${indexAccount + 1}`}
          </MyTextTicker>
        </View>
        <View style={{ gap: pixelByWidth(12) }} className='flex flex-row items-center'>

          <View style={{ width: getSizeImgSquare('small'), height: getSizeImgSquare('small') }}>
            <MyIcon
              uri={isShow ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand}
              variant='small'
            />
          </View>
        </View>
      </TouchableOpacity>
      {
        isShow && (
          <ContainerBox>

            {
              listOption.map((item, index) => {
                return (
                  <ItemOption
                    key={`account-${indexAccount}-option-${index}`}
                    {...item}
                    noBorder={listOption.length === 1 || index === listOption.length - 1}
                  />
                )
              })
            }
          </ContainerBox>
        )
      }

    </View>

  )
}

export default ItemAccount
