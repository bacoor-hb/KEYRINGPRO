/* eslint-disable react-native/no-unused-styles */
import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Image } from 'react-native'
import images from 'assets/Image'
import { useSelector } from 'react-redux'
import { lowerCase } from 'common/function'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { SvgXml } from 'react-native-svg'

const AddressBookAvatarWithChain = ({
  address,
  chainId,
  chainType,
  addressBookInfoCustom
}) => {
  const addressBookInfo = useSelector(state => state.addressBookInfo)
  const blockchainListRedux = useSelector(state => state.blockchainListRedux)

  const addressBookAvatar = (addressBookInfoCustom?.info?.avatar || addressBookInfo?.[lowerCase(address)]?.info?.avatar || '').trim()
  const isSvgData = addressBookAvatar?.startsWith('data:image/svg+xml;base64,')
  const base64DataSvg = isSvgData ? Buffer.from(addressBookAvatar.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8') : ''

  const chainIcon = blockchainListRedux?.[chainId]?.icon || images?.[`${chainType}Icon`] || images.UIV2.icons.unknowChain

  const [addressBookAvatarImageSource, setAddressBookAvatar] = useState(addressBookAvatar ? { uri: addressBookAvatar } : null)

  useEffect(() => {
    if (!addressBookAvatarImageSource && addressBookAvatar) {
      setAddressBookAvatar({ uri: addressBookAvatar })
    }
  }, [addressBookAvatar])

  return (
    addressBookAvatar ? (
      <View style={{ position: 'relative' }}>
        <ImageRender
          resizeMode='contain'
          uriDefault={images.UIV2.icons.unknowChain}
          uri={chainIcon}
          style={{ width: 19, height: 19 }}
          containerStyle={[styles.chainIcon, { overflow: 'visible' }]}
        />
        <View style={[styles.avatarBox, { position: 'relative' }]}>
          {
            isSvgData ? (
              <SvgXml xml={base64DataSvg} width={31} height={31} />
            ) : (
              <Image
                source={addressBookAvatarImageSource || images.avatarAddressBook}
                style={[styles.avatarIconWithAddressBook]}
                onError={(e) => setAddressBookAvatar(images.avatarAddressBook)}
              />
            )
          }
        </View>
      </View>
    ) : (
      <ImageRender
        resizeMode='contain'
        uriDefault={images.UIV2.icons.unknowChain}
        uri={chainIcon}
        style={styles.chainIconWithoutAddressBook}
      />
    )
  )
}

export default AddressBookAvatarWithChain

const styles = StyleSheet.create({
  avatarBox: {
    borderRadius: 5,
    backgroundColor: 'transparent',
    overflow: 'hidden'
  },
  avatarIconWithAddressBook: {
    width: 31,
    height: 31,
    resizeMode: 'contain'
  },
  chainIconWithoutAddressBook: {
    width: 31,
    height: 31,
    resizeMode: 'contain',
    borderRadius: 31 / 2
  },
  chainIcon: {
    width: 19,
    height: 19,
    position: 'absolute',
    bottom: -19 / 2,
    right: -19 / 2,
    zIndex: 999
  }
})
