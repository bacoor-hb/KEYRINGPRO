import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { AreaChart, LineChart } from 'react-native-svg-charts'
import * as shape from 'd3-shape'
import { Defs, LinearGradient, Stop } from 'react-native-svg'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import images from 'assets/Image'
import { Colors, pixelByHeight, pixelByWidth, getHeightHeader } from 'common/styles'
import { convertAddressArrToString, isHideMenuForAppleReview, lowerCase, routeLinkScanWithToken } from 'common/function'
import { useSelector } from 'react-redux'
import { getChainIconByChain } from 'common/chain'
import ReduxService from 'common/redux'
import { ACCOUNT_TYPE } from 'common/constants/account'
import useGetTokenPriceChanges from 'frontend/Hooks/useGetTokenPriceChanges'
import useGetTokenPriceHistory from 'frontend/Hooks/useGetTokenPriceHistory'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import I18n from 'assets/Lang'
import createStyles from './styles'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { isShareBasedProtocol } from 'keyring-agent-core'

// Up/down green & red shared by the chart, the price, and the 24h % so all
// three always agree — same hues as Colors.GREEN_TEXT / Colors.RED_TEXT.
// Gradient-fill tints (same hues liquidity v2 uses for its area fill).
const CHART_UP_FILL_COLOR = '#0E5D3A'
const CHART_DOWN_FILL_COLOR = '#752A2E'

// Fixed display order for the multi-timeframe change row; the API returns these
// timeFrame keys (any subset) and we render whichever are present in this order.
const TIMEFRAME_ORDER = ['1h', '24h', '7d', '14d', '30d', '1y']

const OperationRow = ({ disabled, icon, title, onPress, rightElement, style }) => {
  const styles = createStyles()
  return (
    // <TouchableOpacity
    //   style={styles.operationRow}
    //   onPress={onPress}
    //   activeOpacity={0.7}
    // >
    //   <View style={styles.operationIconWrap}>
    //     <MyIcon uri={icon} variant='medium' resizeMode='contain' />
    //   </View>
    //   <View style={[styles.operationContent, style]}>
    //     <MyText className='text-medium'>{title}</MyText>
    //     {rightElement || (
    //       <MyIcon variant='small' uri={images.UIV2.icons.arrowRightLow} />
    //     )}
    //   </View>
    // </TouchableOpacity>
    <MyRowItem
      disable={disabled}
      onPress={onPress}
      lefIcon={(
        <View style={styles.operationIconWrap}>
          <MyIcon uri={icon} variant='medium' resizeMode='contain' />
        </View>
      )}
    >

      <View style={[styles.operationContent, style]}>
        <MyText className='text-medium'>{title}</MyText>
        {rightElement || (
          <MyIcon variant='small' uri={images.UIV2.icons.arrowRightLow} />
        )}
      </View>
    </MyRowItem>
  )
}

const TokenDetailScreenPage = (_this) => {
  const { func, props, setState } = _this
  const {
    onSend,
    onExchange,
    onSwapAndSend
  } = func

  const styles = createStyles()

  const routeParams = props?.route?.params || {}
  const address = lowerCase(routeParams.address || '')
  const accountTokenListRedux = useSelector((s) => s.accountTokenListRedux)
  const accountListRedux = useSelector((s) => s.accountListRedux)
  // View-only accounts hold no key, so they can't sign. The screen still shows
  // every piece of info — only the signable operations below are disabled.
  const isViewOnly = useMemo(() => {
    const account = (accountListRedux || []).find((item) => lowerCase(item?.address) === address)
    return account?.accountType === ACCOUNT_TYPE.VIEW_ONLY
  }, [accountListRedux, address])
  const { data: settingExchange } = useGetSettingExchange()
  // The navigation param `token` is just a snapshot taken when the screen opened.
  // Merge the LIVE entry from accountTokenList (refreshed e.g. after a send) over
  // it so balance/value stay current. If the token dropped out of the synced list
  // (balance fully spent), reflect a zero balance instead of the stale snapshot.
  const token = useMemo(() => {
    const base = routeParams.token || {}
    const entry = accountTokenListRedux?.[address]
    if (!base.metaKey || !entry?.tokens) return base
    const live = entry.tokens.find((t) => t.metaKey === base.metaKey)
    if (live) return { ...base, ...live }
    return { ...base, balanceFormatted: 0, valueUSD: 0 }
  }, [routeParams.token, accountTokenListRedux, address])

  // Multi-timeframe price changes (1h/24h/7d/14d/30d/1y) for the change row.
  const { data: priceChanges, refetch: refetchPriceChanges } = useGetTokenPriceChanges(token?.coinGeckoId)

  // Live token price from our API, refetched fresh on every entry (no query cache)
  // so the hero/chart price isn't the stale token-list snapshot. native →
  // contractAddress is 'native', which the hook maps to zeroAddress internally.
  const { data: livePriceUSD, refetch: refetchPrice } = useGetTokenPrice(
    token?.chainId,
    token?.contractAddress,
    { cacheTime: 0, staleTime: 0 }
  )

  // Lazy-load real price history by coinGeckoId. Days from app settings (fallback 7).
  // A series shorter than 2 points can't be charted, so treat it as no data.
  const { data: priceHistory, isLoading: isChartLoading, refetch: refetchPriceHistory } = useGetTokenPriceHistory(token?.coinGeckoId)
  // Yield/vault tokens (the API returns a `yieldAsset`) price per SHARE, while the
  // history series is the underlying's — the two don't line up, so rather than
  // draw a misleading curve we show the no-data state until a per-share series
  // exists. Temporary: drop this guard once the API serves vault price history.
  //
  // `yieldAsset` is the primary signal — the API sends it only for share-based
  // vaults, the exact tokens whose price history is in the wrong unit. `!!{}` is
  // true, so an empty object would blank a plain token's chart: require at least
  // one own key rather than mere presence.
  //
  // isShareBasedProtocol is checked too because the two tags are stored together
  // but can arrive apart. A token added by an older build carries neither until
  // the mount refresh backfills them, and that refresh can fail; core's
  // allow-list then still identifies the vault from `yieldProtocol` alone.
  // Deliberately NOT a bare `yieldProtocol` test, which would also catch
  // rebasing receipts (aave-v3 etc.) — their price IS the underlying's, so their
  // chart is correct and must keep rendering.
  const isYieldToken = useMemo(() => {
    const yieldAsset = token?.yieldAsset
    if (yieldAsset && Object.keys(yieldAsset).length > 0) return true
    return isShareBasedProtocol(token?.yieldProtocol)
  }, [token?.yieldAsset, token?.yieldProtocol])
  const chartData = !isYieldToken && priceHistory.length > 1 ? priceHistory : null

  const chainId = token?.chainId

  // Refresh ONLY the token this screen shows. `tokenAddress` takes
  // refreshAccountTokens' targeted shortcut: a direct RPC read for this one
  // token instead of the whole chain's Moralis/multicall pipeline. That path
  // re-prices share-based vaults too, so it is correct for every token type.
  const contractAddress = token?.contractAddress
  const refreshThisToken = useCallback(() => {
    if (!address || !chainId || !contractAddress) return Promise.resolve()
    return refreshAccountTokens(address, {
      chainIds: [chainId],
      tokenAddress: [contractAddress]
    })
  }, [address, chainId, contractAddress])

  // On entry, refresh so the hero/holding value isn't the stale snapshot taken
  // when the row was tapped on the token list. Keyed on primitives, so it fires
  // once per screen rather than on every live re-render after the fetch commits
  // (`refreshThisToken` itself is stable for the same reason). The price/chart
  // hooks already refetch fresh on mount, so this only needs to cover the balance.
  useEffect(() => {
    refreshThisToken()
  }, [refreshThisToken])

  // Pull-to-refresh: reload the balance AND the live price / chart / change data
  // from the API, driving the custom three-dot Lottie spinner while in flight.
  const [refreshing, setRefreshing] = useState(false)
  const doRefresh = useCallback(() => {
    if (!address || !chainId) return
    setRefreshing(true)
    Promise.allSettled([
      refreshThisToken(),
      refetchPrice(),
      refetchPriceHistory(),
      refetchPriceChanges()
    ]).finally(() => setRefreshing(false))
  }, [address, chainId, refreshThisToken, refetchPrice, refetchPriceHistory, refetchPriceChanges])

  // Normalize to a fixed-order list of { timeFrame, changePercent }, dropping
  // any timeframe the API didn't return. The 24h value comes from a different
  // source than the rest (token.priceChange24hPct, same as the token name / hero
  // %), so we override just the 24h entry to keep both spots in agreement.
  //
  // Hidden for a yield token for the same reason the chart is: these percentages
  // track the UNDERLYING's price, not the per-share price shown above, so they
  // would contradict the hero. Empty list ⇒ the row renders nothing.
  const changeList = useMemo(() => {
    if (isYieldToken) return []
    const byFrame = {}
    priceChanges.forEach((c) => { if (c?.timeFrame) byFrame[c.timeFrame] = c })
    return TIMEFRAME_ORDER
      .map((tf) => byFrame[tf])
      .filter(Boolean)
      .map((c) => ({
        timeFrame: c.timeFrame,
        changePercent: c.timeFrame === '24h'
          ? (Number(token.priceChange24hPct) || 0)
          : (Number(c.changePercent) || 0)
      }))
  }, [priceChanges, token.priceChange24hPct, isYieldToken])

  const sosialIconList = useMemo(() => ReduxService.getAppSettingByKey?.('SOCIAL_ICON') || {}, [])

  const display = useMemo(() => {
    const change = Number(token.priceChange24hPct) || 0
    const isNative = !!token.isNative || token.contractAddress === 'native'
    const balance = token.balanceFormatted || 0
    // Unit price. The token list's own priceUSD normally wins: it is refreshed by
    // the same pass that produced `valueUSD` below, so the price shown and the
    // holding shown always come from one snapshot. `livePriceUSD` is otherwise a
    // fallback for a token the list has no price for (it is fetched on mount and
    // can be older than Redux — see the valueUSD note).
    //
    // With NO balance that agreement is vacuous — `valueUSD` is 0 whichever price
    // is used — so the fresher number wins instead. This is what a zero-balance
    // token needs: the balance refresh has no balance to patch, so its stored
    // price is only as new as the last time it held something, and for a vault
    // added by an older build it can be the raw UNDERLYING price rather than the
    // per-share one `livePriceUSD` resolves.
    const livePrice = Number(livePriceUSD)
    const storedPrice = token.priceUSD || 0
    const hasBalance = balance > 0
    const price = hasBalance
      ? (storedPrice > 0 ? storedPrice : (livePrice > 0 ? livePrice : 0))
      : (livePrice > 0 ? livePrice : storedPrice)
    // Holding value: the token list's own number whenever it has one, exactly
    // like TokenRow — that is what keeps the two screens showing the same figure.
    //
    // It is NOT recomputed from `livePrice`. For a share-based yield vault the
    // list stores a per-SHARE priceUSD (valueUSD / shares, see
    // applyYieldConversions), so `balance x priceUSD` reproduces valueUSD
    // exactly — but only against the price from the SAME refresh. `livePriceUSD`
    // comes from react-query and is fetched on mount only (staleTime: 0 marks
    // data stale, it does not refetch when Redux changes), so as the vault
    // accrues, refreshAccountTokens raises the stored per-share price while
    // `livePrice` stays at its mount-time value — multiplying by it pinned the
    // holding to its opening number while the list kept rising.
    //
    // The fallback covers the case where there is no list entry to agree with:
    // `token` is then the raw navigation snapshot (Redux has no tokens for this
    // account yet — deep link, freshly restored wallet, or a token built without
    // a metaKey; see the `token` memo's early return). Showing $0 there while a
    // price and a balance are both on screen would be plainly wrong, and with no
    // stored value in play `balance x price` cannot disagree with anything.
    const valueUSD = token.valueUSD || balance * price
    // Already the on-chain ticker when one was resolved — the balance pipeline
    // writes it onto `symbol` before committing (see TokenListV2/symbolOnchain).
    const symbol = token.symbol || ''
    return {
      name: token.name || symbol || '-',
      symbol,
      iconUri: token.iconUrl || null,
      chainId: token.chainId,
      isNative,
      valueUSD,
      changePct: change,
      isPriceUp: change >= 0,
      balance,
      rank: token.marketCapRank ? `#${token.marketCapRank}` : I18n.t('v2.tokenDetail.noRank'),
      price,
      // Native → symbol; ERC20 → short address (same format used elsewhere).
      contractDisplay: isNative
        ? (symbol || I18n.t('v2.tokenDetail.native'))
        : convertAddressArrToString([token.contractAddress || ''], 6, 6)
    }
  }, [token, livePriceUSD])

  const disableExchange = useMemo(() => {
    if (settingExchange?.chainSupport?.length > 0) {
      const isSupportChain = settingExchange?.chainSupport?.some(chain => {
        return chain?.chainId?.toString() === display?.chainId?.toString()
      })

      if (isSupportChain) {
        return false
      }
    }

    return true
  }, [settingExchange, display])

  // Single up/down direction (24h change) shared by price, chart and the % text.
  const chartColor = display.isPriceUp ? Colors.GREEN_TEXT : Colors.RED_TEXT
  // Symmetric gradient fill matching liquidity v2: bright near the line, fading
  // up/down into the card background. Background tint follows the price direction.
  const chartFillColor = display.isPriceUp ? CHART_UP_FILL_COLOR : CHART_DOWN_FILL_COLOR

  const infoChips = useMemo(() => {
    const socials = token?.socials || {}
    const homepageList = Array.isArray(socials.homepage)
      ? socials.homepage
      : (socials.homepage ? [socials.homepage] : [])
    const chats = Array.isArray(socials.chat_url) ? socials.chat_url : []
    const findChat = (kw) => chats.find((c) => typeof c === 'string' && c.includes(kw))

    return [
      ...homepageList.filter(Boolean).map((u, i) => ({
        key: `home-${i}`, type: 'website', label: u, icon: images.UIV2.icons.browserBlue, url: u
      })),
      socials.facebook_username && {
        key: 'fb', label: 'Facebook', icon: sosialIconList.facebook, url: `https://www.facebook.com/${socials.facebook_username}`
      },
      socials.twitter_screen_name && {
        key: 'tw', label: 'Twitter', icon: sosialIconList.x, url: `https://twitter.com/${socials.twitter_screen_name}`
      },
      socials.telegram_channel_identifier && {
        key: 'tg', label: 'Telegram', icon: sosialIconList.telegram, url: `https://t.me/${socials.telegram_channel_identifier}`
      },
      socials.subreddit_url && {
        key: 'rd', label: 'Reddit', icon: sosialIconList.reddit, url: socials.subreddit_url
      },
      findChat('discord') && { key: 'dc', label: 'Discord', icon: sosialIconList.discord, url: findChat('discord') },
      findChat('youtube') && { key: 'yt', label: 'Youtube', icon: sosialIconList.youtube ?? 'https://ipfs.pantograph.app/ipfs/QmPgDEGv9axUB1ePgY7rGKZDnGV3zN7ip1QxmUvNFiVFGC?filename=youtube.png', url: findChat('youtube') },
      findChat('medium') && { key: 'md', label: 'Medium', icon: sosialIconList.medium, url: findChat('medium') }
    ].filter(Boolean)
  }, [token, sosialIconList])

  const chainIcon = getChainIconByChain(display.chainId)
  const explorerUrl = (!display.isNative && token.contractAddress)
    ? routeLinkScanWithToken(token.contractAddress, display.chainId, true)
    : null

  useEffect(() => {
    setState((pre) => ({
      ...pre,
      exchange: {
        ...pre.exchange,
        tokenIn: { ...token, ...display },
        chainIdOut: token?.chainId || null
      },
      swapAndSend: {
        ...pre.swapAndSend,
        tokenIn: { ...token, ...display },
        chainIdOut: token?.chainId || null
      }
    }))
  }, [token, display])

  const renderHeroSection = () => (
    <View style={styles.heroSection}>
      <View style={styles.heroTokenIcon}>
        <TokenIconWithChain
          tokenIconUri={display.iconUri}
          chainId={display.chainId}
        />
      </View>
      {/* Two stacked lines (top = name|valueUSD, bottom = change|balance) so the
          name ticker scrolls against its OWN line (valueUSD) rather than the
          longer balance+symbol line below — same layout as the TokenRow list. */}
      <View style={styles.heroTextArea}>
        <View style={styles.heroLineTop}>
          <View style={styles.heroNameWrap}>
            <MyTextTicker variant='subTitle'>{display.name}</MyTextTicker>
          </View>
          {/* maxWidth-hug column (see styles.heroValueWrap): a short value sits
              flush right and stays static; marquees only when it overflows the
              cap (same cap as balance, so both align when long). */}
          <View style={styles.heroValueWrap}>
            <FiatBalance
              variant='subTitle'
              valueUSD={display.valueUSD}
              style={styles.heroValue}
              ticker
            />
          </View>
        </View>
        <View style={styles.heroLineBottom}>
          <MyBalance
            value={display.changePct}
            fractionDigits={2}
            fixedDecimals
            suffix='%'
            signed
            style={display.isPriceUp ? styles.heroChangeTextUp : styles.heroChangeText}
          />
          {/* Same maxWidth-hug column pattern for a long balance+symbol. */}
          <View style={styles.heroBalanceWrap}>
            <MyBalance
              // variant='small'
              className='text-medium'
              value={display.balance}
              fractionDigits={8}
              suffix={` ${display.symbol}`}
              style={styles.heroBalance}
              ticker
            />
          </View>
        </View>
      </View>
    </View>
  )

  const renderChart = () => {
    // A yield token goes straight to "no data" — no spinner first, since the
    // in-flight history request can never produce a chart for it.
    if (isChartLoading && !chartData && !isYieldToken) {
      return (
        <View style={[styles.chartPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
          <MyDotsLoading variant='small' />
        </View>
      )
    }
    if (!chartData || chartData.length < 2) {
      return (
        <View style={[styles.chartPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
          <MyText variant='small' style={{ color: Colors.TEXT_MEDIUM }}>{I18n.t('v2.tokenDetail.noChartData')}</MyText>
        </View>
      )
    }
    // Area-fill that fades from the line down to the chart floor. Baseline is the
    // series min so the fill spans line→bottom of the visible box (not a symmetric
    // ±max fill), letting the vertical gradient read as bright→transparent.
    const valueMin = Math.min(...chartData)
    // Shared so the line sits exactly on top of the fill's upper edge.
    const CHART_INSET = { top: pixelByHeight(20), bottom: pixelByHeight(14) }
    return (
      <View style={styles.chartPlaceholder}>
        {/* Fill only (no stroke) — AreaChart strokes the whole path including its
            flat bottom edge, which showed up as a stray horizontal line. */}
        <AreaChart
          start={valueMin}
          style={{ flex: 1 }}
          data={chartData}
          svg={{ fill: 'url(#chartGradient)' }}
          // catmullRom for a softer, rounder curve through the price points.
          // Note: it can slightly overshoot flat runs with isolated dips, so the
          // fill may bulge a touch above the line on near-constant series.
          curve={shape.curveCatmullRom}
          // Small top inset so the peak isn't clipped; tiny bottom inset so the
          // fill reaches the chart floor and fades out right at the edge.
          contentInset={CHART_INSET}
          animate
          animationDuration={1000}
        >
          <Defs>
            <LinearGradient id='chartGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
              <Stop offset='0%' stopColor={chartFillColor} stopOpacity='0.9' />
              <Stop offset='50%' stopColor={chartFillColor} stopOpacity='0.8' />
              <Stop offset='100%' stopColor={chartFillColor} stopOpacity='0' />
            </LinearGradient>
          </Defs>
        </AreaChart>
        {/* The price line on top — only the curve itself, no bottom edge. */}
        <LineChart
          style={StyleSheet.absoluteFill}
          data={chartData}
          svg={{ stroke: chartColor, strokeWidth: pixelByWidth(2) }}
          curve={shape.curveCatmullRom}
          contentInset={CHART_INSET}
          animate
          animationDuration={1000}
        />
      </View>
    )
  }

  const renderChartCard = () => (
    <MyLinearGradient disableClip style={styles.chartCard}>
      <View style={styles.chartCardInner}>
        <View style={styles.chartTopRow}>
          <View style={styles.chartPriceWrap}>
            <FiatBalance
              variant='subTitle'
              valueUSD={display.price}
              dynamicDecimals
              style={[display.isPriceUp ? styles.chartPriceUp : styles.chartPriceDown]}
            />
          </View>
          <View style={styles.rankPill}>
            <MyText variant='small' style={styles.rankPillText}>{display.rank}</MyText>
          </View>
        </View>

        {/* Fixed-height slot: always reserves the change-row space so the chart
            below doesn't jump down once the (async) timeframe data arrives. */}
        <View style={styles.changeRowSlot}>
          {changeList.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.changeRow}
            >
              {changeList.map((c) => {
                const isUp = c.changePercent >= 0
                return (
                  <View key={c.timeFrame} style={styles.changeItem}>
                    <MyText style={styles.changeTimeframe}>{c.timeFrame}</MyText>
                    <MyText variant='small' style={styles.changeSlash}>/</MyText>
                    <MyBalance
                      value={c.changePercent}
                      fractionDigits={2}
                      fixedDecimals
                      suffix='%'
                      signed
                      style={isUp ? styles.changePctUp : styles.changePctDown}
                    />
                  </View>
                )
              })}
            </ScrollView>
          )}
        </View>

        {renderChart()}
        {!chartData || chartData.length < 2 ? <></> : (
          <View
            style={{
              position: 'absolute',
              right: pixelByWidth(12),
              bottom: pixelByWidth(12),
              zIndex: 100
            }}>
            <MyIcon
              variant='medium'
              uri={images.UIV2.icons.icon_history_24h}
              style={{
                zIndex: 100
              }}
            />
          </View>
        )}

      </View>
    </MyLinearGradient>
  )

  const renderContractChip = () => {
    const tappable = !!explorerUrl
    return (
      <TouchableOpacity
        style={styles.infoChip}
        activeOpacity={tappable ? 0.7 : 1}
        onPress={tappable ? () => Linking.openURL(explorerUrl) : undefined}
      >
        {!!chainIcon && (
          <MyIcon variant='small' isBorderIcon uri={chainIcon} style={styles.chainIconImage} />

        )}
        <MyText variant='small'>{display.contractDisplay}</MyText>
      </TouchableOpacity>
    )
  }

  const renderInformationSection = () => (
    <View style={{ marginBottom: pixelByHeight(14) }}>
      <MyText className='text-low' style={styles.sectionTitle}>{I18n.t('v2.tokenDetail.information')}</MyText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.infoChipsRow}
      >
        {renderContractChip()}
        {infoChips.map((s) => {
          const isWebsite = s.type === 'website'
          return (
            <TouchableOpacity
              key={s.key}
              style={styles.infoChip}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(s.url)}
            >
              {!!s.icon && <MyIcon uri={s.icon} variant='small' />}
              <MyText
                variant='small'
                numberOfLines={1}
                style={isWebsite ? styles.websiteText : undefined}
              >
                {s.label}
              </MyText>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      <View style={styles.infoDivider} />
    </View>
  )

  const renderOperations = () => (
    <View style={styles.operationList}>
      <MyText variant='subTitle' className='text-white' style={{ marginBottom: pixelByHeight(12), opacity: isViewOnly ? 0.5 : 1 }}>{I18n.t('v2.tokenDetail.tokenOperation')}</MyText>

      {/* All three operations need a signature, so a view-only account gets them
          dimmed + unpressable (MyRowItem's `disable` does both). */}
      <OperationRow
        disabled={isViewOnly}
        icon={images.UIV2.icons.home.send}
        title={I18n.t('Initial.send')}
        onPress={onSend}
      />
      {
        isHideMenuForAppleReview()
          ? null : (
            <OperationRow
              disabled={isViewOnly || disableExchange}
              icon={images.UIV2.icons.swapAndSend}
              title={I18n.t('v2.swapAndSend.title')}
              onPress={() => onSwapAndSend({ ...token, ...display })}
            />
          )
      }
      {
        isHideMenuForAppleReview()
          ? null : (
            <OperationRow
              disabled={isViewOnly || disableExchange}
              icon={images.UIV2.icons.exchange}
              title={I18n.t('Initial.exchange')}
              onPress={() => onExchange({ ...token, ...display })}
            />
          )
      }

    </View>
  )

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <View
        style={{
          flex: 1
        }}>
        <LottieRefreshFlatList
          refreshing={refreshing}
          onRefresh={doRefresh}
          // Only run the drag/scrub animation — don't hold an in-list spinner
          // while the API refetch is in flight. The icon retracts the instant the
          // user releases instead of waiting on the network.
          showWhileRefreshing={false}
          topOffset={getHeightHeader(true)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          data={[]}
          keyExtractor={(_, idx) => String(idx)}
          renderItem={() => null}
          ListHeaderComponent={(
            <>
              {renderHeroSection()}
              {renderChartCard()}
              {renderInformationSection()}
              {renderOperations()}
            </>
          )}

        />
      </View>

    </MyViewPage>
  )
}

export default TokenDetailScreenPage
