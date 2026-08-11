import { TouchableOpacity, View, StyleSheet } from 'react-native'
import React from 'react'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import MyIcon from '../MyIcon'
import { pixelByWidth } from 'common/styles'
import { convertAddressArrToString } from 'common/function'
import { ACCOUNT_TYPE } from 'common/constants/account'
import MyTextTicker from '../MyTextTicker'
import { useSelector } from 'react-redux'
import { zeroAddress } from 'viem'
import useIsContractAddress from 'frontend/Hooks/useIsContractAddress'

// Pass `showAlert` (the screen's BaseContainer.showAlert) to make the header
// tappable: tapping copies the address and shows the standard "copied" toast.
// Without it the header stays a plain, non-interactive label (other screens).
//
// `showContractBadge` opts a screen in to the contract-address detection. The "CA"
// (Contract Address) badge is then shown only for VIEW-ONLY accounts whose address
// has bytecode on an active EVM chain — a watch-only contract address. Off by default
// so other headers don't pay for the RPC call.
//
// `alwaysCheckContract` drops the view-only half of that test, for screens whose
// address is not an account in this wallet at all: Liquidity Management renders a
// registered LP address, which can be registered from outside the app and lives in
// `addressRegisteredLiquidity`, never in `accountListRedux`. The account lookup can
// only ever answer "no" for it, so without this the badge could never show — not
// even for an LP address that really is a contract.
const InfoAccountHeader = ({ infoAccount, showAlert, showContractBadge = true, alwaysCheckContract = false }) => {
  const { activeAccount } = useSelector(state => state)
  const accountList = useSelector(state => state.accountListRedux)
  const { account } = activeAccount
  const address = infoAccount?.address || account?.address || zeroAddress

  // Only view-only accounts get the contract check — a watch-only address is the only
  // case where the user might be tracking a contract rather than a wallet.
  //
  // Looked up by the ADDRESS BEING SHOWN rather than read off the active account:
  // a header can render an address that is not the active one, and asking the
  // active account there answers the question for the wrong address — registering
  // any view-only contract elsewhere would flip the badge on for it.
  const shownAccount = (accountList || []).find(
    (a) => String(a?.address || '').toLowerCase() === String(address).toLowerCase()
  ) || (
    // The active account is persisted separately, so it can briefly be missing
    // from the list; fall back to it rather than dropping the badge mid-update.
    String(account?.address || '').toLowerCase() === String(address).toLowerCase()
      ? account
      : null
  )
  const isViewOnly = shownAccount?.accountType === ACCOUNT_TYPE.VIEW_ONLY

  // react-query keeps the result in-memory across remounts (no AsyncStorage).
  const isContract = useIsContractAddress(address, {
    enabled: showContractBadge && (alwaysCheckContract || isViewOnly)
  })

  /**
   * Temporarily disable based on https://trello.com/c/R99xiYHp
   */
  const handleCopy = () => {
    if (!address) return
    Clipboard.setString(address)
    showAlert && showAlert(I18n.t('Initial.copyDone', { value: I18n.t('Initial.address') }), '', { type: 'toast' })
  }

  const Container = showAlert ? TouchableOpacity : View

  return (
    <Container
      activeOpacity={0.7}
      onPress={showAlert ? handleCopy : undefined}
      style={{ paddingHorizontal: pixelByWidth(12), width: '100%' }}
      className='flex flex-col items-start justify-center'
    >
      <MyTextTicker fontWeight={700} variant='subTitle'>{infoAccount?.name || account?.name || `Account ${(account?.indexAccount || 0) + 1}`}</MyTextTicker>
      <View style={styles.addressRow}>
        <MyTextTicker className='text-medium'>{convertAddressArrToString([address])}</MyTextTicker>
        {isContract && (
          <MyIcon uri={images.UIV2.icons.icon_CA} variant='small' />
        )}
      </View>
    </Container>
  )
}

const styles = StyleSheet.create({
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(6)
  }
})

export default InfoAccountHeader
