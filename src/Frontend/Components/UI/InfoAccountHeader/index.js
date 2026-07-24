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
const InfoAccountHeader = ({ infoAccount, showAlert, showContractBadge = true }) => {
  const { activeAccount } = useSelector(state => state)
  const { account } = activeAccount
  const address = infoAccount?.address || account?.address || zeroAddress

  // Only view-only accounts get the contract check — a watch-only address is the only
  // case where the user might be tracking a contract rather than a wallet.
  const isViewOnly = account?.accountType === ACCOUNT_TYPE.VIEW_ONLY

  // react-query keeps the result in-memory across remounts (no AsyncStorage).
  const isContract = useIsContractAddress(address, { enabled: showContractBadge && isViewOnly })

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
