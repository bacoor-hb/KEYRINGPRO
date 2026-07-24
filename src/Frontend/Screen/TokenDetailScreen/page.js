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
import useGetTokenPriceChanges from 'frontend/Hooks/useGetTokenPriceChanges'
import useGetTokenPriceHistory from 'frontend/Hooks/useGetTokenPriceHistory'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { AI_SEARCH_SESSION } from 'common/aiSearchHistory'
import I18n from 'assets/Lang'
import GlassView from 'frontend/Components/UI/GlassView'
import createStyles from './styles'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import BottomGradientBar from 'frontend/Components/UI/BottomGradientBar'

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
  const chartData = priceHistory.length > 1 ? priceHistory : null

  const chainId = token?.chainId

  // On entry, refresh THIS token's chain balance so the hero/holding value isn't
  // the stale snapshot taken when the row was tapped on the token list. Keyed on
  // a primitive (chainId), so it fires once per screen rather than on every live
  // re-render after the fetch commits. The price/chart hooks already refetch
  // fresh on mount, so this only needs to cover the balance.
  useEffect(() => {
    if (!address || !chainId) return
    refreshAccountTokens(address, { chainIds: [chainId] })
  }, [address, chainId])

  // Pull-to-refresh: reload the balance AND the live price / chart / change data
  // from the API, driving the custom three-dot Lottie spinner while in flight.
  const [refreshing, setRefreshing] = useState(false)
  const doRefresh = useCallback(() => {
    if (!address || !chainId) return
    setRefreshing(true)
    Promise.allSettled([
      refreshAccountTokens(address, { chainIds: [chainId] }),
      refetchPrice(),
      refetchPriceHistory(),
      refetchPriceChanges()
    ]).finally(() => setRefreshing(false))
  }, [address, chainId, refetchPrice, refetchPriceHistory, refetchPriceChanges])

  // Normalize to a fixed-order list of { timeFrame, changePercent }, dropping
  // any timeframe the API didn't return. The 24h value comes from a different
  // source than the rest (token.priceChange24hPct, same as the token name / hero
  // %), so we override just the 24h entry to keep both spots in agreement.
  const changeList = useMemo(() => {
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
  }, [priceChanges, token.priceChange24hPct])

  const sosialIconList = useMemo(() => ReduxService.getAppSettingByKey?.('SOCIAL_ICON') || {}, [])

  const display = useMemo(() => {
    const change = Number(token.priceChange24hPct) || 0
    const isNative = !!token.isNative || token.contractAddress === 'native'
    const balance = token.balanceFormatted || 0
    // Prefer the freshly fetched live price; fall back to the cached snapshot.
    const livePrice = Number(livePriceUSD)
    const price = livePrice > 0 ? livePrice : (token.priceUSD || 0)
    // Keep the holding value coherent with the price shown — recompute it from
    // the live price when we have one, else fall back to the snapshot value.
    const valueUSD = livePrice > 0 ? balance * price : (token.valueUSD || 0)
    return {
      name: token.name || token.symbol || '-',
      symbol: token.symbol || '',
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
        ? (token.symbol || I18n.t('v2.tokenDetail.native'))
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

  // "Learn more" → open the AI assistant on this token. We hand AISearch a
  // DIRECT get-token-info call (`directTool`) so it can skip the router/LLM
  // arg-parsing and run the tool straight away, plus `initialMessage` as the
  // visible question (and the fallback when the core predates runTool — AISearch
  // then just sends it through the normal chat() pipeline). Covers every token
  // shape: ERC20 (exact contract lookup), native coin (symbol/name), unknown
  // chain, and the no-identifier case (no keyword → no directTool → chat path).
  const onLearnMore = () => {
    // Identifier label for the research prompt — kept English (Gemini-facing).
    const tokenLabel = display.name || display.symbol || 'this token'
    // Visible chat bubble — show it in the user's app language. Its own fallback
    // ("this token") is localized too, so the bubble never mixes languages. The
    // research `prompt` below stays English (forwarded verbatim to Gemini, which
    // the user never sees); the reply language is pinned separately by AISearch.
    const displayLabel = display.name || display.symbol || I18n.t('AISearch.thisToken')
    const userMessage = I18n.t('AISearch.tellMeAboutToken', { value: displayLabel })

    // keyword: ERC20 → exact contract lookup (0x…); native coin (no contract) →
    // symbol, then name. The tool treats a 0x value as a precise lookup and
    // anything else as a name/symbol search.
    const isErc20 = !display.isNative &&
      typeof token.contractAddress === 'string' &&
      token.contractAddress.startsWith('0x')
    const keyword = isErc20 ? token.contractAddress : (display.symbol || display.name || '')

    // chain: this token's OWN chain (may differ from the AISearch wallet chain),
    // passed as a hex string (e.g. '0x1', '0xa') — the core resolves by hex
    // chainId. Accept an already-hex value as-is; convert a decimal id to hex.
    // Omit when missing/blank/invalid so the tool resolves from wallet context
    // instead of erroring.
    const chainRaw = display.chainId != null ? String(display.chainId).trim() : ''
    let chain
    if (chainRaw) {
      chain = chainRaw.startsWith('0x')
        ? chainRaw.toLowerCase()
        : (Number.isNaN(Number(chainRaw)) ? undefined : `0x${Number(chainRaw).toString(16)}`)
    }

    // Self-contained research prompt — the tool forwards this verbatim to Gemini
    // (it does NOT see the user's message), so it must name the token + chain.
    // Use the human-readable decimal id here (e.g. "1", "10"); `args.chain` below
    // carries the hex form the core resolves by.
    const prompt =
      `Research the ${tokenLabel}${display.symbol ? ` (${display.symbol})` : ''} token` +
      `${chainRaw ? ` on chain ${chainRaw}` : ''} using up-to-date web sources. ` +
      'Cover: what it is and its core utility; current USD price, 24h change, market cap, FDV and 24h volume; ' +
      'recent news or announcements in the last 30 days with dates and sources; the concrete reason behind any ' +
      'recent price move; on-chain signals such as holder count, liquidity and unusual volume; team or protocol ' +
      'updates; key risks or red flags; and overall sentiment with a brief, hedged short-term outlook.'

    // No usable identifier (no contract, symbol or name) → skip the direct tool
    // and let AISearch send `initialMessage` through the normal pipeline.
    const directTool = keyword
      ? { name: 'get-token-info', args: { keyword, ...(chain ? { chain } : {}), prompt } }
      : null

    NavigationActions.navigate(NAME_SCREEN.aiSearch, {
      address,
      sessionKey: AI_SEARCH_SESSION.token,
      initialMessage: userMessage,
      directTool
    })
  }

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
    if (isChartLoading && !chartData) {
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
      <MyText variant='subTitle' className='text-white' style={{ marginBottom: pixelByHeight(12) }}>{I18n.t('v2.tokenDetail.tokenOperation')}</MyText>

      <OperationRow
        icon={images.UIV2.icons.home.send}
        title={I18n.t('Initial.send')}
        onPress={onSend}
      />
      {
        isHideMenuForAppleReview()
          ? null : (
            <OperationRow
              disabled={disableExchange}
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
              disabled={disableExchange}
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
        {/* Pinned AI prompt — opens the assistant pre-asked about this token.
            Same liquid-glass treatment as the AI-search button in FooterAISearch. */}
        <BottomGradientBar style={{ paddingHorizontal: 0 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.learnMoreWrap}
            onPress={onLearnMore}
          >
            <GlassView interactive effect='clear' style={styles.learnMoreWrap}>
              <View style={styles.learnMoreInner}>
                <MyIcon uri={images.UIV2.icons.aiChat} variant='small' style={styles.learnMoreIcon} />
                <MyText className='text-medium'>
                  {I18n.t('AISearch.learnMoreAbout', { value: display.symbol || display.name })}
                </MyText>
              </View>
            </GlassView>
          </TouchableOpacity>
        </BottomGradientBar>
      </View>

    </MyViewPage>
  )
}

export default TokenDetailScreenPage
