import React, { useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import styles from './styles'
import PoolList from './Component/PoolList'
import useGetListPoolLiquidity from 'frontend/Hooks/useGetListPoolLiquidity'
import useFetchMulticallDetailToken from 'frontend/Hooks/useFetchMulticallDetailToken'
import useCheckAddressCoinPool from 'frontend/Hooks/useCheckAddressCoinPool'
import IntroduceLiquidity from 'frontend/Screen/LiquidityManagement/Component/IntroduceLiquidity'
import I18n from 'assets/Lang'

const LiquidityManagementPage = ({ func, state }) => {
  const { activeLiquidityAddress, isRegistered } = state
  const addressDeletedLiquidity = useSelector(state => state.addressDeletedLiquidity)
  const listAddressRegisted = useMemo(() => {
    return activeLiquidityAddress ? [activeLiquidityAddress] : []
  }, [activeLiquidityAddress])

  // V2 manages a single EVM address at a time. Old app versions could persist
  // multiple registered addresses (incl. a Solana one); collapse to the first
  // valid EVM address and feed the data hooks a fresh single-element array.

  // Flat list of hidden position ids. Derived here (not inside the data hook) so that
  // toggling Hide/Show re-renders the list instantly without re-running the network
  // queries that key off the pool data.
  const arrayAddressDeleted = useMemo(
    () => Object.values(JSON.parse(JSON.stringify(addressDeletedLiquidity || {}))).flat(),
    [addressDeletedLiquidity]
  )

  // Data handling identical to the legacy screen — only the VIP/donated branch is dropped.
  const { data: dataCheckAddressCoinPool, isLoading: isLoadingCheckAddressCoinPool, refetch: refetchCheckAddressCoinPool } = useCheckAddressCoinPool(listAddressRegisted)
  // Pass [] for deleted ids: V2 keeps hidden pools in the list (dimmed, at the bottom)
  // and derives hidden state in PoolList, so the hook must not filter them out here.
  const { data: listLiquidityPool = [], isLoading: isLoadingListLiquidity, refetch: refetchListLiquidity } = useGetListPoolLiquidity(listAddressRegisted, [], {
    enabled: isRegistered && !isLoadingCheckAddressCoinPool
  })
  const { data: listTokensDetail, isLoading: isLoadingListTokensDetail } = useFetchMulticallDetailToken(listLiquidityPool)

  const dataListAddressCoinPoolChecked = dataCheckAddressCoinPool?.dataListAddressChecked || []
  const isLoading = isLoadingListLiquidity || isLoadingListTokensDetail || isLoadingCheckAddressCoinPool

  // Pull-to-refresh re-runs both queries: the exist-check (an address can gain its
  // first pool after registration) and the pool list itself.
  const handleRefresh = useCallback(() => {
    refetchCheckAddressCoinPool()
    refetchListLiquidity()
  }, [refetchCheckAddressCoinPool, refetchListLiquidity])

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      {!isRegistered
        ? (
          // Scrolling branch: the title + tutorial share IntroduceLiquidity's
          // ScrollView and ride under the floating (blur) header — same as the
          // registered PoolList. The ScrollView's contentContainer reserves the
          // header height up top (see IntroduceLiquidity) so the title starts below
          // the header. The title still measures itself as the drawer anchor, so the
          // register drawer opens just under it.
          <IntroduceLiquidity title={I18n.t('v2.liquidity.title')} />
        )
        : (
          <>
            {/* PoolList owns the scroll (FlatList). The visible title + Overview ride
                as its ListHeaderComponent so they scroll UNDER the blur header (same
                as the Send/Received history list). */}
            <PoolList
              _this={func}
              isLoading={isLoading}
              // Pull-to-refresh spinner: only for a background refetch, not the
              // first load (that shows the Lottie loader inside the list instead).
              // refreshing={isFetchingListLiquidity && !isLoading}
              listLiquidityPool={listLiquidityPool}
              listTokensDetail={listTokensDetail}
              dataListAddressCoinPoolChecked={dataListAddressCoinPoolChecked}
              arrayAddressDeleted={arrayAddressDeleted}
              onRefresh={handleRefresh}
            />
          </>
        )}
    </MyViewPage>
  )
}

export default LiquidityManagementPage
