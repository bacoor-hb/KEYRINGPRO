import { getWalletconnectRequestMethodName } from 'common/chain'
import { decodeDataTxAndGetMethodName, isArrayWithData } from 'common/function'
import ReduxService from 'common/redux'
import { useMemo } from 'react'
import { useQuery } from 'react-query'
import { constants } from 'ethers'
import CoinGeckoAPI from 'controller/API/CoinGeckoAPI'
import { formatUnits } from 'viem'
import AllChainServices from 'controller/AllChainServices'
import images from 'assets/Image'
import BaseAPI from 'controller/API/BaseAPI'

const getNameFunctionDecoded = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_, dataTx, chainId, to] = queryKey
  try {
    const result = await decodeDataTxAndGetMethodName(dataTx, chainId, to)
    return result
  } catch (error) {
    return null
  }
}

// Check if contract is token ERC20
const checkIsERC720 = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_, chainId, to] = queryKey

  try {
    const isERC720 = await AllChainServices.checkIsContractERC20(chainId, to)
    return isERC720
  } catch (error) {
    return false
  }
}

const getApproveTokenInfo = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_, chainId, to, decodedInputs] = queryKey

  const blockchainInfo = ReduxService.getReduxDataByKey('blockchainListRedux')?.[Number(chainId)]
  const chainCoingecko = blockchainInfo?.chainCoingecko || blockchainInfo?.chain

  let tokenApproveDecimals
  let tokenApproveSymbol
  let tokenApproveIcon

  const tokenInfoFromKeyringApiRes = await BaseAPI.getData(`keyrings/tokens/all/${Number(chainId)}?addresses=${to}`).catch(() => null)
  const tokenInfoFromKeyringApiList = tokenInfoFromKeyringApiRes?.items || []

  if (isArrayWithData(tokenInfoFromKeyringApiList)) {
    const tokenInfoFromKeyring = tokenInfoFromKeyringApiList.find(item => item?.address?.toLowerCase() === to?.toLowerCase() || item?.contractAddress?.toLowerCase() === to?.toLowerCase())
    if (tokenInfoFromKeyring) {
      tokenApproveDecimals = tokenInfoFromKeyring?.decimals
      tokenApproveSymbol = tokenInfoFromKeyring?.auditGoplus?.token_symbol || tokenInfoFromKeyring?.symbol
      tokenApproveIcon = tokenInfoFromKeyring?.icon_image
    }
  }

  if (!tokenApproveDecimals || !tokenApproveSymbol || !tokenApproveIcon) {
    [tokenApproveSymbol, tokenApproveDecimals] = await Promise.all([
      AllChainServices.getTokenSymbol(chainId, to),
      AllChainServices.getTokenDecimal(chainId, to)
    ]).catch(() => [null, null])

    const coingeckoTokenInfo = await CoinGeckoAPI.searchCoingeckoId({ chain: chainCoingecko, address: to, symbol: tokenApproveSymbol }).catch(() => ({}))

    if (coingeckoTokenInfo?.id) {
      const approveTokenInfoFromCoinGecko = await CoinGeckoAPI.getTokenInfoById(coingeckoTokenInfo.id).catch(() => ({}))
      tokenApproveIcon = approveTokenInfoFromCoinGecko?.image?.small
    }
  }

  const tokenApproveAmount = formatUnits(decodedInputs[1], tokenApproveDecimals)
  const isUnlimited = constants.MaxUint256.lte(decodedInputs[1])

  return {
    decimals: tokenApproveDecimals,
    symbol: tokenApproveSymbol,
    amount: tokenApproveAmount,
    icon: tokenApproveIcon || images.UIV2.icons.unknowToken,
    isUnlimited
  }
}

const useGetNameFunctionDecoded = (requestTxData) => {
  const dataTx = requestTxData?.dataTx
  const chainId = requestTxData?.chainId
  const to = requestTxData?.params?.[0]?.to

  const { data: decodedTxData, isLoading, isFetching } = useQuery(
    ['getNameFunctionDecoded', dataTx, chainId, to],
    getNameFunctionDecoded,
    {
      enabled: !!dataTx && !!chainId && !!to
    }
  )

  // Cache requestMethodName via useMemo
  const requestMethodName = useMemo(() => {
    return getWalletconnectRequestMethodName(
      requestTxData.params[0],
      false,
      { nameFunctionDecodedData: decodedTxData?.method, forceGetMethodName: requestTxData?.forceGetMethodName }
    )
  }, [decodedTxData, requestTxData])

  const requestMethodNameWithLabel = useMemo(() => {
    return getWalletconnectRequestMethodName(
      requestTxData.params[0],
      true,
      { nameFunctionDecodedData: decodedTxData?.method, forceGetMethodName: requestTxData?.forceGetMethodName }
    )
  }, [decodedTxData, requestTxData])

  // True for any approve method (ERC20 or not) — known right after decode.
  const isApproveMethod = requestTxData?.params?.[0]?.information?.type === 'CONFIRM_APPROVE' || requestMethodName === 'APPROVE'

  // Synchronous approve hint from the raw calldata: ERC20 approve(address,uint256)
  // always starts with the selector 0x095ea7b3. Available on the very first render
  // (before async decode), so the UI can reserve the spending-cap height up front
  // for approves only — other txs (e.g. transfer) never reserve it.
  const isApproveLikely = requestTxData?.params?.[0]?.information?.type === 'CONFIRM_APPROVE' ||
    (typeof dataTx === 'string' && dataTx.toLowerCase().startsWith('0x095ea7b3'))

  // Check if contract is ERC721
  const { data: isERC720, isLoading: isLoadingIsERC720 } = useQuery(
    ['checkIsERC720', chainId, to],
    checkIsERC720,
    {
      enabled: !!chainId && !!to && isApproveMethod,
      staleTime: 60 * 60 * 1000 // Cache for 1 hour (contract type won't change)
    }
  )

  // Check if this is approve transaction for ERC20 token (not ERC721 NFT)
  const isConfirmApprove = isApproveMethod && isERC720

  // Cache approveTokenInfo by react-query
  const { data: approveTokenInfo, isLoading: isLoadingApproveInfo, isIdle: isIdleApproveInfo } = useQuery(
    ['approveTokenInfo', chainId, to, decodedTxData?.inputs],
    getApproveTokenInfo,
    {
      enabled: isConfirmApprove && !!decodedTxData?.inputs && !!chainId && !!to,
      staleTime: 30 * 60 * 1000 // Cache for 30 minutes
    }
  )

  // True while the spending-cap data for an approve is still on the way, so the UI
  // can show the method name and the spending cap together (not one then the other).
  // Settles (false) once the ERC20 check resolves to non-ERC20, or once the token
  // info query finishes — including on error — so it never gets stuck loading.
  const isLoadingApproveTokenInfo =
    isApproveMethod && isERC720 !== false &&
    (isLoadingIsERC720 || isIdleApproveInfo || isLoadingApproveInfo)

  return {
    isLoading,
    isFetching,
    isApproveLikely,
    isLoadingApproveTokenInfo,
    decodedTxData,
    requestMethodName,
    requestMethodNameWithLabel,
    approveTokenInfo: isERC720 ? approveTokenInfo : {
      decimals: '',
      symbol: '',
      amount: '',
      icon: '',
      isUnlimited: null
    }

  }
}

export default useGetNameFunctionDecoded
