import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyNumber from 'frontend/Components/UI/MyNumber'
import MyRollingNumber from 'frontend/Components/UI/MyRollingNumber'
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
    marginTop: pixelByHeight(2),
    gap: pixelByWidth(8)
  },
  // Takes the width left after the change%. No alignItems on purpose — the
  // odometer has to be handed this full width so it can tell whether the balance
  // overflows and needs to scroll; it right-aligns itself internally.
  balanceWrap: { flex: 1 },
  up: { color: Colors.GREEN },
  down: { color: Colors.RED_TEXT }
})

// Props:
//   noChevron   bool — hide the right-arrow (e.g. inside HiddenTokenList).
//   isSelected  bool — when true, override the dim styling (used by hidden-list
//                       multi-select: selected rows render bright, others dim).
//   active      bool — forwarded to MyRollingNumber: the balance animation is
//                       held while the screen isn't the one on screen, so a
//                       refresh that lands during Send/Exchange plays on return
//                       instead of finishing out of sight.
//   spinOnAppear bool — forwarded too: the token has only just turned up in the
//                       wallet, so its balance spins once to announce itself.
//                       The screen decides this — a row can't tell "new token"
//                       from "scrolled back into view".
const TokenRow = ({ token, onPress, noChevron, isSelected, active, spinOnAppear }) => {
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
          <View style={styles.lineBottom}>
            <View>
              <MyNumber value={change} fractionDigits={2} fixedDecimals suffix='%' signed style={changeStyle} />
            </View>
            <View style={styles.balanceWrap}>
              {/* Odometer spin — up/green or down/red — whenever a refresh
                  brings a different balance in. `identity` is the token key so
                  a recycled row doesn't animate the swap. */}
              <MyRollingNumber
                className='text-medium'
                value={balance}
                identity={token.metaKey}
                active={active}
                spinOnAppear={spinOnAppear}
                fractionDigits={8}
                suffix={` ${token.symbol || ''}`}
              />
            </View>

          </View>
        </View>
        {!noChevron && <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' />}
      </View>
    </TouchableOpacity>
  )
}

export default TokenRow
