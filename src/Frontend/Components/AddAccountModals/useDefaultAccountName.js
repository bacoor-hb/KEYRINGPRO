import { useSelector } from 'react-redux'
import AddressBookService from 'common/addressBook'
import { ACCOUNT_TYPE } from 'common/constants/account'
import I18n from 'assets/Lang'

// Default name shown in the account-name input of the create/import modals.
// Auto-numbered as `Account N` where N = current account count + 1, so the
// suggestion stays meaningful when the user already has accounts.
const useDefaultAccountName = () => {
  const count = useSelector((s) => (s.accountListRedux || []).length)
  return I18n.t('v2.addAccount.normalAccount', { count: count + 1 })
}

// Default name for the register (view-only) modal. Numbered by the count of
// existing view-only accounts + 1 → first one is `View-only account 1`.
export const useDefaultViewOnlyName = () => {
  const count = useSelector((s) =>
    (s.accountListRedux || []).filter((a) => a?.accountType === ACCOUNT_TYPE.VIEW_ONLY).length
  )
  return I18n.t('v2.addAccount.viewOnlyAccount', { count: count + 1 })
}

// Max time we'll wait for the on-chain address-book lookup before giving up.
// Importing a private key is a fully offline operation; the alias is only a
// nice-to-have suggestion, so we must never let a hung/slow RPC (e.g. no
// network) block the import. resolveByAddress hits an Optimism RPC which can
// hang indefinitely when offline — its try/catch only handles rejections, not
// a stalled connection — so we race it against a timeout here.
const ADDRESS_BOOK_TIMEOUT_MS = 1500

// Resolve an address against the on-chain address book (via @address-book/sdk
// the app already uses in `resolveEmailToAliasForListAccount`). Cannot read
// from redux here because freshly-imported addresses have never been resolved
// yet — they're brand new to this device.
// Returns the alias name (nickname → email fallback), or null on miss/error/timeout.
export const fetchAddressBookName = async (address) => {
  if (!address) return null
  try {
    const ret = await Promise.race([
      AddressBookService.resolveByAddress(address),
      new Promise((resolve) => setTimeout(() => resolve(null), ADDRESS_BOOK_TIMEOUT_MS))
    ])
    return ret?.info?.nickname || ret?.info?.email || null
  } catch (e) {
    return null
  }
}

export default useDefaultAccountName
