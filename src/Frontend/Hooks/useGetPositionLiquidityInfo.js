
import BigNumber from 'bignumber.js'
import { STATUS_RANGE } from 'common/constants/app'
import BaseAPI from 'controller/API/BaseAPI'
import { useQuery } from 'react-query'
import QueryString from 'query-string'
import settings from 'controller/settings'
import AllChainServices from 'controller/AllChainServices'
import usePersistedQueryData from 'frontend/Hooks/usePersistedQueryData'

const getPositionLiquidityInfo = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_, poolId, chainId, owner, tokenId] = queryKey
  const query = {
    owner,
    id: poolId,
    tokenId,
    chainId
  }

  const CONST_MAX_TICK = 887272 // (fixed, hardcoded in contract config)
  const CONST_MIN_TICK = -887272 // (fixed, hardcoded in contract config)

  const baseUrl = settings().server.apiKeyringPool
  const res = await BaseAPI.getData(`${baseUrl}/user/position-liquidity-info?${QueryString.stringify(query)}`, null, true)
  if (res?.data) {
    const data = res?.data
    const token0OriginalPercentage = data?.token0OriginalPercentage ? BigNumber(data?.token0OriginalPercentage?.toString()) : null
    const token0Percentage = BigNumber(data?.token0Percentage?.toString())
    const token1Percentage = BigNumber(data?.token1Percentage?.toString())
    const tickLower = BigNumber(data?.tickLower?.toString())
    const tickUpper = BigNumber(data?.tickUpper?.toString())
    let rangeStatus = ''
    const tickSpacing = await AllChainServices.getTickSpacing(chainId, poolId)

    const tickUpperFullRange = Math.floor(CONST_MAX_TICK / tickSpacing) * tickSpacing
    const tickLowerFullRange = Math.ceil(CONST_MIN_TICK / tickSpacing) * tickSpacing

    if (tickLower.eq(tickLowerFullRange) && tickUpper.eq(tickUpperFullRange)) {
      rangeStatus = STATUS_RANGE.FULL_RANGE
    } else {
      if (token0Percentage.eq(0) || token1Percentage.eq(0)) {
        rangeStatus = STATUS_RANGE.OUT_RANGE
      } else {
        rangeStatus = STATUS_RANGE.IN_RANGE
      }
    }

    const currentTick = data?.tick?.currentTick
    let percentMinTick = (data?.tick?.minTick - currentTick) * 100 / data?.tick?.minTick
    let percentMaxTick = (currentTick - data?.tick?.maxTick) * 100 / data?.tick?.maxTick

    if (percentMinTick < 0) {
      percentMinTick = 0
    }
    if (percentMinTick > 100) {
      percentMinTick = 100
    }
    if (percentMaxTick < 0) {
      percentMaxTick = 0
    }
    if (percentMaxTick > 100) {
      percentMaxTick = 100
    }

    const temp = {
      ...data,
      rangeStatus: rangeStatus,
      percentMinTick: percentMinTick,
      percentMaxTick: percentMaxTick,
      token0Percentage: token0Percentage.decimalPlaces(2).toNumber(),
      token1Percentage: BigNumber(100).minus(token0Percentage.decimalPlaces(2)).toNumber(),
      token0OriginalPercentage: token0OriginalPercentage ? token0OriginalPercentage.decimalPlaces(2).toNumber() : null
    }
    return temp ?? null
  }

  // Offline / failed requests: BaseAPI swallows the error and resolves to null, so
  // res.data is missing here. Return null (NOT {}) so the hook's `data ?? persisted`
  // falls back to the last good snapshot instead of clobbering it with an empty object
  // (which also blocks the onSuccess persist from overwriting the good cache).
  return null
}

const useGetPositionLiquidityInfo = (poolId, chainId, owner, tokenId) => {
  // Per-pool persisted snapshot — show the last result (even after app restart)
  // while the network refetches.
  const [persisted, persist] = usePersistedQueryData(`POSITION_LIQUIDITY_INFO_${chainId}_${poolId}_${tokenId}`)

  const { data, isLoading } = useQuery(['getPositionLiquidityInfo', poolId, chainId, owner, tokenId], getPositionLiquidityInfo, {
    enabled: !!poolId && !!chainId && !!owner && !!tokenId,
    keepPreviousData: true,
    onSuccess: persist
  })

  const source = data ?? persisted

  return {
    isLoading: isLoading && source == null,
    data: source || {}
  }
}

export default useGetPositionLiquidityInfo
