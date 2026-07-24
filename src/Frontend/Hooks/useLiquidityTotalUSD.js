import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { getActiveLiquidityAddress } from 'common/function'
import useGetListPoolLiquidity from 'frontend/Hooks/useGetListPoolLiquidity'

// Total raw-USD liquidity for the registered address, computed on demand (e.g. when
// the Home screen mounts) instead of being persisted in Redux. Mirrors the Liquidity
// screen's total: sum of active (non-hidden) pools' fiatAmountLiquidity.
const useLiquidityTotalUSD = (options = {}) => {
  const { enabled = true } = options
  const addressRegisteredLiquidity = useSelector(state => state.addressRegisteredLiquidity)
  const addressDeletedLiquidity = useSelector(state => state.addressDeletedLiquidity)

  // Single active EVM address (old versions may have stored extra / Solana addresses).
  const activeLiquidityAddress = getActiveLiquidityAddress(addressRegisteredLiquidity)
  const listAddressRegisted = useMemo(
    () => (activeLiquidityAddress ? [activeLiquidityAddress] : []),
    [activeLiquidityAddress]
  )

  // Flat list of hidden position ids (same shape the Liquidity screen derives).
  const arrayAddressDeleted = useMemo(
    () => Object.values(JSON.parse(JSON.stringify(addressDeletedLiquidity || {}))).flat(),
    [addressDeletedLiquidity]
  )

  const { data: listLiquidityPool = [], isLoading, isFetching, refetch } = useGetListPoolLiquidity(
    listAddressRegisted,
    [],
    { enabled: enabled && !!activeLiquidityAddress }
  )

  // Totals exclude hidden pools — matches PoolList's overview total.
  const totalLiquidityUSD = useMemo(() => {
    const deletedSet = new Set(arrayAddressDeleted)
    return listLiquidityPool
      .filter(item => !deletedSet.has(item?._id))
      .reduce((total, item) => {
        const amount = item?.fiatAmountLiquidity
        return total + (!amount || isNaN(amount) ? 0 : amount)
      }, 0)
  }, [listLiquidityPool, arrayAddressDeleted])

  return {
    totalLiquidityUSD,
    isLoading,
    isFetching,
    refetch,
    // Whether a liquidity address is registered — lets callers hide the section entirely
    // when there's nothing to show.
    hasRegisteredAddress: !!activeLiquidityAddress
  }
}

export default useLiquidityTotalUSD
