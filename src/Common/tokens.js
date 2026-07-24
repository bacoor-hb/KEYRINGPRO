import { lowerCase } from './function'
import { zeroAddress } from 'viem'
import { NATIVE_TOKEN_BY_CHAIN_ID, NULL_ADDRESS_OTHER } from './constants/app'

export const isNativeToken = (address, chainId = null) => {
  if (
    !address ||
    address === 'native' ||
    address === zeroAddress ||
    lowerCase(address) === NULL_ADDRESS_OTHER
  ) {
    return true
  }

  if (
    chainId &&
    NATIVE_TOKEN_BY_CHAIN_ID[chainId] &&
    NATIVE_TOKEN_BY_CHAIN_ID[chainId] === lowerCase(address)
  ) {
    return true
  }

  return false
}

// Resolve native token addr by chainId; fallback zeroAddress for native, else input addr
export const getAddressNative = (chainId, address = null) => {
  if (NATIVE_TOKEN_BY_CHAIN_ID[chainId]) {
    return NATIVE_TOKEN_BY_CHAIN_ID[chainId]
  }
  if (isNativeToken(address)) {
    return zeroAddress
  }
  return address
}

export const getAddressByEip681 = (url) => {
  try {
    // Split at "?" to separate base URL from query string (if any)
    const [, queryString] = url.split('?')

    if (queryString) {
      const params = new URLSearchParams(queryString)

      // Extract address from query string (if present)
      const queryAddress = params.get('address')
      const queryFrom = params.get('from')

      return queryAddress || queryFrom || url.slice(0, 42)
    }
    return url.slice(0, 42)
  } catch (error) {
    return url
  }
}
