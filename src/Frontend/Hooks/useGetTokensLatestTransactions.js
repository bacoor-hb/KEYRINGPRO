import { SUPPORTED_CHAINS_BY_SERVICE_MORALIS } from 'common/constants/chain'
import { Colors } from 'common/styles'
import { isAddress } from 'ethers/lib/utils'
import { isEmpty } from 'lodash'
import { useQuery } from 'react-query'
import I18n from 'assets/Lang'
import MoralisService from 'src/Services/Moralis'
import { lowerCase } from 'common/function'

const getFullTxHistory = async ({ queryKey }) => {
  const address = queryKey[1]
  const chain = queryKey[2]

  try {
    const listFullTxHistoryOfWalletByChain = await MoralisService.getFullTxHistoryOfWalletByChain(address, SUPPORTED_CHAINS_BY_SERVICE_MORALIS?.[chain])
    return listFullTxHistoryOfWalletByChain || []
  } catch (error) {
    return []
  }
}
const typeStatusAddressTo = {
  normal: 'normal',
  available: 'available',
  warning: 'warning',
  error: 'error',
  availableMoreThanOne: 'availableMoreThanOne'

}
const typeColorStatusAddressTo = {
  [typeStatusAddressTo.normal]: 'transparent',
  [typeStatusAddressTo.available]: 'rgba(0, 195, 152, 0.1)',
  [typeStatusAddressTo.warning]: 'rgba(242, 201, 76, 0.1)',
  [typeStatusAddressTo.error]: 'rgba(235, 87, 87, 0.1)',
  [typeStatusAddressTo.availableMoreThanOne]: 'rgba(0, 195, 152, 0.1)'

}
const typeColorTextStatusAddressTo = {
  [`${typeStatusAddressTo.normal}_Darkmode`]: 'transparent',
  [`${typeStatusAddressTo.normal}_Lightmode`]: 'transparent',
  [`${typeStatusAddressTo.available}_Darkmode`]: 'white',
  [`${typeStatusAddressTo.available}_Lightmode`]: 'black',
  [`${typeStatusAddressTo.warning}_Darkmode`]: Colors.YELLOW,
  [`${typeStatusAddressTo.warning}_Lightmode`]: Colors.YELLOW,
  [`${typeStatusAddressTo.error}_Darkmode`]: Colors.RED,
  [`${typeStatusAddressTo.error}_Lightmode`]: Colors.RED,
  [`${typeStatusAddressTo.availableMoreThanOne}_Darkmode`]: 'white',
  [`${typeStatusAddressTo.availableMoreThanOne}_Lightmode`]: 'black'

}

const useGetTokensLatestTransactions = (address, addressTo, isAddressErr, errMessage, chain, isContractAddressTo) => {
  address = address?.toLowerCase()
  addressTo = addressTo?.toLowerCase()
  const { data, isLoading, refetch } = useQuery(
    ['getFullTxHistory', address, chain],
    getFullTxHistory,
    {
      enabled: isAddress(address) && !!chain,
      refetchInterval: 15000
    }
  )

  let statusAddressTo = typeStatusAddressTo.normal
  let textStatusAddressTo = ''
  if (isAddressErr) {
    statusAddressTo = typeStatusAddressTo.error
    textStatusAddressTo = errMessage
  } else {
    if (!!isContractAddressTo === false && isAddress(addressTo) && !isEmpty(data)) {
      const listHistoryBetweenAddressFromAndTo = data.filter(history => {
        const findNativeTransfers = history?.native_transfers?.find(item => (lowerCase(item.from_address) === address && lowerCase(item.to_address) === addressTo))
        const findTokenTransfers = history?.erc20_transfers?.find(item => (lowerCase(item.from_address) === address && lowerCase(item.to_address) === addressTo))
        const findNftTransfers = history?.nft_transfers?.find(item => (lowerCase(item.from_address) === address && lowerCase(item.to_address) === addressTo))
        const findInternalTransfers = history?.internal_transactions?.find(item => (lowerCase(item.from_address) === address && lowerCase(item.to_address) === addressTo))
        return findNativeTransfers || findTokenTransfers || findNftTransfers || findInternalTransfers
      })

      if (listHistoryBetweenAddressFromAndTo?.length > 1) {
        statusAddressTo = typeStatusAddressTo.availableMoreThanOne
        textStatusAddressTo = I18n.t('Content.youHaveSentMoreThanOnceToThisAddress')
      } else if (listHistoryBetweenAddressFromAndTo?.length === 1) {
        statusAddressTo = typeStatusAddressTo.available
        textStatusAddressTo = I18n.t('Content.thisAddressHasBeenUsedBefore')
      } else {
        statusAddressTo = typeStatusAddressTo.warning
        textStatusAddressTo = I18n.t('Content.thisAddressIsBeingUsedForTheFirstTime')
      }
    }
  }
  return {
    typeColorTextStatusAddressTo,
    typeColorStatusAddressTo,
    textStatusAddressTo,
    typeStatusAddressTo,
    statusAddressTo,
    isLoading,
    data: data || null,
    refetch
  }
}

export default useGetTokensLatestTransactions
