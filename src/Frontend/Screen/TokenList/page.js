import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { View, TouchableOpacity, Animated, InteractionManager } from 'react-native'
import { useSelector } from 'react-redux'
import { useFocusEffect } from '@react-navigation/native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import FooterAISearch, { FOOTER_AISEARCH_HEIGHT } from 'frontend/Components/UI/FooterAISearch'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import * as Animatable from 'react-native-animatable'
import images from 'assets/Image'
import { pixelByWidth, pixelByHeight, getHeightHeader } from 'common/styles'
import { lowerCase } from 'common/function'
import { ACCOUNT_TYPE } from 'common/constants/account'
import ReduxService from 'common/redux'
import { refreshAccountTokens, toggleTokenHidden } from 'src/Services/TokenListV2'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { AI_SEARCH_SESSION } from 'common/aiSearchHistory'
import I18n from 'assets/Lang'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import TokenRow from './Component/TokenRow'
import BalanceSyncLabel from './Component/BalanceSyncLabel'
import styles from './styles'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'

export const MIN_VALUE_USD = 0.01
// Auto-reload threshold: entering the screen with a cache older than this
// triggers a fresh balance  fetch (per-account, keyed off entry.lastSyncedAt).
const AUTO_RELOAD_STALE_MS = 60 * 60 * 1000
const SWIPE_HIDE_WIDTH = pixelByWidth(64)
// Entrance animation duration of the loading GIF + a small buffer. Once the GIF
// appears we keep it visible at least this long so a very fast refresh (Option B:
// loading flips off as soon as the fast chains land) doesn't cut the slide-in
// animation mid-way.
const GIF_MIN_VISIBLE_MS = 900
// Hard ceiling on how long the balance animation may be held back waiting for
// the screen transition to finish. See rowsVisible.
const ROWS_VISIBLE_FALLBACK_MS = 1000
// How long a just-arrived token stays flagged for its attention spin. Long
// enough to outlast the spin plus its colour hold, short enough that a row
// scrolled out of view and re-mounted afterwards doesn't play it a second time.
const ARRIVAL_WINDOW_MS = 4000
const NO_ARRIVALS = new Set()

export const filterTokenToShow = (token, filterHidden = true) => {
  if (filterHidden) {
    if (token?.isHidden) {
      return false
    }
  }
  return token?.isManuallyShown || (token.valueUSD || 0) >= MIN_VALUE_USD
}

const TokenListPage = (_this) => {
  const { state = {}, props, func } = _this
  const { route } = props || {}
  const address = lowerCase(route?.params?.address || '')

  const accountTokenListRedux = useSelector((s) => s.accountTokenListRedux)
  const accountListRedux = useSelector((s) => s.accountListRedux)
  const walletConnectRedux = useSelector((s) => s.walletConnectRedux)
  // Offline state (kept fresh by ReduxService.handleConnection). When offline the
  // balance is stale, so we dim it to Text_Low and show a noInternet icon.
  const isOnline = useSelector((s) => s.internetData)

  // View-only accounts can't sign, so WalletConnect (scan) is hidden in the footer.
  const isViewOnly = useMemo(() => {
    const account = (accountListRedux || []).find((item) => lowerCase(item?.address) === address)
    return account?.accountType === ACCOUNT_TYPE.VIEW_ONLY
  }, [accountListRedux, address])

  // Number of dApps this account is connected to over WalletConnect V2. Mirrors
  // the Home row logic: each session is bound to one account via `accountAddress`
  // (older entries fall back to the first accountArr namespace's address).
  const connectedDappCount = useMemo(() => {
    return (walletConnectRedux || [])
      .filter((item) => item?.isWalletConnectV2 && item?.session?.topic)
      .filter((item) => {
        const owner = item?.accountAddress || lowerCase(item?.accountArr?.[0]?.split(':')?.[2] || '')
        return !owner || owner === address
      }).length
  }, [walletConnectRedux, address])

  const entry = accountTokenListRedux?.[address]
  const tokens = entry?.tokens || []

  const selectedChainId = state.selectedChainId
  // `loading` drives the custom GIF only — the native RefreshControl spinner is
  // kept decoupled (refreshing={false}) so it retracts the instant the user
  // releases the pull instead of being held until the fetch resolves.
  const [loading, setLoading] = useState(false)

  // `showGif` mirrors `loading` but with a minimum visible window so the GIF's
  // slide-in animation always finishes (see GIF_MIN_VISIBLE_MS).
  const [showGif, setShowGif] = useState(false)
  const gifShownAtRef = useRef(0)
  useEffect(() => {
    if (loading) {
      gifShownAtRef.current = Date.now()
      setShowGif(true)
      return
    }
    const remaining = Math.max(0, GIF_MIN_VISIBLE_MS - (Date.now() - gifShownAtRef.current))
    const t = setTimeout(() => setShowGif(false), remaining)
    return () => clearTimeout(t)
  }, [loading])

  // The balance odometer is held while this screen isn't the visible one, and
  // released when it is. A native stack keeps this screen mounted behind Send /
  // Exchange, so the post-transaction balance reload would otherwise animate out
  // of sight and be over before the user navigates back.
  //
  // Released only after the transition settles — `useIsFocused` flips at the
  // START of the animation, which would spend the spin under a moving screen.
  //
  // The timer is a floor, not a nicety: while held, a row keeps showing the
  // balance the user last saw. If a leaked interaction handle stopped
  // runAfterInteractions from ever firing, that stale figure would stay on
  // screen indefinitely — unacceptable for a balance, and worth far more than
  // the animation. Whichever fires first wins.
  const [rowsVisible, setRowsVisible] = useState(false)
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => setRowsVisible(true))
      const fallback = setTimeout(() => setRowsVisible(true), ROWS_VISIBLE_FALLBACK_MS)
      return () => {
        task.cancel()
        clearTimeout(fallback)
        setRowsVisible(false)
      }
    }, [])
  )

  // Tokens that have just turned up in the wallet, so their row can spin once to
  // announce itself. A row cannot work this out alone: it mounts fresh both when
  // a token is genuinely new AND when it is simply scrolled back into view, and
  // only the screen can tell those apart.
  //
  // Diffed against `tokens` — the FULL list — not the filtered one. Filtering by
  // chain or unhiding a token makes rows appear without anything new arriving,
  // and diffing the visible list would announce those too.
  const seenTokenKeys = useRef(null)
  const [arrivedKeys, setArrivedKeys] = useState(NO_ARRIVALS)

  useEffect(() => {
    const keys = tokens.map((t) => t.metaKey)
    // The first populated list is the baseline: everything already in the wallet
    // is not an arrival. Without this the whole list would announce itself on
    // first load.
    if (seenTokenKeys.current === null) {
      if (!keys.length) return
      seenTokenKeys.current = new Set(keys)
      return
    }
    // An empty list carries no information — `entry` can be briefly absent, and
    // `tokens` then falls back to []. Learning from that would wipe the baseline
    // and announce the entire wallet when it comes back.
    if (!keys.length) return

    const fresh = keys.filter((k) => !seenTokenKeys.current.has(k))
    // REPLACE the set rather than adding to it, and do it even when nothing is
    // new: a token that has LEFT has to be forgotten. Send all of token A away
    // and it drops out of the list; receive it back and it should register as an
    // arrival again. Only adding meant `seen` remembered A forever, so it was
    // announced only if the screen had been torn down and rebuilt in between —
    // which is exactly the difference between refreshing in place and going out
    // to Home and back.
    seenTokenKeys.current = new Set(keys)
    if (!fresh.length) return
    setArrivedKeys(new Set(fresh))
  }, [tokens])

  // Clear the flags, but only once the rows are actually on screen — a token
  // received while the user is off in Send would otherwise have its moment
  // expire unseen.
  useEffect(() => {
    if (!arrivedKeys.size || !rowsVisible) return
    const t = setTimeout(() => setArrivedKeys(NO_ARRIVALS), ARRIVAL_WINDOW_MS)
    return () => clearTimeout(t)
  }, [arrivedKeys, rowsVisible])

  const doRefresh = useCallback(() => {
    if (!address) return
    // Offline: the fetch would fail anyway, and kicking off the loading GIF would
    // hide the offline icon / flip the balance back to white. Skip the reload and
    // keep the offline state intact.
    if (!isOnline) return
    // When a chain filter is active, refresh ONLY that chain — other chains'
    // already-loaded tokens stay untouched (the service prunes against the full
    // active list, not this subset). "All" (null) refreshes every active chain.
    const opts = selectedChainId != null ? { chainIds: [selectedChainId] } : {}
    // Defer ALL the work (state update + multi-chain fetch) until the pull-release
    // interaction and the list's snap-back animation have settled. Running the
    // setLoading re-render + fetch kickoff synchronously on the release frame
    // blocks the JS thread and makes the list visibly lag returning to position.
    InteractionManager.runAfterInteractions(() => {
      setLoading(true)
      refreshAccountTokens(address, opts).finally(() => setLoading(false))
    })
  }, [address, selectedChainId, isOnline])

  useEffect(() => {
    if (!address) return
    // Don't fire a second refresh if one for this account is already in flight
    // (e.g. the restore kick-off). Its progressive commits will fill the list;
    // re-calling would just duplicate the work.
    if (ReduxService.isTokenLoading(address)) return
    // First load only (never synced). Staleness-based reload is handled by the
    // precise-timer effect below (single owner, so no double trigger on entry).
    const noTokens = !entry || !entry.tokens || entry.tokens.length === 0
    if (noTokens) {
      doRefresh()
    }
  }, [address])

  // Auto-reload exactly when THIS account's cache crosses the staleness threshold.
  // Instead of polling, we sleep for the EXACT remaining time (threshold − age),
  // so the reload fires on time rather than up to one poll-interval late. A
  // completed refresh bumps lastSyncedAt → this effect re-runs and re-arms for the
  // next full threshold. Coming back online re-runs it too (isOnline dep), so a
  // crossing that happened while offline reloads as soon as connectivity returns.
  // Cleared on unmount (back to Home) — nothing runs in the background.
  useEffect(() => {
    if (!address) return
    const last = entry?.lastSyncedAt
    if (!last) return // never synced — first-load effect above owns this case
    const remaining = AUTO_RELOAD_STALE_MS - (Date.now() - last)
    const id = setTimeout(() => {
      if (!isOnline) return // will re-arm via isOnline dep when back online
      if (ReduxService.isTokenLoading(address)) return
      doRefresh()
    }, Math.max(0, remaining))
    return () => clearTimeout(id)
  }, [address, entry?.lastSyncedAt, isOnline, doRefresh])

  // Visible tokens exclude `isHidden`. Hidden tokens live in HiddenTokenList.
  const visibleTokens = useMemo(() => tokens.filter((t) => !t.isHidden), [tokens])

  const filteredTokens = useMemo(() => {
    // Tokens user explicitly unhid bypass the min-value filter — otherwise
    // tokens auto-hidden for lack of Keyring price (valueUSD=0) would
    // disappear right after the user shows them.
    let arr = visibleTokens.filter((t) => filterTokenToShow(t))
    if (selectedChainId != null) {
      arr = arr.filter((t) => Number(t.chainId) === Number(selectedChainId))
    }
    return arr
  }, [visibleTokens, selectedChainId])

  // Header total = sum of the tokens actually shown in the list (`filteredTokens`,
  // which already applies the min-value + chain filters). Summing the broader
  // `visibleTokens` would count sub-MIN_VALUE_USD tokens that are excluded from
  // the list — e.g. a $0.0075 token rendering the total as "$0.01" while not
  // appearing as a row. Driving off `filteredTokens` also keeps the figure
  // live-updating when a token is hidden/unhidden.
  const displayedTotalUSD = useMemo(
    () => filteredTokens.reduce((sum, t) => sum + (t.valueUSD || 0), 0),
    [filteredTokens]
  )

  // Same behaviour as the Home WalletConnect row: if this account already has
  // one or more WC connections, open the dApp manager; otherwise open the QR scanner.
  const handleScan = () => {
    NavigationActions.navigate(connectedDappCount > 0 ? NAME_SCREEN.walletConnect : NAME_SCREEN.scanScreen)
  }

  const handleOpenAISearch = () => {
    NavigationActions.navigate(NAME_SCREEN.aiSearch, { address, sessionKey: AI_SEARCH_SESSION.token })
  }

  // Offline icon and the loading GIF share the same top-right slot; the GIF only
  // shows while an in-flight refresh is running, so give it priority.
  const showOffline = !isOnline && !showGif

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      {/* Balance line: value on the left (flex, so autoFit has a bounded width),
        offline icon right-aligned and vertically centered on the same row. */}
      <View style={styles.balanceRow}>
        <FiatBalance
          valueUSD={displayedTotalUSD}
          style={[
            styles.totalValue,
            showGif && styles.totalValueWithGif,
            showOffline && styles.totalValueOffline
          ]}
          variant='title'
          autoFit
        />
        {/* Offline indicator — inline on the balance line. Balance is dimmed to
          Text_Low (see totalValueOffline) to signal the shown value may be stale. */}
        {showOffline && (
          <MyIcon uri={images.UIV2.icons.noInternet} variant='medium' style={styles.offlineIcon} />
        )}
      </View>
      {/* Last-synced label ("Update: now / 5m ago …") — reads THIS account's
        lastSyncedAt. Ticks itself; Text_Low in both online/offline states. */}
      <BalanceSyncLabel lastSyncedAt={entry?.lastSyncedAt} style={styles.syncLabel} />
      {/* Net-worth loading GIF — top-right, above the divider (same treatment as
        the old Home balance row). Shown while the balance is refreshing; the
        list/balance stay visible underneath so nothing blocks waiting on it. */}
      {showGif && (
        <Animatable.View style={styles.networthGifWrap} animation='fadeInLeft' duration={600} useNativeDriver>
          <ImageRender uri={images.KEYRING_NETWORTH_GIF_URL} style={styles.networthGif} resizeMode='contain' />
        </Animatable.View>
      )}
      <View style={styles.divider} />
    </View>
  )

  const renderEmpty = () => {
    // While loading don't block with a spinner — the header (balance + GIF)
    // is already visible, so just show nothing here until data arrives.
    if (loading) return null
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptySpacer} className='items-center'>
          <MyIcon uri={images.UIV2.icons.noData} variant='extraLarge' style={styles.emptyIcon} resizeMode='contain' />
          <MyText variant='small' className='text-low'>{I18n.t('v2.tokenList.noTokensYet')}</MyText>
        </View>
        <MyText variant='small' style={styles.emptyHint}>{I18n.t('v2.tokenList.minValueHint', { value: `$${MIN_VALUE_USD}` })}</MyText>
        <MyButton
          size='small'
          label={I18n.t('v2.addToken.title')}
          icon={<MyIcon uri={images.UIV2.icons.plusMedium} style={styles.addTokenIcon} />}
          onPress={() => func?.handleOpenAddToken()}
        />
      </View>
    )
  }

  const renderFooter = () => {
    if (!filteredTokens.length) return null
    return (
      <View style={styles.footerWrap}>
        <MyText variant='small' style={styles.emptyHint}>{I18n.t('v2.tokenList.minValueHint', { value: `$${MIN_VALUE_USD}` })}</MyText>
        <MyButton
          size='small'
          label={I18n.t('v2.addToken.title')}
          icon={<MyIcon uri={images.UIV2.icons.addWhite} variant='small' />}
          onPress={() => func?.handleOpenAddToken()}
        />
      </View>
    )
  }

  // ListHeaderComponent is passed as an ELEMENT (renderHeader()), not a function,
  // so the list reconciles it across renders instead of remounting it on every
  // per-chain Redux commit — a remount restarts the GIF's slide-in animation each
  // commit (looked like flicker/fade when many chains land in quick succession).
  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <LottieRefreshFlatList
        refreshing={showGif}
        onRefresh={doRefresh}
        // This screen already shows its own loading indicator (the header
        // net-worth GIF via showGif) during the refetch, so we only want the
        // pull/scrub animation here — not the in-list spinner on top of it.
        showWhileRefreshing={false}
        // Show the indicator just under the blur header (same spot the native
        // RefreshControl used via progressViewOffset).
        topOffset={getHeightHeader(true)}
        data={filteredTokens}
        // Android defaults this to TRUE (FlatList.js: `?? Platform.OS === 'android'`)
        // and it detaches descendants whose bounds fall outside the clipping rect.
        // A spinning balance puts a ~30-line reel — hundreds of dp tall — inside a
        // column clipped to one line, so most of that child's box sits outside the
        // row and Android is entitled to drop it: the column then paints nothing.
        // That is the "random digits missing while the green animation runs, fine
        // again once it stops" report, and it matches the shape exactly — at rest
        // there is no oversized child for the pass to find.
        removeClippedSubviews={false}
        // metaKey alone, WITHOUT the index. The service re-sorts by valueUSD on
        // every refresh, so an index in the key means a token that changes rank
        // gets a new key and React remounts its row instead of moving it. That
        // throws away everything the row was holding — including a balance
        // change parked to be animated on return, which is exactly the case a
        // send creates. metaKey is `chainId:address` and the service already
        // treats it as a unique map key.
        keyExtractor={(t) => t.metaKey}
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={(_progress, dragX) => {
              // Track the drag distance 1:1 so the Hide button slides in only as
              // far as the user has pulled — no early reveal / popover on light
              // swipes (matches the old MyAssets feel).
              const trans = dragX.interpolate({
                inputRange: [-SWIPE_HIDE_WIDTH, 0],
                outputRange: [0, SWIPE_HIDE_WIDTH],
                extrapolate: 'clamp'
              })
              return (
                <Animated.View style={{ width: SWIPE_HIDE_WIDTH, transform: [{ translateX: trans }] }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.swipeHideAction}
                    onPress={() => toggleTokenHidden(address, item.metaKey, true)}
                  >
                    <View style={{ flexDirection: 'column', alignItems: 'center' }}>
                      <View style={styles.swipeHideButton}>
                        <MyIcon uri={images.UIV2.icons.eyeHide} variant='small' />
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )
            }}
          >
            <TokenRow
              token={item}
              // Holds the balance animation until this screen is actually on
              // screen — see rowsVisible.
              active={rowsVisible}
              // One-shot spin for a token that has just arrived — see arrivedKeys.
              spinOnAppear={arrivedKeys.has(item.metaKey)}
              // View-only accounts CAN open the detail screen — it's read-only
              // info. The signable actions (send / swap / exchange) are disabled
              // there instead of blocking the whole screen.
              onPress={() => NavigationActions.navigate('tokenDetail', { token: item, address })}
            />
          </Swipeable>
        )}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.listContent, { paddingBottom: FOOTER_AISEARCH_HEIGHT + pixelByHeight(8) }]}
        showsVerticalScrollIndicator={false}
      />
      <FooterAISearch
        onPressHiddenTokens={func?.handleOpenHiddenTokens}
        onPressScan={isViewOnly ? null : handleScan}
        onPressSearch={handleOpenAISearch}
        hideScan={isViewOnly}
        hideSearch={isViewOnly}
      />
    </MyViewPage>
  )
}

export default TokenListPage
