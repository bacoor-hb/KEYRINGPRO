import { View, Image, StyleSheet } from 'react-native'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { lowerCase } from 'common/function'
import { Colors, getSizeImgSquare, sizeImageSquare } from 'common/styles'
import { SvgXml } from 'react-native-svg'
import Blockie from '@emurgo/react-native-blockies-svg'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { getChainIconByChain } from 'common/chain'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'
import MyIcon from '../MyIcon'

const SVG_DATA_PREFIX = 'data:image/svg+xml;base64,'
// Blockie renders an 8x8 grid scaled up; scale=3 keeps the SVG at 24px (== AVATAR_SIZE).
const BLOCKIE_GRID = 4

// `chainId` swaps the bottom-right badge from the account-type icon to the chain
// icon — for places that show which chain an account is acting on (e.g. a
// WalletConnect request) rather than what kind of account it is. The two share
// the one corner, so the chain wins when both would apply. A chain with no icon
// falls back to the account-type badge rather than rendering an empty ring.
const AvatarAccount = ({ account, noShowAccountType = false, size = getSizeImgSquare('medium'), chainId }) => {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)

  // View-only accounts never show a registered address-book avatar — always fall
  // back to the default blockie derived from the address.
  const isViewOnly = account?.accountType === ACCOUNT_TYPE.VIEW_ONLY
  const registeredAvatar = useSelector(
    (state) => (state.addressBookInfo?.[lowerCase(account.address)]?.info?.avatar || '').trim()
  )
  const addressBookAvatar = isViewOnly ? '' : registeredAvatar

  const isSvgAvatar = addressBookAvatar.startsWith(SVG_DATA_PREFIX)
  const svgXml = isSvgAvatar
    ? Buffer.from(addressBookAvatar.slice(SVG_DATA_PREFIX.length), 'base64').toString('utf8')
    : ''

  const blockieScale = Math.max(1, Math.floor(size / BLOCKIE_GRID))

  const chainIcon = chainId != null ? getChainIconByChain(chainId) : null

  // Only view-only accounts get a type badge now — hot/cold no longer show one.
  const getAccountType = () => {
    switch (account.accountType) {
      case ACCOUNT_TYPE.VIEW_ONLY:
        return images.UIV2.icons.account.viewOnlyAccount
    }
  }

  const accountTypeIcon = getAccountType()

  return (
    <View className=' relative' style={{ width: size, height: size }}>
      {
        (addressBookAvatar && !avatarLoadFailed) ? (
          isSvgAvatar ? (
            <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
              <SvgXml xml={svgXml} width={size} height={size} />
            </View>
          ) : (
            <Image
              source={{ uri: addressBookAvatar }}
              onError={() => setAvatarLoadFailed(true)}
              style={{ width: size, height: size, borderRadius: size / 2 }}
            />
          )
        ) : (
          <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
            <Blockie seed={lowerCase(account.address)} size={BLOCKIE_GRID} scale={blockieScale} />
          </View>
        )
      }
      {
        chainIcon ? (
          // White ring around the chain badge (same pattern as TokenIconWithChain).
          // No overflow:'hidden' so the native FastImage/SvgUri inside isn't
          // clipped — that clip layer crashes Fabric on unmount.
          <View style={styles.badgeWrap}>
            <ImageRender uri={chainIcon} style={styles.badgeIcon} resizeMode='cover' />
          </View>
        ) : !noShowAccountType && accountTypeIcon && (
          <View style={{ bottom: -sizeImageSquare(6), right: -sizeImageSquare(6) }} className=' absolute '>
            <MyIcon uri={accountTypeIcon} variant='small' />
          </View>
        )
      }

    </View>
  )
}

const BADGE_SIZE = getSizeImgSquare('small')

const styles = StyleSheet.create({
  badgeWrap: {
    position: 'absolute',
    right: -sizeImageSquare(2),
    bottom: -sizeImageSquare(2),
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: Colors.BLACK,
    borderWidth: 1,
    borderColor: Colors.WHITE,
    justifyContent: 'center',
    alignItems: 'center'
  },
  // Core = BADGE_SIZE minus the LITERAL 2px ring (1px each side). Subtract a plain
  // 2, not `sizeImageSquare(2)` — the border isn't scaled by sizeImageSquare, so
  // scaling the 2 only matches when the ratio is exactly 1.
  badgeIcon: {
    width: BADGE_SIZE - 2,
    height: BADGE_SIZE - 2,
    borderRadius: (BADGE_SIZE - 2) / 2
  }
})

export default AvatarAccount
