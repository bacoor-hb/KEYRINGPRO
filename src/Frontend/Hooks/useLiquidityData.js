import { useSelector } from 'react-redux'
import { isAddress } from 'ethers/lib/utils'
import storeRedux from 'controller/Redux/store/configureStore'
import StorageReduxAction from 'controller/Redux/actions/storageAction'

// Last known liquidity data, held in Redux and persisted to AsyncStorage by the action.
//
// Why Redux rather than reading storage inside the screen: the store is rehydrated in
// App.hydrateReduxFromStorage() BEFORE the first screen renders (the app is still on the
// splash). So by the time the Liquidity screen mounts, the previous data is already in
// state — it paints immediately, then updates in place when the network responds. Reading
// AsyncStorage from within the screen cannot do that: the read resolves after the first
// render, forcing a "nothing yet" -> "cached data" transition, which is the flicker.
//
// Everything lives under the registered address:
//
//   {
//     [address]: {
//       pools, tokensDetail, coinPool,        // the list screen
//       positions: {
//         [positionKey]: { history, positionInfo, nftName }   // the detail screen
//       }
//     }
//   }
//
// Nesting positions under the account (rather than keying them separately) means one
// address owns one subtree: clearing an account removes its positions with it, so nothing
// can outlive the registration it belongs to or leak into the next one.

// Addresses are lowercased and sorted so the same account always resolves to the same
// entry regardless of checksum casing or ordering.
export const buildAddressKey = (addresses = []) => {
  const normalized = (addresses || [])
    .filter((item) => isAddress(item))
    .map((item) => item.toLowerCase())
    .sort()
  return normalized.length > 0 ? normalized.join('_') : ''
}

// A position's key within its account's subtree. chainId + tokenId identifies the
// position NFT uniquely, and deliberately does NOT include poolId: not every caller has
// it, and all three detail hooks must land on the same entry for one position.
export const buildPositionKey = (chainId, tokenId) => (
  chainId != null && tokenId != null ? `${chainId}_${tokenId}` : ''
)

const getRoot = () => storeRedux.getState()?.liquidityDataRedux || {}

// Read one account-level slice ('pools' | 'tokensDetail' | 'coinPool').
export const useLiquidityData = (addresses, slice) => {
  const addressKey = buildAddressKey(addresses)
  return useSelector((state) => (addressKey ? state.liquidityDataRedux?.[addressKey]?.[slice] : undefined))
}

// Write one account-level slice. Merges so the slices don't overwrite each other, and
// leaves every other account untouched.
export const writeLiquidityData = (addresses, slice, value) => {
  const addressKey = buildAddressKey(addresses)
  if (!addressKey || value == null) return
  const current = getRoot()
  storeRedux.dispatch(StorageReduxAction.setLiquidityData({
    ...current,
    [addressKey]: { ...(current[addressKey] || {}), [slice]: value }
  }))
}

// Read one slice ('history' | 'positionInfo' | 'nftName') of one position.
export const useLiquidityPositionData = (addresses, positionKey, slice) => {
  const addressKey = buildAddressKey(addresses)
  return useSelector((state) => (
    addressKey && positionKey
      ? state.liquidityDataRedux?.[addressKey]?.positions?.[positionKey]?.[slice]
      : undefined
  ))
}

// Write one slice of one position, merging at every level so sibling positions and the
// account's own slices are preserved.
export const writeLiquidityPositionData = (addresses, positionKey, slice, value) => {
  const addressKey = buildAddressKey(addresses)
  if (!addressKey || !positionKey || value == null) return
  const current = getRoot()
  const account = current[addressKey] || {}
  const positions = account.positions || {}
  storeRedux.dispatch(StorageReduxAction.setLiquidityData({
    ...current,
    [addressKey]: {
      ...account,
      positions: {
        ...positions,
        [positionKey]: { ...(positions[positionKey] || {}), [slice]: value }
      }
    }
  }))
}

// Drop everything saved for an address when its registration is replaced — its positions
// included, since they live inside the same entry.
export const clearLiquidityData = (addresses) => {
  const addressKey = buildAddressKey(addresses)
  const current = getRoot()
  if (!addressKey || current[addressKey] == null) return
  const next = { ...current }
  delete next[addressKey]
  storeRedux.dispatch(StorageReduxAction.setLiquidityData(next))
}

export default useLiquidityData
