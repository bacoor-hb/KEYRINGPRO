import { getWalletconnectRequestMethodName } from 'common/chain'
import { decodeDataTxAndGetMethodName, isArrayWithData, lowerCase } from 'common/function'
import { resolveOnchainSymbolFor } from 'src/Services/TokenListV2/symbolOnchain'
import ReduxService from 'common/redux'
import { useMemo } from 'react'
import { useQuery } from 'react-query'
import { constants } from 'ethers'
import CoinGeckoAPI from 'controller/API/CoinGeckoAPI'
import { formatUnits, decodeFunctionData } from 'viem'
import AllChainServices from 'controller/AllChainServices'
import images from 'assets/Image'
import BaseAPI from 'controller/API/BaseAPI'

// Same minimal ABI RequestCard uses to re-encode a custom spending cap — kept
// here too so the standard approve(address,uint256) selector can be decoded
// locally, without depending on the scan-API decoder below (which only covers
// chains in its own allowlist and returns null for anything else, e.g. custom
// / dynamic chains).
const ERC20_APPROVE_ABI = [{
  name: 'approve',
  type: 'function',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ]
}]

// Some dApps prefix the calldata with a `--{"type":"..."}--` metadata blob.
// redux.js parses that blob into params[0].information and stores the STRIPPED
// calldata in params[0].data, but keeps the RAW prefixed string in payload.dataTx
// (which is what this hook receives). Strip it back off before any decode:
// viem's decodeFunctionData needs a plain hex string, and the selector sniff
// below needs the calldata to actually start at index 0.
// Mirrors the same split in redux.js / decodeDataTxAndGetMethodName.
const stripCalldataMetadata = (dataTxRaw) => {
  if (typeof dataTxRaw !== 'string') return dataTxRaw
  const parts = dataTxRaw.split('--')
  const data = parts[2] || parts[0]
  if (!data) return data
  return data.startsWith('0x') ? data : `0x${data}`
}

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

  let tokenInfoFromKeyring
  if (isArrayWithData(tokenInfoFromKeyringApiList)) {
    tokenInfoFromKeyring = tokenInfoFromKeyringApiList.find(item => lowerCase(item?.address) === lowerCase(to) || lowerCase(item?.contractAddress) === lowerCase(to))
    if (tokenInfoFromKeyring) {
      tokenApproveDecimals = tokenInfoFromKeyring?.decimals
      // The user is about to grant a spending allowance, so the ticker shown must
      // be the CONTRACT's own — a listing symbol that disagrees with the token
      // being approved is exactly the confusion this prompt has to rule out.
      tokenApproveSymbol = tokenInfoFromKeyring?.symbolOnchain || tokenInfoFromKeyring?.auditGoplus?.token_symbol || tokenInfoFromKeyring?.symbol
      tokenApproveIcon = tokenInfoFromKeyring?.icon_image
    }
  }

  if (!tokenApproveDecimals || !tokenApproveSymbol || !tokenApproveIcon) {
    // getTokenSymbol reads `symbol()` from the contract, so this branch already
    // produces the on-chain ticker — no resolver call needed on this path.
    //
    // It resolves to '' (not null) when the contract can't answer, so both
    // results are only taken when they actually carry a value — otherwise a
    // failed read would blank out a symbol the API had already supplied.
    const [onchainSymbol, onchainDecimals] = await Promise.all([
      AllChainServices.getTokenSymbol(chainId, to),
      AllChainServices.getTokenDecimal(chainId, to)
    ]).catch(() => [null, null])
    tokenApproveSymbol = onchainSymbol || tokenApproveSymbol
    tokenApproveDecimals = onchainDecimals ?? tokenApproveDecimals

    const coingeckoTokenInfo = await CoinGeckoAPI.searchCoingeckoId({ chain: chainCoingecko, address: to, symbol: tokenApproveSymbol }).catch(() => ({}))

    if (coingeckoTokenInfo?.id) {
      const approveTokenInfoFromCoinGecko = await CoinGeckoAPI.getTokenInfoById(coingeckoTokenInfo.id).catch(() => ({}))
      tokenApproveIcon = approveTokenInfoFromCoinGecko?.image?.small
    }
  } else {
    // The API row answered for decimals/icon. If it also carried `symbolOnchain`
    // the ticker above is already the contract's; otherwise it's still a listing
    // symbol, so resolve it. `resolveOnchainSymbolFor` short-circuits on the
    // former, so it costs no RPC in that case.
    tokenApproveSymbol = (await resolveOnchainSymbolFor(chainId, to, tokenInfoFromKeyring?.symbolOnchain)) ?? tokenApproveSymbol
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
  const dataTx = stripCalldataMetadata(requestTxData?.dataTx)
  const chainId = requestTxData?.chainId
  const to = requestTxData?.params?.[0]?.to

  const { data: decodedTxData, isLoading, isFetching } = useQuery(
    ['getNameFunctionDecoded', dataTx, chainId, to],
    getNameFunctionDecoded,
    {
      enabled: !!dataTx && !!chainId && !!to
    }
  )

  // Synchronous approve hint from the raw calldata: ERC20 approve(address,uint256)
  // always starts with the selector 0x095ea7b3. Available on the very first render
  // (before async decode), so the UI can reserve the spending-cap height up front
  // for approves only — other txs (e.g. transfer) never reserve it.
  const isApproveLikely = requestTxData?.params?.[0]?.information?.type === 'CONFIRM_APPROVE' ||
    (typeof dataTx === 'string' && dataTx.toLowerCase().startsWith('0x095ea7b3'))

  // Local, synchronous decode of the standard approve selector — a fallback for
  // when the scan-API decoder below can't resolve the method (it only covers
  // chains in its own allowlist and returns null for anything else, e.g. custom
  // / dynamic chains). Without this, an approve on such a chain never resolves
  // its method name, so isApproveLikely reserves the spending-cap UI space but
  // nothing ever fills it.
  const localApproveDecoded = useMemo(() => {
    if (!isApproveLikely || typeof dataTx !== 'string') return null
    try {
      const [spender, amount] = decodeFunctionData({ abi: ERC20_APPROVE_ABI, data: dataTx }).args
      // Stringify the bigint amount — react-query hashes the query key with
      // JSON.stringify, which throws on a raw BigInt.
      return { inputs: [spender, amount.toString()] }
    } catch (error) {
      return null
    }
  }, [isApproveLikely, dataTx])

  // Cache requestMethodName via useMemo
  const requestMethodName = useMemo(() => {
    return getWalletconnectRequestMethodName(
      requestTxData.params[0],
      false,
      { nameFunctionDecodedData: decodedTxData?.method || (localApproveDecoded ? 'approve' : undefined), forceGetMethodName: requestTxData?.forceGetMethodName }
    )
  }, [decodedTxData, localApproveDecoded, requestTxData])

  const requestMethodNameWithLabel = useMemo(() => {
    return getWalletconnectRequestMethodName(
      requestTxData.params[0],
      true,
      { nameFunctionDecodedData: decodedTxData?.method || (localApproveDecoded ? 'approve' : undefined), forceGetMethodName: requestTxData?.forceGetMethodName }
    )
  }, [decodedTxData, localApproveDecoded, requestTxData])

  // True for any approve method (ERC20 or not) — known right after decode.
  const isApproveMethod = requestTxData?.params?.[0]?.information?.type === 'CONFIRM_APPROVE' || requestMethodName === 'APPROVE'

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

  // Prefer the scan-API decoder's inputs; fall back to the local selector decode
  // above when the scan API couldn't resolve this chain/contract.
  const approveInputs = decodedTxData?.inputs || localApproveDecoded?.inputs

  // Cache approveTokenInfo by react-query
  const { data: approveTokenInfo, isLoading: isLoadingApproveInfo, isIdle: isIdleApproveInfo } = useQuery(
    ['approveTokenInfo', chainId, to, approveInputs],
    getApproveTokenInfo,
    {
      enabled: isConfirmApprove && !!approveInputs && !!chainId && !!to,
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
