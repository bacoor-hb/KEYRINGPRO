import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSelector } from 'react-redux'

import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import BtnBack from 'frontend/Components/UI/BtnBack'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'
import AddressBookAvatar from 'frontend/Components/Common/AddressBook/Avatar'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { getSizeImgSquare, pixelByHeight, pixelByWidth, width } from 'common/styles'
import { convertAddressArrToString, handleOpenUrl, isArrayWithData } from 'common/function'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import LottieView from 'lottie-react-native'

const styles = createStyles()

const ADDRESS_BOOK_HELP_URL = 'https://abnft-help.keyring.app'

// One flat row (avatar + name + optional subtitle + optional right action), mirroring
// the WalletConnect account list. `rightElement`'s own touchable handles its press so
// it doesn't trigger the row's onPress.
const Row = ({ avatar, name, titleClassName, titleFontSize, titleFontWeight = 700, subtitle, isLast, onPress, rightElement, dividerStyle, wrapStyle }) => (
  <TouchableOpacity activeOpacity={0.7} style={[styles.row, wrapStyle]} onPress={onPress}>
    {avatar}
    <View style={styles.rowInfo}>
      <MyText fontWeight={titleFontWeight} className={titleClassName} fontSize={titleFontSize} numberOfLines={1}>{name}</MyText>
      {!!subtitle && <MyText className='text-medium' numberOfLines={1}>{subtitle}</MyText>}
    </View>
    {rightElement}
    {!isLast && <View style={dividerStyle || styles.rowDivider} />}
  </TouchableOpacity>
)

// Address-book management drawer, stacked on top of the Send drawer. Two sections:
//  - My account: the wallet's own accounts (tap to send to yourself).
//  - Address book NFT: previously used entries (tap to fill, trash to remove).
// The form lives in SendToken, so selecting a row calls the handlers it passes in.
const AddressBookManager = ({ _this, onSelectAccount, onSelectEntry }) => {
  const { accountListRedux, addressBookHistory } = useSelector((s) => s)

  // V2 is EVM-only: only list accounts on the EVM chain (with a valid address).
  const accounts = (accountListRedux || []).filter((a) => a?.chain === 'evm' && a?.address)

  // Addresses already owned by this wallet, lowercased for case-insensitive match.
  const myAddressSet = new Set(
    (accountListRedux || []).map((a) => a?.address?.toLowerCase()).filter(Boolean)
  )
  // Sent-history entries, excluding any that point to one of the wallet's own
  // accounts (those are already shown under "My account").
  const entries = (addressBookHistory || []).filter(
    (e) => !myAddressSet.has(e?.info?.address?.toLowerCase())
  )

  // Remove by entry reference against the full history (not the filtered index),
  // so hidden own-account entries are preserved in storage.
  const handleDelete = (entry) => {
    const next = (addressBookHistory || []).filter((e) => e !== entry)
    ReduxService.callDispatchAction(StorageReduxAction.setAddressBookHistory(next))
  }

  const renderHelpLink = (extraStyle) => (
    <TouchableOpacity activeOpacity={0.8} style={[styles.linkRow, extraStyle]} onPress={() => handleOpenUrl(ADDRESS_BOOK_HELP_URL)}>
      <MyText className='text-brand'>{I18n.t('addressBook.whatIsAddressBook')}</MyText>
    </TouchableOpacity>
  )

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('Content.addrBook')}
        leftIcon={<BtnBack onPress={_this.closeDrawer} />} />

      {/* Outer scroll = whole page (NFT list + footer). My account has its own
          bounded inner scroll so it never pushes the rest off-screen. */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageContent}>
        {/* My account — inner scroll (max ~3 rows). */}
        {isArrayWithData(accounts) && (
          <>
            <MyText variant='subTitle' fontWeight={700} style={styles.sectionTitle}>{I18n.t('v2.addressBook.myAccount')}</MyText>
            <ScrollView style={styles.myAccountScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {accounts.map((account, index) => (
                <Row
                  wrapStyle={{ height: pixelByHeight(72) }}
                  key={`${account?.address || 'no-data'}-${index}`}
                  avatar={<AvatarAccount account={account} noShowAccountType size={getSizeImgSquare('large')} />}
                  name={account?.name || I18n.t('v2.addressBook.account', { value: (account?.indexAccount || 0) + 1 })}
                  titleClassName='text-white'
                  titleFontSize={18}
                  subtitle={convertAddressArrToString([account?.address])}
                  onPress={() => onSelectAccount(account?.address)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Address book NFT — flows in the outer page scroll. */}
        <MyText variant='subTitle' fontWeight={700} style={[styles.sectionTitle, styles.sectionTitleSpaced]}>{I18n.t('v2.addressBook.addressBookNft')}</MyText>
        {isArrayWithData(entries)
          ? (
            <>
              {entries.map((entry, index) => (
                <Row
                  wrapStyle={{ height: pixelByHeight(52) }}
                  key={`${entry?.info?.address || ''}_${index}`}
                  avatar={(
                    <View style={styles.abAvatarWrap}>
                      <AddressBookAvatar
                        base64Data={entry?.info?.avatar}
                        customAvatar={entry?.info?.customAvatar}
                        style={styles.abAvatar}
                        avatarStyle={styles.abAvatarImg}
                      />
                    </View>
                  )}
                  name={entry?.info?.nickname || entry?.info?.email || ''}
                  titleFontWeight={400}
                  titleFontSize={15}
                  titleClassName='text-medium'
                  dividerStyle={styles.rowDividerNft}
                  onPress={() => onSelectEntry(entry)}
                  rightElement={(
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => handleDelete(entry)}
                    >
                      <MyIcon variant='small' uri={images.UIV2.icons.delete} resizeMode='contain' />
                    </TouchableOpacity>
                  )}
                />
              ))}
              {renderHelpLink()}
            </>
          )
          : (
            <View style={styles.emptyWrap}>
              <MyText className='text-medium' style={styles.emptyDesc}>
                {I18n.t('v2.addressBook.emptyDesc')}
              </MyText>
              {renderHelpLink(styles.emptyLink)}
              <LottieView
                style={{
                  width: width(100) - pixelByWidth(64),
                  aspectRatio: 1
                }}
                resizeMode='contain'
                source={images.addressBookNFTEmptyList}
                autoPlay
                loop />
            </View>
          )}
      </ScrollView>
    </MyViewPage>
  )
}

export default AddressBookManager
