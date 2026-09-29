import React, { useMemo, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
// ScrollView from react-native-gesture-handler so the list cooperates with the
// drawer's pan gesture — plain RN ScrollView won't scroll inside a drawer on Android.
import { ScrollView } from 'react-native-gesture-handler'
import { useSelector } from 'react-redux'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { getSizeImgSquare, PADDING_TOP_CONTAINER_DRAWER } from 'common/styles'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { convertAddressArrToString, lowerCase } from 'common/function'
import { switchAccountV2 } from 'common/chain'
import ReduxService from 'common/redux'
import styles from './styles'

/**
 * Accounts a session can be moved TO: EVM (v2) hot/cold accounts other than the
 * one it is already connected with. Exported so the caller can hide its entry
 * point when there is nothing to switch to.
 *
 * @param {Array}  accountListRedux
 * @param {string} currentAddress address the session is connected with
 * @returns {Array} accounts, current one excluded
 */
export const getSwitchableAccounts = (accountListRedux, currentAddress) => {
  return (accountListRedux || []).filter(
    (a) => a?.chain === 'evm' && a?.address &&
      (a?.accountType === ACCOUNT_TYPE.HOT || a?.accountType === ACCOUNT_TYPE.COLD) &&
      lowerCase(a.address) !== lowerCase(currentAddress)
  )
}

/**
 * "Change account" drawer — stacked on top of WalletConnectRequestsModal.
 *
 * A V2 session is bound to ONE account, so picking a row REPLACES the connected
 * account (the old one is dropped) via switchAccountV2, then makes it the app's
 * active account so the dApp stays visible in the WalletConnect list (which is
 * filtered by the current account) — same hand-off the deep-link connect does.
 *
 * Row style is reused from WalletConnectConnectModal's account picker. The
 * connected account is NOT listed (there is nothing to confirm for it), so the
 * drawer opens with no selection and Confirm only appears once a row is picked.
 *
 * @param {string}   topic          WC session topic of the dApp
 * @param {string}   currentAddress address the session is connected with
 * @param {Function} [onClose]      pops this drawer
 * @param {Function} [onError]      surfaced when the session update fails
 */
const ChangeAccountDrawer = ({ topic, currentAddress, onClose, onError }) => {
  const accountListRedux = useSelector((s) => s.accountListRedux)
  const walletConnectRedux = useSelector((s) => s.walletConnectRedux)
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [isSwitching, setIsSwitching] = useState(false)

  // Everything except the account already connected — switching to it is a no-op.
  const switchableAccounts = useMemo(
    () => getSwitchableAccounts(accountListRedux, currentAddress),
    [accountListRedux, currentAddress]
  )

  const handleConfirm = () => {
    if (!selectedAccount || isSwitching) return

    // Resolved on confirm, not on open: another session disconnecting meanwhile
    // shifts every index in walletConnectRedux.
    const walletConnectIndex = (walletConnectRedux || []).findIndex(
      (item) => lowerCase(item?.session?.topic) === lowerCase(topic)
    )
    if (walletConnectIndex === -1) {
      onError && onError(new Error('ChangeAccountDrawer: session not found'))
      return
    }

    setIsSwitching(true)

    switchAccountV2(
      walletConnectIndex,
      selectedAccount,
      () => {
        // Follow the session to its new owner, otherwise the dApp would vanish
        // from the list (filtered by the active account) right after the switch.
        ReduxService.setActiveAccount(selectedAccount)
        setIsSwitching(false)
        onClose && onClose()
      },
      (error) => {
        setIsSwitching(false)
        onError && onError(error)
      }
    )
  }

  return (
    // Same shell as WalletConnectRequestsModal (the drawer this stacks on): a
    // plain View + the 16px spacer, so the absolute title sits at the very top and
    // the title-to-first-row gap matches the parent sheet exactly.
    <View style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('v2.walletConnect.selectAccount')}
        leftIcon={(
          <MyButton
            noMinWidth
            isCircleBtn
            size='small'
            onPress={onClose}
          >
            <MyIcon variant='title' uri={images.UIV2.icons.arrowLeftWhite} />
          </MyButton>
        )}
        rightElement={selectedAccount
          ? (
            <MyButton
              size='small'
              variant='primary'
              label={I18n.t('Initial.confirm')}
              isLoading={isSwitching}
              onPress={handleConfirm}
            />
          )
          : null}
      />
      <View style={{ height: PADDING_TOP_CONTAINER_DRAWER }} />

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {switchableAccounts.map((acc) => {
          const isSelected = lowerCase(selectedAccount?.address) === lowerCase(acc.address)

          return (
            <TouchableOpacity
              key={acc.address}
              activeOpacity={1}
              style={[styles.accountRow, isSelected ? styles.accountSelected : styles.accountUnselected]}
              onPress={() => setSelectedAccount(acc)}
            >
              <AvatarAccount account={acc} noShowAccountType size={getSizeImgSquare('large')} />
              <View style={styles.accountInfo}>
                <MyText fontWeight={700} numberOfLines={1}>
                  {acc.name || `Account ${(acc.indexAccount || 0) + 1}`}
                </MyText>
                <MyText className='text-medium'>{convertAddressArrToString([acc.address])}</MyText>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

export default ChangeAccountDrawer
