import AddressBook from '@address-book/sdk'
import settings from 'controller/settings'
import ReduxService from './redux'
import { isAddress } from 'ethers/lib/utils'
import { array2Object, lowerCase } from './function'
import { ACCOUNT_TYPE } from './constants/account'
import StorageReduxAction from 'controller/Redux/actions/storageAction'

class AddressBookService {
  static addressBookClient = new AddressBook({
    rpcUrl: settings().rpcUrlByChainId[10] // optimism
  })

  static async resolveByAddress (address) {
    try {
      const addressBookInfo = await this.addressBookClient.resolveByAddress(address)
      return addressBookInfo
    } catch (error) {
      return null
    }
  }

  static async resolveByEmail (text) {
    try {
      const addressBookInfo = await this.addressBookClient.resolveByEmail(text)
      return addressBookInfo
    } catch (error) {
      return null
    }
  }

  static async resolveByNickname (text) {
    try {
      const addressBookInfo = await this.addressBookClient.resolveByNickname(text)
      return addressBookInfo
    } catch (error) {
      return null
    }
  }

  static async resolveEmailToAliasForListAccount () {
    const accountList = ReduxService.getReduxDataByKey('accountListRedux', [])
    const addressBookInfoCurrent = ReduxService.getReduxDataByKey('addressBookInfo', [])

    const listAddressNeedResolve = []
    // Find which address need to resolve
    accountList.forEach((account) => {
      // View-only accounts must never be resolved by address book — they keep
      // their user-set name and a plain blockie avatar (no registered alias/avatar).
      if (account?.accountType === ACCOUNT_TYPE.VIEW_ONLY) {
        return
      }
      if (isAddress(account?.address)) {
        listAddressNeedResolve.push(account.address)
      }
    })

    // [{info}, {info}, ...]
    const addressBookResolvedInfoArr = await Promise.all([...new Set(listAddressNeedResolve)].map(async (address) => {
      const addressBookInfo = await this.resolveByAddress(address)
      return {
        address: lowerCase(address),
        info: addressBookInfo?.info
      }
    }))

    // { 0x1: info, 0x2: info, ... }
    const addressBookResolvedInfoObj = array2Object(addressBookResolvedInfoArr, 'address')

    let isNeedUpdateNewAccountListInfo = false
    const accountListResolved = accountList.map((account) => {
      // View-only accounts are excluded from address-book resolution — leave untouched.
      if (account?.accountType === ACCOUNT_TYPE.VIEW_ONLY) {
        return account
      }
      // Case already resolved before, need to keep current account name
      if (account?.isResolvedByAddressBook && account?.addressBookAlias) {
        return account
      }

      const resolvedInfo = addressBookResolvedInfoObj[lowerCase(account?.address)]?.info
      const addressBookAlias = resolvedInfo?.nickname || resolvedInfo?.email
      const accountNameResolved = addressBookAlias || account.name
      isNeedUpdateNewAccountListInfo = true
      return {
        ...account,
        isResolvedByAddressBook: !!resolvedInfo,
        addressBookAlias: addressBookAlias,
        name: accountNameResolved
      }
    })

    ReduxService.callDispatchAction(StorageReduxAction.setAddressBookInfo({
      ...addressBookInfoCurrent,
      ...addressBookResolvedInfoObj
    }))

    if (isNeedUpdateNewAccountListInfo) {
      ReduxService.callDispatchAction(StorageReduxAction.setAccountList(accountListResolved))
    }
  }

  catch (_error) {
    // error
  }
}

export default AddressBookService
