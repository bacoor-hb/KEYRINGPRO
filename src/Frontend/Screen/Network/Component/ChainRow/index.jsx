import React from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyText from 'frontend/Components/UI/MyText'
import images from 'assets/Image'
import { Colors, getSizeImgSquare, pixelByHeight, pixelByWidth, sizeImageSquare } from 'common/styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

type RightAction = {
  icon: number | string,
  onPress: () => void
}

type Props = {
  icon: string,
  title: string,
  rightLabel?: string | number,
  gasSymbol?: string,
  rightAction?: RightAction,
  isActive: boolean,
  disabled?: boolean,
  noBorder?: boolean,
  sanitizeIconFilters?: boolean,
  onPress: () => void
}

// Opacity for active/inactive lives on the Pressable (a touchable is never view-flattened
// by Fabric, so its native view is stable). Putting an opacity that toggles 1<->0.5 on a
// plain <View> flips it between flattened/un-flattened and crashes Fabric mid-transaction.
const ChainRow = React.memo(({ icon, title, rightLabel, gasSymbol, rightAction, isActive, disabled, noBorder, iconWrapClassName, sanitizeIconFilters, onPress }: Props) => {
  // The touch/layout structure stays exactly as the plain row: the chain Pressable
  // and the (independent) delete button are siblings. The divider is a separate
  // absolutely-positioned line at the bottom, inset from the left by the chain-icon
  // column so it never runs under the icon, while still spanning full width to the
  // right (under the delete button). Keeping it a fixed-width line (toggled by COLOR,
  // not width) avoids the Fabric view-flattening flip that a 0<->1 borderWidth causes.
  const iconColumnWidth = getSizeImgSquare('large')
  return (
    <View style={styles.row}>
      <Pressable onPress={onPress} disabled={disabled || !onPress} style={[styles.mainArea, disabled ? styles.disabled : isActive ? styles.active : styles.inactive]}>
        <View className={`flex flex-row justify-end ${iconWrapClassName}`} style={{ width: iconColumnWidth }}>
          <MyIcon uri={icon} uriDefault={images.UIV2.icons.unknowChain} variant='medium' isBorderIcon sanitizeFilters={sanitizeIconFilters} />
        </View>
        <View style={styles.label}>
          <View style={{ flex: 1 }}>
            <MyTextTicker className={isActive ? 'text-white' : 'text-medium'}>
              {title}
            </MyTextTicker>
          </View>
          {gasSymbol
            ? (
              <View style={styles.gasWrap}>
                <MyIcon variant='small' uri={images.UIV2.icons.gas} resizeMode='contain' />
                <MyText className='text-low uppercase'>{gasSymbol}</MyText>
              </View>
            )
            : (rightLabel !== undefined && rightLabel !== null && rightLabel !== '' && (
              <MyText className={isActive ? 'text-white' : 'text-medium'}>{String(rightLabel)}</MyText>
            ))}
        </View>
      </Pressable>
      {rightAction && (
        <Pressable onPress={rightAction.onPress} hitSlop={8} style={styles.actionBox}>
          <MyIcon uri={rightAction.icon} variant='small' resizeMode='contain' />
        </Pressable>
      )}
      {/* Bottom divider — inset left past the icon column, full-width to the right. */}
      <View
        pointerEvents='none'
        style={[
          styles.divider,
          { left: iconColumnWidth + pixelByWidth(12) },
          noBorder && styles.dividerHidden
        ]}
      />
    </View>
  )
})

ChainRow.displayName = 'ChainRow'

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12)
  },
  label: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(8),
    paddingVertical: pixelByHeight(0),
    height: pixelByHeight(52)
  },
  // Bottom divider drawn as its own line so it can be inset from the left (past the
  // icon column) yet span full width to the right (under the delete button).
  divider: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: pixelByHeight(1),
    backgroundColor: Colors.BG_BOX_SMALL
  },
  // Hide the last row's divider by COLOR only (not width/height) so shrinking or
  // unmounting the list never flips Fabric's view-flattening (which crashes there).
  dividerHidden: {
    backgroundColor: 'transparent'
  },
  actionBox: {
    paddingLeft: pixelByWidth(12),
    paddingVertical: pixelByHeight(8)
  },
  gasWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(4)
  },
  active: {
    opacity: 1
  },
  inactive: {
    opacity: 0.5
  },
  disabled: {
    opacity: 0.2
  }
})

export default ChainRow
