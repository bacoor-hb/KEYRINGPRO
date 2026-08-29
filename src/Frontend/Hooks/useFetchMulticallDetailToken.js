
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import { resolveOnchainSymbols } from 'src/Services/TokenListV2/symbolOnchain'
import { useLiquidityData, writeLiquidityData } from 'frontend/Hooks/useLiquidityData'

export const QUERY_KEY = 'getDataMuticall'

// Fetch token details for a batch of addresses on the same chain (one API call)
const getDataTokenDetailByChain = async (chainId, addresses) => {
  if (!addresses?.length) return []
  const res = await BaseAPI.getData(`keyrings/tokens/all/${Number(chainId?.toString())}?addresses=${addresses.join(',')}`)
  const items = res?.items ?? []

  // These rows feed the LP pair label ("WETH/USDC"), which reads `symbolOnchain`
  // first (see PoolList). Fill that field in for the rows the API didn't answer
  // for, so the label shows the contract's own ticker either way. `symbol` and
  // `auditGoplus` come back exactly as the API returned them.
  //
  // Rows key the address as `address`; the resolver reads `contractAddress`, so
  // it's mapped in and dropped again to keep this flow's row shape.
  const resolved = await resolveOnchainSymbols(
    chainId,
    items.map((token) => ({ ...token, contractAddress: token?.address })),
    { keepSymbol: true }
  )
  return resolved.map(({ contractAddress, ...token }) => token)
}

const getDataMuticall = async ({ queryKey }) => {
  const listLiquidityPool = queryKey[1]
  const addressRegisteredLiquidity = queryKey[2]

  // Group unique token addresses by chainId so each chain needs only one request
  const addressesByChain = {}
  listLiquidityPool.forEach((item) => {
    const chainId = item?.chainId
    if (chainId == null) return
    const set = addressesByChain[chainId] || (addressesByChain[chainId] = new Set())
    const token0 = item?.token0?.address
    const token1 = item?.token1?.address
    if (token0) set.add(token0)
    if (token1) set.add(token1)
  })

  const listPromise = Object.entries(addressesByChain).map(([chainId, set]) =>
    getDataTokenDetailByChain(chainId, [...set])
  )

  const result = await Promise.all(listPromise)
  const mergeResult = result.flatMap((item) => item).filter((item) => item !== null)

  // An empty result means the API answered for none of these tokens. Throwing keeps the
  // saved details in place rather than replacing good pair labels and icons with blanks.
  if (!mergeResult.length) throw new Error('No token details returned')

  writeLiquidityData(addressRegisteredLiquidity, 'tokensDetail', mergeResult)
  return mergeResult
}

const useFetchMulticallDetailToken = (listLiquidityPool, addressRegisteredLiquidity = []) => {
  // Saved details for THIS address — the pool list's other half (pair labels + icons).
  // Both come from the same Redux entry, so they are in hand on the same first render
  // and a row never paints with a fallback symbol and a blank icon.
  const persisted = useLiquidityData(addressRegisteredLiquidity, 'tokensDetail')

  // No pools means nothing to look up — the query stays idle, and react-query reports
  // isLoading=true forever for an idle query, so this must gate the flag below. The
  // address is required too, since it's what the result is saved under.
  const isQueryEnabled = listLiquidityPool?.length > 0 && addressRegisteredLiquidity?.length > 0

  const { data, isLoading } = useQuery(
    [QUERY_KEY, listLiquidityPool, addressRegisteredLiquidity],
    getDataMuticall,
    {
      enabled: isQueryEnabled,
      staleTime: 10 * 60 * 1000, // 10 minutes
      keepPreviousData: false
    }

  )

  const source = data ?? persisted

  return {
    // Same shape as the other two liquidity hooks: loading only when nothing is saved
    // for this address and nothing has been fetched yet.
    isLoading: isQueryEnabled && isLoading && source == null,
    data: source || []
  }
}

export default useFetchMulticallDetailToken
