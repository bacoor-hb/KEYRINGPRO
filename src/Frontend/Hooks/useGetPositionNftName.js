import { useQuery } from 'react-query'
import AllChainServices from 'controller/AllChainServices'
import { typeLiquidityPool } from 'common/constants/chain'
import { buildPositionKey, useLiquidityPositionData, writeLiquidityPositionData } from 'frontend/Hooks/useLiquidityData'
import { useMemo } from 'react'

// Parses the on-chain Uniswap/Pancake position NFT name into its parts. The name
// is rendered by the position-manager contract as a fixed ` - ` separated string:
//   "Uniswap - 0.3% - VIRTUAL/WETH - 2270.2<>3413.8"
// We pick parts by shape (fee ends with %, pair has /, range has <>) rather than
// by index so an unexpected platform prefix or extra segment can't shift them.
export const parsePositionNftName = (name) => {
  if (!name || typeof name !== 'string') return null
  const parts = name.split(' - ').map((p) => p.trim()).filter(Boolean)

  const platform = parts[0] || ''
  const feeRaw = parts.find((p) => /%$/.test(p)) || ''
  const pair = parts.find((p) => p.includes('/')) || ''
  const range = parts.find((p) => p.includes('<>')) || ''

  const feePercent = feeRaw ? feeRaw.replace('%', '').trim() : ''
  let priceLower = ''
  let priceUpper = ''
  if (range) {
    const [lower, upper] = range.split('<>')
    priceLower = (lower || '').trim()
    priceUpper = (upper || '').trim()
  }

  return { name, platform, feePercent, pair, range, priceLower, priceUpper }
}

const fetchPositionNftName = async ({ queryKey }) => {
  const [, chainId, tokenId, type] = queryKey
  const name = await AllChainServices.getPositionNftName(chainId, tokenId, type)
  return parsePositionNftName(name)
}

// Reads + parses the position NFT name. Saved per position so the parsed parts survive
// an app restart and show instantly while the on-chain call refetches.
const useGetPositionNftName = (chainId, tokenId, type = typeLiquidityPool.uniswap, owner) => {
  // Stored under the position's account, alongside its chart and info. No poolId here —
  // the NFT name belongs to the token, so the key omits the part the caller doesn't have.
  const owners = useMemo(() => [owner], [owner])
  const positionKey = buildPositionKey(chainId, tokenId)
  const persisted = useLiquidityPositionData(owners, positionKey, 'nftName')

  const { data, isLoading } = useQuery(
    ['getPositionNftName', chainId, tokenId, type],
    fetchPositionNftName,
    {
      enabled: chainId != null && tokenId != null,
      keepPreviousData: true,
      staleTime: Infinity,
      onSuccess: (value) => writeLiquidityPositionData(owners, positionKey, 'nftName', value)
    }
  )

  const source = data ?? persisted

  return {
    isLoading: isLoading && source == null,
    data: source || null
  }
}

export default useGetPositionNftName
