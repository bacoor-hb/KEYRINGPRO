import { ALCHEMY_ENDPOINT } from 'common/constants/alchemy'
import { SUPPORTED_CHAINS_BY_SERVICE_MORALIS } from 'common/constants/chain'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { lowerCase } from 'common/function'
import { Colors } from 'common/styles'
import { isAddress } from 'ethers/lib/utils'
import AlchemyApi from 'frontend/Services/alchemy'
import { useQuery } from 'react-query'
import I18n from 'assets/Lang'
import MoralisService from 'src/Services/Moralis'

// The four buckets a Moralis history entry splits its movements into. All of them
// count: sending an NFT to an address makes it a known recipient just as much as
// sending ETH does.
const MORALIS_TRANSFER_FIELDS = ['native_transfers', 'erc20_transfers', 'nft_transfers', 'internal_transactions']

// -> Sources -----------------------------------------------------------------
// Both answer the same question — how many times has `address` sent to
// `addressTo` on this chain — and both THROW when they cannot answer, so an
// outage is never mistaken for "never sent".

// One request, and its latency does not grow with the wallet's history: Alchemy
// ANDs fromAddress and toAddress server-side.
const countSentViaAlchemy = (chainId, address, addressTo) =>
  AlchemyApi.countTransfersBetween(chainId, address, addressTo)

// No counterparty filter on this API, so the recent history has to be pulled and
// filtered here. Kept for the chains Alchemy has no node for.
const countSentViaMoralis = async (chainId, address, addressTo) => {
  const history = await MoralisService.getFullTxHistoryOfWalletByChain(address, SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId])

  return history.filter((tx) => MORALIS_TRANSFER_FIELDS.some(
    (field) => (tx?.[field] || []).some(
      (item) => lowerCase(item.from_address) === address && lowerCase(item.to_address) === addressTo
    )
  )).length
}

// Ordered like balanceSourcesFor in Services/TokenListV2: the source that can
// answer cheapest goes first, and one that throws hands over to the next.
export const sentHistorySourcesFor = (chainId) => {
  const sources = []
  if (ALCHEMY_ENDPOINT[chainId]) sources.push(countSentViaAlchemy)
  if (SUPPORTED_CHAINS_BY_SERVICE_MORALIS[chainId]) sources.push(countSentViaMoralis)
  return sources
}

// Resolves to how many times `address` has sent to `addressTo`, or null when no
// source covers this chain. Rejects when every source failed. The hook reads both
// of those as "unknown" and shows nothing — falling through to the "first time"
// warning, as this used to, was simply wrong on every chain Moralis does not serve.
export const getSentCount = async ({ queryKey }) => {
  const [, address, addressTo, chainId] = queryKey

  const sources = sentHistorySourcesFor(chainId)
  if (!sources.length) {
    return null
  }

  let lastError
  for (const countSentFrom of sources) {
    try {
      return await countSentFrom(chainId, address, addressTo)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
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

  // `addressTo` is part of the key because Alchemy filters on the pair server-side,
  // so the answer is only valid for this exact recipient. Note this fires WITHOUT
  // waiting on the caller's isContract lookup: the two run in parallel and the
  // contract verdict only suppresses the banner below.
  const { data: sentCount, isLoading, refetch } = useQuery(
    [REACT_QUERY_KEY.getRecipientSentHistory, address, addressTo, chain],
    getSentCount,
    {
      enabled: isAddress(address) && isAddress(addressTo) && !!chain && !isAddressErr,
      // "A has sent to B" only ever flips false -> true, so an answer never goes
      // stale within a session. This replaces a 15s refetch loop that re-pulled the
      // wallet's ENTIRE Moralis history on a timer.
      staleTime: Infinity,
      cacheTime: 1000 * 60 * 60,
      // The sources already fall back to each other; retrying on top of that only
      // keeps the banner spinning on a chain nobody can answer for.
      retry: false
    }
  )

  let statusAddressTo = typeStatusAddressTo.normal
  let textStatusAddressTo = ''
  if (isAddressErr) {
    statusAddressTo = typeStatusAddressTo.error
    textStatusAddressTo = errMessage
  } else if (!isContractAddressTo && isAddress(addressTo) && typeof sentCount === 'number') {
    // Anything other than a number — still loading, no source for this chain, or
    // every source failed — leaves the status at `normal`, i.e. nothing shown.
    if (sentCount > 1) {
      statusAddressTo = typeStatusAddressTo.availableMoreThanOne
      textStatusAddressTo = I18n.t('Content.youHaveSentMoreThanOnceToThisAddress')
    } else if (sentCount === 1) {
      statusAddressTo = typeStatusAddressTo.available
      textStatusAddressTo = I18n.t('Content.thisAddressHasBeenUsedBefore')
    } else {
      statusAddressTo = typeStatusAddressTo.warning
      textStatusAddressTo = I18n.t('Content.thisAddressIsBeingUsedForTheFirstTime')
    }
  }

  return {
    typeColorTextStatusAddressTo,
    typeColorStatusAddressTo,
    textStatusAddressTo,
    typeStatusAddressTo,
    statusAddressTo,
    isLoading,
    data: typeof sentCount === 'number' ? sentCount : null,
    refetch
  }
}

export default useGetTokensLatestTransactions
