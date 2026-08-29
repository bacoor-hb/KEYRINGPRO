import { CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP } from 'common/constants/chain'
import BaseAPI from 'controller/API/BaseAPI'
import { stringify } from 'query-string'
import { useQuery } from 'react-query'
import { isAddress } from 'ethers/lib/utils'
import settings from 'controller/settings'
import { useLiquidityData, writeLiquidityData } from 'frontend/Hooks/useLiquidityData'

export const QUERY_KEY = 'getListPoolLiquidity'

const getListPoolLiquidity = async ({ queryKey }) => {
  const addressRegisteredLiquidity = queryKey[1]

  const addressRegisteredLiquidityEvm = addressRegisteredLiquidity.filter((item) => isAddress(item))

  const queryEvm = {
    addresses: [...addressRegisteredLiquidityEvm]
  }

  const baseUrl = settings().server.apiKeyringPool
  const resEvm = await BaseAPI.getData(`${baseUrl}/user/position?` + stringify(queryEvm), null, true)

  // Anything other than a clean 200 leaves the saved data in place: throwing keeps
  // react-query on its last successful result, and the Redux copy still backs the
  // first render. Returning [] here would instead wipe a good list on one bad response.
  if (resEvm?.statusCode !== 200) throw new Error('Failed to load liquidity positions')

  const pools = (resEvm?.data ?? [])
    .filter((lq) => lq.type === 'uniswap')
    .filter((lq) => !(lq?.token0Price === 0 && lq?.token1Price === 0 && lq?.fiatAmountLiquidity === 0))
    .filter((lq) => CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP.includes(Number(lq?.chainId?.toString())))

  writeLiquidityData(addressRegisteredLiquidity, 'pools', pools)
  return pools
}

const useGetListPoolLiquidity = (addressRegisteredLiquidity, addressDeletedLiquidity = [], options = {}) => {
  const { enabled = true } = options
  // Last saved pools for THIS address, straight from Redux — already rehydrated before
  // the first render, so a returning user sees their pools immediately and the network
  // result just updates them in place.
  const persisted = useLiquidityData(addressRegisteredLiquidity, 'pools')

  // Query only runs when enabled AND there's a registered address to query.
  const isQueryEnabled = enabled && addressRegisteredLiquidity?.length > 0

  const { data, isLoading, isFetching, refetch } = useQuery(
    [QUERY_KEY, addressRegisteredLiquidity],
    getListPoolLiquidity,
    {
      enabled: isQueryEnabled,
      // No keepPreviousData: the Redux copy is already per-address, so it — not a stale
      // react-query result — is what fills the gap while a new address loads. Holding
      // the previous address's pools here would only risk showing them as the new one's.
      keepPreviousData: false
    }
  )

  // Prefer fresh query data; fall back to the saved copy until it arrives.
  // Hidden pools are filtered out here only when a caller passes addressDeletedLiquidity
  // (legacy screen). The V2 screen passes nothing and derives hidden state in the UI so
  // that toggling Hide/Show re-renders instantly instead of churning this query's data
  // (and the downstream token-detail query that keys off it).
  const source = data ?? persisted
  let dataFinal = source?.length > 0 ? source : []

  if (dataFinal.length > 0 && addressDeletedLiquidity?.length > 0) {
    dataFinal = dataFinal.filter(lq => !addressDeletedLiquidity.includes(lq?._id))
  }

  return {
    // Loading only when there is genuinely nothing to show — nothing saved for this
    // address and nothing fetched yet. A returning user never hits this: their pools
    // are already in `source` on the first render. It is reached on a first-ever load
    // and right after registering a new address, which are the only times a loader is
    // the correct thing to show.
    // Gated on isQueryEnabled because react-query reports isLoading=true forever for an
    // idle (disabled) query, which would otherwise hang the screen.
    isLoading: isQueryEnabled && isLoading && source == null,
    // Background fetch flag (used to drive pull-to-refresh) + manual refetch trigger.
    isFetching,
    refetch,
    data: dataFinal || []
  }
}

export default useGetListPoolLiquidity
