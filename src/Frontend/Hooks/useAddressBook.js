import { isAddress } from 'ethers/lib/utils'
import { useState } from 'react'
import AddressBookService from 'common/addressBook'
import { isObject } from 'common/function'

const useAddressBook = () => {
  const [isLoading, setIsLoading] = useState(false)
  const resolveByAddressAsync = async (address) => {
    try {
      if (!isAddress(address)) {
        return null
      }
      setIsLoading(true)
      const resolveInfo = await AddressBookService.resolveByAddress(address)
      return resolveInfo
    } catch (error) {
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const resolveByAliasAsync = async (text) => {
    try {
      if (!text) {
        return null
      }
      setIsLoading(true)
      const [resolveInfoByEmail, resolveInfoByNickname] = await Promise.all([
        AddressBookService.resolveByEmail(text),
        AddressBookService.resolveByNickname(text)
      ])

      return (isObject(resolveInfoByEmail?.info, true) && resolveInfoByEmail) || (isObject(resolveInfoByNickname?.info, true) && resolveInfoByNickname) || null
    } catch (error) {
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return {
    isLoading,
    resolveByAddressAsync,
    resolveByAliasAsync
  }
}

export default useAddressBook
