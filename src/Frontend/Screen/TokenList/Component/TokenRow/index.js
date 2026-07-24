import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyNumber from 'frontend/Components/UI/MyNumber'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import images from 'assets/Image'
import { Colors, pixelByHeight, pixelByWidth, width } from 'common/styles'

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pixelByWidth(0),
    gap: pixelByWidth(12)
  },
  hidden: { opacity: 0.4 },
  // Divider lives on the content area only, so it does NOT extend under the
  // left chain/token icon. borderWidth is constant on every row to avoid the
  // Fabric flatten flip that happens when width toggles 0<->1 as the list grows.
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8),
    paddingVertical: pixelByHeight(12),
    borderBottomWidth: 1,
    borderBottomColor: Colors.BG_BOX_SMALL
  },
  // Two stacked lines instead of two columns: top = name|valueUSD,
  // bottom = change|balance. This makes the name ticker scroll based on its OWN
  // line (against valueUSD) rather than the longer balance+symbol line below.
  textArea: { flex: 1 },
  lineTop: { flexDirection: 'row', alignItems: 'center' },
  // flex: 1 lets the name take the remaining width after valueUSD claims its
  // intrinsic width, so the ticker scrolls exactly when name meets valueUSD.
  nameWrap: { flex: 1, marginRight: pixelByWidth(8) },
  name: { color: Colors.WHITE },
  // maxWidth caps valueUSD so an extreme value truncates (numberOfLines=1)
  // instead of eating the whole line and leaving the name almost no room.
  value: { color: Colors.WHITE, textAlign: 'right', maxWidth: width(50) },
  lineBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: pixelByHeight(2)
  },
  // maxWidth keeps a long balance+symbol from pushing the change% off-screen;
  // it truncates (numberOfLines=1) instead of growing the row.
  balance: {
    color: Colors.TEXT_MEDIUM,
    maxWidth: width(55),
    marginLeft: pixelByWidth(8),
    textAlign: 'right'
  },
  up: { color: Colors.GREEN },
  down: { color: Colors.RED_TEXT }
})

// Props:
//   noChevron   bool — hide the right-arrow (e.g. inside HiddenTokenList).
//   isSelected  bool — when true, override the dim styling (used by hidden-list
//                       multi-select: selected rows render bright, others dim).
const TokenRow = ({ isViewOnly, token, onPress, noChevron, isSelected }) => {
  if (!token) return null
  const valueUSD = token.valueUSD || 0
  const balance = token.balanceFormatted || 0
  const change = token.priceChange24hPct || 0
  const changeStyle = change >= 0 ? styles.up : styles.down
  const isDim = token.isHidden && !isSelected

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.row, isDim && styles.hidden]}
      onPress={onPress}
      // No onPress (e.g. view-only account) ⇒ disable so there's no press feedback.
      disabled={!onPress}
    >
      <TokenIconWithChain tokenIconUri={token.iconUrl} chainId={token.chainId} />
      <View style={styles.content}>
        <View style={styles.textArea}>
          <View style={styles.lineTop}>
            <View style={styles.nameWrap}>
              <MyTextTicker variant='subTitle' style={styles.name}>{token.name || token.symbol || '-'}</MyTextTicker>
            </View>
            <FiatBalance valueUSD={valueUSD} variant='subTitle' style={styles.value} numberOfLines={1} />
          </View>
          <View style={[styles.lineBottom, { gap: pixelByWidth(8) }]}>
            <View>
              <MyNumber value={change} fractionDigits={2} fixedDecimals suffix='%' signed style={changeStyle} />
            </View>
            <View
              style={{
                flex: 1,
                alignItems: 'flex-end'
              }}
            >
              <MyTextTicker>
                <MyNumber
                  className='text-medium'
                  value={balance}
                  fractionDigits={8}
                  suffix={` ${token.symbol || ''}`}
                  numberOfLines={1}
                />
              </MyTextTicker>

            </View>

          </View>
        </View>
        {!noChevron && <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' style={{ opacity: isViewOnly ? 0.5 : 1 }} />}
      </View>
    </TouchableOpacity>
  )
}

export default TokenRow
