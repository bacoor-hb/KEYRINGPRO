import { StyleSheet } from 'react-native'
import { pixelByHeight, pixelByWidth, sizeImageSquare, Colors, fontSize, width, getSizeImgSquare, getSafeAreaValues } from 'common/styles'

const createStyles = () => {
  return StyleSheet.create({
    container: {
      flex: 1
    },

    scrollContent: {
      paddingBottom: getSafeAreaValues().bottom + pixelByHeight(44) * 2
    },

    // ── Token hero ───────────────────────────────────────────────────────────
    heroSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: pixelByHeight(16)
    },
    heroTokenIcon: {
      marginRight: pixelByWidth(12)
    },
    // Text block to the right of the icon, split into two stacked lines.
    heroTextArea: {
      flex: 1
    },
    heroLineTop: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    // flex: 1 lets the name take the remaining width after valueUSD claims its
    // intrinsic width, so the ticker scrolls exactly when name meets valueUSD.
    heroNameWrap: {
      flex: 1,
      marginRight: pixelByWidth(8)
    },
    // maxWidth (hug), NOT a fixed width: the box shrinks to the value's own width
    // and is pushed to the right edge by the flex:1 name, so a short value sits
    // flush right. The cap is the SAME as heroBalanceWrap so that when both are
    // long they marquee across the same width and line up vertically. A lower cap
    // makes more values reach it (so they align more often) at the cost of
    // marqueeing sooner.
    heroValueWrap: {
      maxWidth: width(50),
      marginLeft: pixelByWidth(8)
    },
    heroValue: {
      color: Colors.WHITE,
      textAlign: 'right'
    },
    heroLineBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: pixelByHeight(2)
    },
    // maxWidth (hug) for balance+symbol, same cap as heroValueWrap so the two
    // marquee across the same width and align vertically when both are long.
    heroBalanceWrap: {
      maxWidth: width(50),
      marginLeft: pixelByWidth(8)
    },
    heroBalance: {
      textAlign: 'right'
    },
    heroChangeText: {
      color: Colors.RED_TEXT
    },
    heroChangeTextUp: {
      color: Colors.GREEN_TEXT
    },

    // ── Chart card ───────────────────────────────────────────────────────────
    // Background comes from MyLinearGradient (rounded by the gradient itself);
    // padding lives on chartCardInner so the gradient fills edge-to-edge.
    chartCard: {
      marginBottom: pixelByHeight(14)
    },
    chartCardInner: {
      padding: pixelByWidth(12),
      position: 'relative'
    },
    // ── Chart card: price + rank + multi-timeframe change row ────────────────
    chartTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: pixelByHeight(8)
    },
    chartPriceWrap: {
      flexDirection: 'row',
      alignItems: 'baseline'
    },
    chartPriceUp: {
      color: Colors.GREEN_TEXT
    },
    chartPriceDown: {
      color: Colors.RED_TEXT
    },
    chartPriceSymbol: {
      color: Colors.WHITE,
      marginLeft: pixelByWidth(6)
    },
    rankPill: {
      borderRadius: 24,
      backgroundColor: Colors.BG_BOX_SECONDARY,
      height: pixelByHeight(28),
      // alignContent: 'center',
      justifyContent: 'center',
      // paddingVertical: pixelByHeight(2)
      paddingHorizontal: pixelByWidth(12)
    },
    // Pinned "Learn more about X" AI pill at the bottom of the screen — liquid
    // glass treatment matching the AI-search button (FooterAISearch).
    learnMoreWrap: {
      height: getSizeImgSquare('large'),
      borderRadius: 24
    },
    learnMoreInner: {
      flex: 1,
      height: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: pixelByWidth(8),
      paddingHorizontal: pixelByWidth(16)
    },
    learnMoreIcon: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
    },
    rankPillText: {
      color: Colors.TEXT_MEDIUM
    },
    // Reserved height for the timeframe change row so the chart underneath
    // keeps its position even before the async change data has loaded.
    changeRowSlot: {
      height: pixelByHeight(22),
      marginBottom: pixelByHeight(16)
    },
    changeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    },
    changeItem: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    changeTimeframe: {
      color: Colors.TEXT_LOW
    },
    changeSlash: {
      color: Colors.TEXT_LOW
    },
    changePctUp: {
      color: Colors.GREEN_TEXT
    },
    changePctDown: {
      color: Colors.RED_TEXT
    },
    chartPlaceholder: {
      height: pixelByHeight(128),
      overflow: 'hidden',
      position: 'relative'
    },

    // ── Section title ────────────────────────────────────────────────────────
    sectionTitle: {
      marginBottom: pixelByHeight(4)
    },

    // ── Information chips ────────────────────────────────────────────────────
    infoChipsRow: {
      flexDirection: 'row',
      gap: pixelByWidth(12)
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1D1E24',
      borderRadius: pixelByWidth(24),
      paddingLeft: pixelByWidth(4),
      paddingVertical: pixelByWidth(3),
      paddingRight: pixelByWidth(6),
      gap: pixelByWidth(6),
      borderWidth: pixelByWidth(1),
      borderColor: Colors.BG_BOX_SMALL,
      height: pixelByHeight(28)
    },
    chipIcon: {
      width: sizeImageSquare(16),
      height: sizeImageSquare(16),
      borderRadius: sizeImageSquare(8)
    },

    websiteText: {
      color: Colors.BRAND,
      maxWidth: pixelByWidth(220)
    },

    // Divider under the Information chips (separates from "Token operation").
    infoDivider: {
      height: 1,
      backgroundColor: Colors.BG_BOX_SMALL,
      marginTop: pixelByHeight(14)
    },

    // ── Operation list ───────────────────────────────────────────────────────
    operationList: {
      marginTop: pixelByHeight(0)
    },
    // Row holds the left icon (outside the divider) + the content wrap
    // (which carries the divider, so the line doesn't extend under the icon).
    operationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: pixelByHeight(52)
    },
    operationContent: {
      flex: 1,
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between'

    },
    operationIconWrap: {
      width: getSizeImgSquare('large'),
      height: getSizeImgSquare('large'),
      alignItems: 'center',
      justifyContent: 'center'
    },
    aiBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#1C2733',
      borderRadius: pixelByWidth(12),
      paddingHorizontal: pixelByWidth(8),
      paddingVertical: pixelByHeight(4),
      gap: pixelByWidth(4)
    },
    aiBadgeText: {
      fontSize: fontSize(12),
      color: Colors.WHITE
    },
    // Bottom-right corner badge, painted on top of the chart (see renderChart).
    chart24hWrap: {
      position: 'absolute',
      right: 0,
      bottom: 0
    },
    chart24h: {
      width: getSizeImgSquare('small'),
      height: getSizeImgSquare('small')
    },

    // ── Sub-operation (expanded) ─────────────────────────────────────────────
    subOperationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: pixelByHeight(14),
      paddingLeft: pixelByWidth(46),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Colors.BG_BOX_SMALL
    },
    subOperationLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: pixelByWidth(12)
    }
  })
}

export default createStyles
