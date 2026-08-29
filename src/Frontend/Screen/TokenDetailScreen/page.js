import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native'
import { AreaChart, LineChart } from 'react-native-svg-charts'
import * as shape from 'd3-shape'
import { Defs, Line, LinearGradient, Stop } from 'react-native-svg'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyBalance from 'frontend/Components/UI/MyBalance'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import ChartErrorBoundary from 'frontend/Components/UI/ChartErrorBoundary'
import images from 'assets/Image'
import { Colors, pixelByHeight, pixelByWidth, getHeightHeader } from 'common/styles'
import { convertAddressArrToString, getFlatSeriesDomain, isHideMenuForAppleReview, lowerCase, routeLinkScanWithToken } from 'common/function'
import { useSelector } from 'react-redux'
import { getChainIconByChain } from 'common/chain'
import ReduxService from 'common/redux'
import { ACCOUNT_TYPE } from 'common/constants/account'
import useGetTokenPriceChanges from 'frontend/Hooks/useGetTokenPriceChanges'
import useGetTokenPriceHistory from 'frontend/Hooks/useGetTokenPriceHistory'
import useGetTokenPrice from 'frontend/Hooks/useGetTokenPrice'
import useGetLendingTokenInfo from 'frontend/Hooks/useGetLendingTokenInfo'
import I18n from 'assets/Lang'
import createStyles from './styles'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import LottieRefreshFlatList from 'frontend/Components/UI/LottieRefreshFlatList'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import { isShareBasedProtocol } from 'keyring-agent-core'
import HeroBalance from './Component/HeroBalance'

// Up/down green & red shared by the chart, the price, and the 24h % so all
// three always agree — same hues as Colors.GREEN_TEXT / Colors.RED_TEXT.
// Gradient-fill tints (same hues liquidity v2 uses for its area fill).
const CHART_UP_FILL_COLOR = '#0E5D3A'
const CHART_DOWN_FILL_COLOR = '#752A2E'

// The APY chart is monochrome rather than up/down coloured: a supply APY is a
// yield, so there is no "down" direction to signal, and green here would read as
// a gain the number doesn't claim. A soft grey line over a slightly darker grey
// fill, so the curve stays the brightest thing in the card.
const CHART_APY_COLOR = '#BABEC4'
const CHART_APY_FILL_COLOR = '#8A9199'

// Fixed display order for the multi-timeframe change row; the API returns these
// timeFrame keys (any subset) and we render whichever are present in this order.
const TIMEFRAME_ORDER = ['1h', '24h', '7d', '14d', '30d', '1y']

// A lending market's size runs to millions, which would blow past the card's
// width spelled out in full — so it is abbreviated ("2.05M"). Only used for the
// market size; balances and prices keep their exact MyBalance rendering.
const formatCompactAmount = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const abs = Math.abs(num)
  const [divisor, unit] = abs >= 1e9
    ? [1e9, 'B']
    : abs >= 1e6
      ? [1e6, 'M']
      : abs >= 1e3
        ? [1e3, 'K']
        : [1, '']
  // Two decimals above 1K matches the mock ("2.05M"); below it the raw figure is
  // already short, so trailing zeros are the only noise worth dropping.
  const scaled = num / divisor
  const text = unit ? scaled.toFixed(2) : String(Number(scaled.toFixed(2)))
  // Comma-separate the integer part. The abbreviation keeps the mantissa under
  // 1000 for K/M, but a market in the trillions still lands a 4+ digit integer
  // part on the B suffix — "45678.00B" reads as noise, "45,678.00B" doesn't.
  // Done by hand rather than through formatNumberBro: that helper hardcodes
  // `trimMantissa: true`, which would turn the mock's "7.70M" into "7.7M".
  const [intPart, decPart] = text.split('.')
  const separated = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${decPart ? `${separated}.${decPart}` : separated}${unit}`
}

// Dashed horizontal rule at `value`, drawn inside a react-native-svg-charts
// chart. It MUST be a wrapper rather than a bare <Line>: the chart clones every
// child with its own extraProps (`x`/`y` d3 scales, `data`, `ticks`, `width`…),
// and react-native-svg's Line reads `x`/`y` as transform props — handing it a
// function there is a native-side error. Consuming `y` here and forwarding only
// real SVG props keeps that spread from reaching the primitive.
//
// Using the chart's own `y` scale also means the line lands on the same pixel
// the curve would for that value, insets and all, instead of a re-derivation
// that has to be kept in sync with contentInset by hand.
//
// `centered` puts the rule at the middle of the DOMAIN rather than at `value`'s
// own position. The average is a reference the eye reads against the curve, not
// a measurement off an axis — and this card draws no y axis — so a line that slid
// up and down with the series (sitting on the card floor whenever the average
// landed near the series min) just read as misplaced.
//
// It must still go through the chart's `y` scale, NOT a raw `height / 2`: the
// curve is drawn into the range [height - bottom, top], so a pixel measured off
// the full SVG height ignores `contentInset` and lands a visible gap away from a
// flat series' line. Asking the scale for the domain midpoint puts the rule in
// the same coordinate system as the curve, insets included — which is exactly
// where a flat series sits, so the two coincide.
const ChartAverageLine = ({ y, value, color, centered }) => {
  if (typeof y !== 'function') return null
  // `y.domain()` is the [min, max] the chart actually used — the widened one on
  // a flat series (see getFlatSeriesDomain), so this tracks whatever the chart
  // was given rather than re-deriving it from the data.
  const [domainMin, domainMax] = centered ? y.domain() : []
  const yPos = centered ? y((domainMin + domainMax) / 2) : y(value)
  if (!Number.isFinite(yPos)) return null
  return (
    <Line
      x1='0%'
      x2='100%'
      y1={yPos}
      y2={yPos}
      stroke={color}
      strokeWidth={pixelByWidth(1.5)}
      strokeDasharray={[pixelByWidth(5), pixelByWidth(5)]}
    />
  )
}

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
    onWithdraw,
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
  const { getAllChain, data: settingExchange } = useGetSettingExchange()
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

  const yieldProtocol = token?.yieldProtocol

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
    return isShareBasedProtocol(yieldProtocol)
  }, [token?.yieldAsset, yieldProtocol])
  const chartData = !isYieldToken && priceHistory.length > 1 ? priceHistory : null

  const chainId = token?.chainId

  // Whether to look up a supply-APY series at all. DELIBERATELY broader than
  // `isYieldToken` above: any token the API tagged with a `yieldProtocol` sits in
  // a lending market, so it has an APY worth charting — including the rebasing
  // receipts (aave-v3, compound-v3) that `isYieldToken` excludes because their
  // PRICE chart is still correct. The two flags answer different questions:
  // isYieldToken = "is the price series in the wrong unit?", this = "is there an
  // APY to show?".
  const hasYieldProtocol = !!yieldProtocol

  // The whole lending market behind this receipt token, from the core's
  // LendingService: its live + average supply APY and the daily samples, plus
  // the market size and the asset it actually lends. Gated so a plain token
  // never fires the scan — it has no lending market to find, and the lookup
  // costs upstream calls. Any underlying is supported (core reads each market's
  // asset on chain), so an aWETH position reports WETH's APY. Comes back null
  // (not an error) whenever the token isn't a curated market at all, in which
  // case the card falls back to whatever the price chart can show.
  const {
    data: lendingInfo,
    isLoading: isLendingInfoLoading,
    refetch: refetchLendingInfo
  } = useGetLendingTokenInfo(chainId, token?.contractAddress, hasYieldProtocol)

  // Only take over the card once there is a series long enough to draw. Until
  // then the price-chart branch renders (its own loading / no-data states), so a
  // slow lending lookup never leaves the card blank.
  const apyChartData = lendingInfo?.series?.length > 1 ? lendingInfo.series : null

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
      refetchPriceChanges(),
      refetchLendingInfo()
    ]).finally(() => setRefreshing(false))
  }, [address, chainId, refreshThisToken, refetchPrice, refetchPriceHistory, refetchPriceChanges, refetchLendingInfo])

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
    if (getAllChain().length > 0) {
      const isSupportChain = getAllChain()?.some(chain => {
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
          {/* Same maxWidth-hug column pattern for a long balance+symbol —
              MyRollingNumber marquees itself when it overflows the cap, so the
              wrapper is unchanged from the MyBalance/ticker it replaced. */}
          <View style={styles.heroBalanceWrap}>
            <HeroBalance
              address={address}
              metaKey={token.metaKey}
              balance={display.balance}
              symbol={display.symbol}
            />
          </View>
        </View>
      </View>
    </View>
  )

  const renderChart = () => {
    // Spin only when nothing can be drawn YET but still might be.
    //
    // A share-based token's PRICE history can never chart (wrong unit), so its
    // price request in flight is not a reason to spin — but its APY lookup is:
    // that one may still take over the card, and rendering "no data" first would
    // flash a wrong state a moment before the curve appears.
    //
    // A token with a VALID price chart is deliberately excluded even while its
    // APY lookup runs (aave-v3 / compound-v3 reach here): it already has
    // something correct to show, so it renders the price chart and swaps to the
    // APY card once the series lands. Spinning over a usable chart would be a
    // step backwards.
    if ((isChartLoading && !chartData && !isYieldToken) || (isYieldToken && isLendingInfoLoading)) {
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
    const valueMax = Math.max(...chartData)
    // Shared so the line sits exactly on top of the fill's upper edge.
    const CHART_INSET = { top: pixelByHeight(20), bottom: pixelByHeight(14) }

    // A price CAN be flat — a stablecoin barely moves — and an auto-scaled domain
    // collapses to a single value there, pinning the curve to the card floor.
    // Centring rescues that. Unlike the APY chart below, this one is NOT
    // zero-based: a price is read as movement, and anchoring $3,800 ETH to 0
    // would flatten a whole week into one line. See getFlatSeriesDomain.
    const { isFlat, gridMin, gridMax } = getFlatSeriesDomain(valueMin, valueMax)
    return (
      <View style={styles.chartPlaceholder}>
        {/* Fill only (no stroke) — AreaChart strokes the whole path including its
            flat bottom edge, which showed up as a stray horizontal line. */}
        <AreaChart
          // Fill baseline: the domain floor, so a flat series still fills from
          // the centred line down to the chart bottom rather than nothing.
          start={isFlat ? gridMin : valueMin}
          gridMin={gridMin}
          gridMax={gridMax}
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
          gridMin={gridMin}
          gridMax={gridMax}
          svg={{ stroke: chartColor, strokeWidth: pixelByWidth(2) }}
          curve={shape.curveCatmullRom}
          contentInset={CHART_INSET}
          animate
          animationDuration={1000}
        />
      </View>
    )
  }

  // The APY curve. Same visual language as the price chart (area fill + line on
  // top, identical insets so both variants occupy the exact same box), with two
  // additions the mock calls for: a dashed line at the average, and the "AVG x%"
  // badge sitting on it. Always drawn in the up/green palette — an APY is a
  // yield, so there is no "down" colour for the series itself.
  const renderApyChart = () => {
    // Same two placeholder states as the price chart, and for the same reason:
    // the slot must keep `chartPlaceholder`'s fixed height in every state so the
    // sections below the card never shift once the series lands.
    if (isLendingInfoLoading && !apyChartData) {
      return (
        <View style={[styles.chartPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
          <MyDotsLoading variant='small' />
        </View>
      )
    }
    // Spread into Math.min/max only after confirming a non-empty ARRAY. The
    // caller already gates on `apyChartData`, but this function is one render
    // away from an async source: `Math.min(...null)` and `Math.min(...undefined)`
    // both throw, and a chart is not worth crashing the screen over.
    if (!Array.isArray(apyChartData) || apyChartData.length < 2) {
      return (
        <View style={[styles.chartPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
          <MyText variant='small' style={{ color: Colors.TEXT_MEDIUM }}>{I18n.t('v2.tokenDetail.noChartData')}</MyText>
        </View>
      )
    }
    const valueMax = Math.max(...apyChartData)
    const CHART_INSET = { top: pixelByHeight(20), bottom: pixelByHeight(14) }
    const avg = Number(lendingInfo?.avgApyPercent)
    const hasAvg = Number.isFinite(avg)

    // An APY chart is ZERO-BASED, unlike the price chart above. A rate is an
    // absolute quantity a user reads against 0 ("4% is good"), not a relative
    // movement, so the protocols' own charts (Aave, DefiLlama) all anchor the
    // floor at 0 — and so does this one.
    //
    // It also makes the card immune to a single bad sample. Auto-scaling to
    // [valueMin, valueMax] means one outlier day in `apyHistory` sets the whole
    // domain: the spike takes the top of the card and squashes every other day
    // into a flat line along the floor. Anchored at 0 an outlier is just a
    // spike, and the rest of the series keeps its real position and its fill.
    //
    // Headroom above the peak so the curve never touches the top edge — and,
    // when a series is flat, so `gridMin === gridMax` can't collapse the domain
    // to a single value (which pins the line to the floor). That makes
    // getFlatSeriesDomain's centring unnecessary here: a flat 4.13% series sits
    // at 4.13/4.55 of the height, which is where it belongs.
    const gridMin = 0
    const gridMax = valueMax > 0 ? valueMax * 1.1 : 0.01
    return (
      <View style={styles.chartPlaceholder}>
        <AreaChart
          // Fill baseline: 0, matching the domain floor, so the fill spans the
          // whole card from the curve down to the bottom edge.
          start={gridMin}
          gridMin={gridMin}
          gridMax={gridMax}
          style={{ flex: 1 }}
          data={apyChartData}
          svg={{ fill: 'url(#apyChartGradient)' }}
          curve={shape.curveCatmullRom}
          contentInset={CHART_INSET}
          animate
          animationDuration={1000}
        >
          <Defs>
            <LinearGradient id='apyChartGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
              <Stop offset='0%' stopColor={CHART_APY_FILL_COLOR} stopOpacity='0.9' />
              <Stop offset='50%' stopColor={CHART_APY_FILL_COLOR} stopOpacity='0.8' />
              <Stop offset='100%' stopColor={CHART_APY_FILL_COLOR} stopOpacity='0' />
            </LinearGradient>
          </Defs>
        </AreaChart>
        <LineChart
          style={StyleSheet.absoluteFill}
          data={apyChartData}
          gridMin={gridMin}
          gridMax={gridMax}
          svg={{ stroke: CHART_APY_COLOR, strokeWidth: pixelByWidth(2) }}
          curve={shape.curveCatmullRom}
          contentInset={CHART_INSET}
          animate
          animationDuration={1000}
        >
          {/* Dashed reference line at the average's OWN position — not centred.
              Centring existed to rescue a flat series whose auto-scaled domain
              collapsed onto the card floor; on a zero-based domain the average
              already lands next to the curve, so drawing it anywhere else would
              just misreport it. */}
          {hasAvg && (
            <ChartAverageLine value={avg} color={Colors.TEXT_MEDIUM} />
          )}
        </LineChart>
        {hasAvg && (
          // Parked in the card's bottom-left corner rather than riding the dashed
          // line: the line's height varies with the series, and a badge that
          // tracked it would collide with the curve on a low average.
          <View style={[styles.apyAvgBadge, { bottom: pixelByHeight(24) }]}>
            <MyText variant='small' style={styles.apyAvgBadgeLabel}>{I18n.t('v2.tokenDetail.avg')}</MyText>
            <MyBalance
              fontWeight='700'
              variant='small'
              value={avg}
              fractionDigits={2}
              fixedDecimals
              suffix='%'
              style={styles.apyAvgBadgeValue}
            />
          </View>
        )}
      </View>
    )
  }

  // Yield-token variant of the chart card: the headline is the market's supply
  // APY instead of a price, the pill on its right is the day-over-day APY change,
  // and the row beneath shows the market's total size. Layout mirrors
  // renderChartCard exactly so the two never shift the content below them.
  const renderApyChartCard = () => {
    const change = Number(lendingInfo?.apyChangePercent)
    const hasChange = Number.isFinite(change)
    // Denominated in the market's OWN asset (WETH, USDC, …), which core resolves
    // on chain — so the amount is always rendered with the symbol that came back
    // with it, never a hardcoded ticker. Symbol unreadable ⇒ show the bare number
    // rather than mislabel it.
    const totalSupplied = formatCompactAmount(lendingInfo?.totalSupplied)
    const suppliedLabel = lendingInfo?.assetSymbol
      ? `${totalSupplied} ${lendingInfo.assetSymbol}`
      : totalSupplied
    // The live rate is the headline; the average stands in when the protocol
    // reports no live figure (the series is then all we have).
    const headline = Number.isFinite(Number(lendingInfo?.currentApyPercent))
      ? Number(lendingInfo.currentApyPercent)
      : Number(lendingInfo?.avgApyPercent)
    const hasHeadline = Number.isFinite(headline)
    // While the lookup is in flight there is no rate to show yet. Render the
    // headline's own fixed-height slot EMPTY rather than a placeholder `0%`,
    // which would read as a real 0% APY for the moment before the data lands.
    // The slot keeps its height either way, so nothing below it moves.
    const isApyPending = isLendingInfoLoading && !hasHeadline

    return (
      <MyLinearGradient disableClip style={styles.chartCard}>
        <View style={styles.chartCardInner}>
          <View style={styles.chartTopRow}>
            <View style={styles.chartPriceWrap}>
              {hasHeadline ? (
                <MyBalance
                  variant='subTitle'
                  value={headline}
                  fractionDigits={2}
                  fixedDecimals
                  suffix='%'
                  style={styles.apyHeadline}
                />
              ) : <></>}
            </View>
            {hasChange ? (
              <View style={styles.apyChangePill}>
                <MyBalance
                  variant='small'
                  value={change}
                  fractionDigits={2}
                  fixedDecimals
                  suffix='%'
                  signed
                  style={change >= 0 ? styles.apyChangeUp : styles.apyChangeDown}
                />
              </View>
            ) : <></>}
          </View>

          {/* Same fixed-height slot as the price card's timeframe row. The row
              itself ALWAYS renders so it keeps reserving its height — only the
              text inside is gated, so the card is the same height while the
              lookup runs as it is once the data lands. */}
          <View style={styles.apySuppliedRow}>
            {!!totalSupplied && !isApyPending ? (
              <>
                <MyText style={styles.apySuppliedLabel}>{I18n.t('v2.tokenDetail.totalSupplied')}</MyText>
                <MyText style={styles.apySuppliedValue}>{suppliedLabel}</MyText>
              </>
            ) : <></>}
          </View>

          <ChartErrorBoundary
            resetKey={apyChartData}
            fallback={(
              <View style={[styles.chartPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
                <MyText variant='small' style={{ color: Colors.TEXT_MEDIUM }}>{I18n.t('v2.tokenDetail.noChartData')}</MyText>
              </View>
            )}
          >
            {renderApyChart()}
          </ChartErrorBoundary>

          {/* Only meaningful once a curve is actually drawn — same gate the price
              card uses, so the badge never floats over a spinner or "no data". */}
          {apyChartData ? (
            <View
              style={{
                position: 'absolute',
                right: pixelByWidth(12),
                bottom: pixelByWidth(12),
                zIndex: 100
              }}>
              <MyIcon
                variant='medium'
                uri={images.UIV2.icons.icon_history_7d}
                style={{ zIndex: 100 }}
              />
            </View>
          ) : <></>}
        </View>
      </MyLinearGradient>
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

        {/* The chart is the one part of this card fed by async third-party data
            through d3 + svg-charts; a throw in there must not take the balance
            and actions down with it. `resetKey` lets a later refresh retry. */}
        <ChartErrorBoundary
          resetKey={chartData}
          fallback={(
            <View style={[styles.chartPlaceholder, { alignItems: 'center', justifyContent: 'center' }]}>
              <MyText variant='small' style={{ color: Colors.TEXT_MEDIUM }}>{I18n.t('v2.tokenDetail.noChartData')}</MyText>
            </View>
          )}
        >
          {renderChart()}
        </ChartErrorBoundary>
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
      {yieldProtocol
        ? (
          <OperationRow
            // `lendingInfo` is what carries the market's contract / protocol
            // family / underlying, and a withdrawal cannot be encoded without
            // it. Until the lookup resolves (or when it comes back null for a
            // market core can't identify) the row is dimmed and unpressable,
            // rather than looking live and doing nothing on tap.
            disabled={isViewOnly || !lendingInfo?.contract}
            icon={images.UIV2.icons.withdraw}
            title={I18n.t('v2.tokenDetail.withdraw')}
            onPress={() => onWithdraw({ ...token, ...display, lendingInfo })}
          />
        )
        : null}

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
              {/* A yield token whose lending market we resolved shows its APY
                  history; everything else (and a yield token we couldn't match)
                  keeps the price chart. */}
              {yieldProtocol ? renderApyChartCard() : renderChartCard()}
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
