import React, { useState } from 'react'
import { View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { isAddress } from 'ethers/lib/utils'
import BigNumber from 'bignumber.js'
import pLimit from 'p-limit'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyInput from 'frontend/Components/UI/MyInput'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import BaseAPI from 'controller/API/BaseAPI'
import AllChainServices from 'controller/AllChainServices'
import settings from 'controller/settings'
import ViemWeb3 from 'src/Web3/ViemWeb3'
import {
  CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP,
  LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_PANCAKESWAP,
  LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_UNISWAP,
  MULTICALL3_CHAIN_IDS,
  typeLiquidityPool
} from 'common/constants/chain'
import styles from './styles'
import { getCheckAddressCoinPool, STORAGE_KEY as COIN_POOL_STORAGE_KEY, QUERY_KEY as COIN_POOL_QUERY_KEY } from 'frontend/Hooks/useCheckAddressCoinPool'
import { STORAGE_KEY as POOL_LIST_STORAGE_KEY, QUERY_KEY as POOL_LIST_QUERY_KEY } from 'frontend/Hooks/useGetListPoolLiquidity'
import { STORAGE_KEY as TOKEN_DETAIL_STORAGE_KEY, QUERY_KEY as TOKEN_DETAIL_QUERY_KEY } from 'frontend/Hooks/useFetchMulticallDetailToken'
import { storeDataToAsyncStorage } from 'common/storage/asyncStorage'
import { queryClient } from 'common/queryClient'
import { lowerCase, getActiveLiquidityAddress } from 'common/function'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { pixelByHeight } from 'common/styles'

const MAX_ADDRESS_LENGTH = 42

// Rate limits are per-RPC-endpoint, and every chain has its own endpoint — so the
// concurrency caps below are PER CHAIN. Chains still fan out fully in parallel;
// throttling across them would only slow the check down without protecting any
// single endpoint.
//
// Each limiter is created on first use for a chainId and reused after that.
const CONCURRENT_READS_PER_CHAIN = 10
const CONCURRENT_BATCHES_PER_CHAIN = 5

const chainReadLimiters = new Map()
const chainBatchLimiters = new Map()

const getLimiter = (limiters, chainId, concurrency) => {
  const key = Number(chainId)
  if (!limiters.has(key)) limiters.set(key, pLimit(concurrency))
  return limiters.get(key)
}

// viem splits a multicall into chunks of `batchSize` bytes of calldata (default
// 1024) and fires them all with Promise.allSettled — no throttle of its own. For
// a wallet with many positions that is a burst of simultaneous eth_calls at one
// endpoint, so we chunk the calls ourselves and meter the batches per chain.
//
// 50 is well inside what the RPCs accept (200 calls in one request still succeeds
// on mainnet/Base/Optimism) while keeping each response small enough to parse
// cheaply on Hermes and limiting how much work a single failed batch loses.
// viem's 1024-byte default would re-split these, so batchSize is disabled below
// and this value is the only chunking that applies.
const MULTICALL_CALLS_PER_BATCH = 50

const chunkArray = (items, size) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

// Runs pre-chunked multicall batches under this chain's batch limiter and flattens
// the results back into one array. Promise.all preserves order, so the flattened
// result still lines up index-for-index with `calls`.
const readMulticallChunked = async (chainId, calls) => {
  const batchLimit = getLimiter(chainBatchLimiters, chainId, CONCURRENT_BATCHES_PER_CHAIN)
  const batches = chunkArray(calls, MULTICALL_CALLS_PER_BATCH)
  const results = await Promise.all(
    // batchSize: 0 → viem sends each chunk as one request instead of re-splitting
    // it, so MULTICALL_CALLS_PER_BATCH is the real request size.
    batches.map((batch) => batchLimit(() => ViemWeb3.readMulticall(chainId, batch, { batchSize: 0 })))
  )
  return results.flat()
}

// The register flow is a small state machine — one `status` instead of juggling
// overlapping isLoading / isChecked / isSuccess booleans. A single "Register"
// action runs the eligibility checks and the API post back-to-back.
const REGISTER_STATUS = {
  INPUT: 'input', // idle — entering / editing the address (button: "Register")
  REGISTERING: 'registering', // running — checks + posting the registration
  SUCCESS: 'success' // registered
}

// Minimal position-manager ABI for the multicall path. Only the two paged reads
// are needed — `balanceOf` stays a single call since it gates everything after it.
const POSITION_MANAGER_MULTICALL_ABI = [
  { inputs: [{ internalType: 'address', name: 'owner', type: 'address' }, { internalType: 'uint256', name: 'index', type: 'uint256' }], name: 'tokenOfOwnerByIndex', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'positions', outputs: [{ internalType: 'uint96', name: 'nonce', type: 'uint96' }, { internalType: 'address', name: 'operator', type: 'address' }, { internalType: 'address', name: 'token0', type: 'address' }, { internalType: 'address', name: 'token1', type: 'address' }, { internalType: 'uint24', name: 'fee', type: 'uint24' }, { internalType: 'int24', name: 'tickLower', type: 'int24' }, { internalType: 'int24', name: 'tickUpper', type: 'int24' }, { internalType: 'uint128', name: 'liquidity', type: 'uint128' }, { internalType: 'uint256', name: 'feeGrowthInside0LastX128', type: 'uint256' }, { internalType: 'uint256', name: 'feeGrowthInside1LastX128', type: 'uint256' }, { internalType: 'uint128', name: 'tokensOwed0', type: 'uint128' }, { internalType: 'uint128', name: 'tokensOwed1', type: 'uint128' }], stateMutability: 'view', type: 'function' }
]

// `positions` returns a tuple — viem gives an array, so liquidity is index 7.
const POSITION_LIQUIDITY_INDEX = 7

// Multicall path: 2 batched round-trips (token ids, then positions) instead of
// 2N individual RPC calls. Only used on chains where Multicall3 is deployed —
// see checkAddressHasLPToken. Returns true as soon as any position has liquidity.
const checkAddressHasLPTokenMulticall = async (chainId, contractAddress, address, balance) => {
  const idCalls = Array.from({ length: balance }, (_, index) => ({
    address: contractAddress,
    abi: POSITION_MANAGER_MULTICALL_ABI,
    functionName: 'tokenOfOwnerByIndex',
    args: [address, BigInt(index)]
  }))
  const idResults = await readMulticallChunked(chainId, idCalls)

  // allowFailure: true → skip the entries that reverted rather than failing the batch.
  const positionCalls = idResults
    .filter((item) => item?.status === 'success' && item?.result != null)
    .map((item) => ({
      address: contractAddress,
      abi: POSITION_MANAGER_MULTICALL_ABI,
      functionName: 'positions',
      args: [item.result]
    }))
  if (!positionCalls.length) return false

  const positionResults = await readMulticallChunked(chainId, positionCalls)
  return positionResults.some((item) => {
    if (item?.status !== 'success') return false
    const liquidity = item?.result?.[POSITION_LIQUIDITY_INDEX]
    return liquidity != null && new BigNumber(liquidity.toString()).isGreaterThan(0)
  })
}

// Sequential path: one RPC call per token id / position, metered by this chain's
// read limiter. Works on every chain, so it's the fallback for chains without
// Multicall3.
const checkAddressHasLPTokenSequential = async (chainId, contractAddress, address, balance) => {
  const limit = getLimiter(chainReadLimiters, chainId, CONCURRENT_READS_PER_CHAIN)
  // balance = n > 0 → resolve token ids for index 0..n-1, then their positions.
  const tokenId = await Promise.all(
    Array.from({ length: balance }, (_, index) =>
      limit(() => AllChainServices.getTokenOfOwnerByInitByChain(chainId, contractAddress, address, index))
    )
  )
  const positions = await Promise.all(
    tokenId.map((item) =>
      limit(() => AllChainServices.getPositionsByChain(chainId, contractAddress, item))
    )
  )

  return positions.some((item) => item?.liquidity && new BigNumber(item?.liquidity?.toString() || 0).isGreaterThan(0))
}

// EVM-only: verify the address holds at least one position NFT with liquidity > 0
// on the given chain / DEX (Uniswap or Pancakeswap V3). Mirrors the legacy
// RegisterAddressDetail check, minus the Solana/Raydium path.
//
// Chains with Multicall3 deployed batch the reads; the rest (e.g. Robinhood /
// 4663, where Multicall3 isn't officially supported yet) keep the sequential
// per-call path. A multicall failure also falls back rather than failing the
// check, so a bad batch never blocks a legitimate registration.
const checkAddressHasLPToken = async (address, chainId = 1, type = typeLiquidityPool.uniswap) => {
  try {
    if (!address) return false

    const contractAddress = type === typeLiquidityPool.uniswap
      ? LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_UNISWAP[chainId]
      : LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_PANCAKESWAP[chainId]
    if (!contractAddress) return false

    const balance = await AllChainServices.getTokenBalanceOfPositionByChain(chainId, contractAddress, address)
    if (!balance || new BigNumber(balance?.toString()).isLessThanOrEqualTo(0)) {
      return false
    }

    const total = Number(balance)
    if (MULTICALL3_CHAIN_IDS.has(Number(chainId))) {
      try {
        return await checkAddressHasLPTokenMulticall(chainId, contractAddress, address, total)
      } catch (error) {
        // Batch failed (RPC limit, unexpected revert) → retry the reliable path.
      }
    }

    return await checkAddressHasLPTokenSequential(chainId, contractAddress, address, total)
  } catch (error) {
    return false
  }
}

const RegisterAddress = ({ _this }) => {
  // Start empty — no prefill, even when changing an already-registered address.
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState(REGISTER_STATUS.INPUT)
  const [apiError, setApiError] = useState('')
  const trimmed = address.trim()
  const isValidAddress = isAddress(trimmed)

  // Derived flags — read the single `status` so the JSX stays declarative.
  const isLoading = status === REGISTER_STATUS.REGISTERING
  const isSuccess = status === REGISTER_STATUS.SUCCESS

  // Action button is visible once the address is a valid EVM address. A check / API
  // error hides it until the user edits the input.
  const showAction = isValidAddress && !apiError

  // Input validation message shown inline under the input (unchanged behavior).
  let errorMessage = ''
  if (trimmed.length > 0) {
    if (!trimmed.startsWith('0x')) {
      errorMessage = 'Address must start with “0x”'
    } else if (trimmed.length === MAX_ADDRESS_LENGTH && !isValidAddress) {
      errorMessage = I18n.t('v2.liquidity.invalidWalletAddress')
    }
  }

  // EVM address is at most 42 chars (0x + 40 hex) — cap input length.
  // Editing the address resets the flow back to idle and clears any prior error.
  const onChangeText = (text) => {
    setApiError('')
    setStatus(REGISTER_STATUS.INPUT)
    setAddress(text.trim().slice(0, MAX_ADDRESS_LENGTH))
  }

  const onPaste = async () => {
    const text = await Clipboard.getString()
    if (text) onChangeText(text)
  }

  const onCheckAccountCoinpool = async (address) => {
    const resCheck = await getCheckAddressCoinPool({
      queryKey: ['CheckAddressCoinPool', [address]]
    })
    const { dataListAddressChecked } = resCheck

    return !!dataListAddressChecked.find(item => lowerCase(item.address) === lowerCase(address) && item.isExist)
  }

  // Mirrors the legacy RegisterAddressDetail.onRemoveAddress server call: tell the
  // pool backend to drop a previously-registered address. V2 keeps a single active
  // address, so registering a new one *replaces* the old — but we only un-register
  // the old one on the server when it's a wallet account that can actually sign
  // (HOT / COLD). View-only and external (not-in-app) addresses are left as-is on
  // the server, matching "the rest run as before".
  const removeActiveAddressOnServer = async () => {
    const previousAddress = getActiveLiquidityAddress(ReduxService.getLiquidityList())
    if (!previousAddress || lowerCase(previousAddress) === lowerCase(trimmed)) return

    const accountList = ReduxService.getAccountList() || []
    const account = accountList.find((item) => lowerCase(item?.address) === lowerCase(previousAddress))
    // Skip the server remove for addresses that aren't an in-app account, or that
    // are view-only — those keep the current (replace-only) behavior.
    if (!account || account.accountType === ACCOUNT_TYPE.VIEW_ONLY) return

    try {
      const baseUrl = settings().server.apiKeyringPool
      await BaseAPI.postData(`${baseUrl}/user/remove-member/`, { address: previousAddress }, null, true)
    } catch (error) {
      // Best-effort cleanup — never block the new registration on the remove call.
    }
  }

  // Wipe the cached liquidity data from the previous registration. Each data hook keeps
  // two layers of cache keyed off the old address: a react-query entry (kept visible via
  // keepPreviousData) and an AsyncStorage snapshot (replayed by usePersistedQueryData on
  // mount). Clearing both stops the new address from briefly showing the old address's
  // pools / token details / coin-pool result before its own fetch resolves.
  const clearLiquidityCaches = async () => {
    queryClient.removeQueries([POOL_LIST_QUERY_KEY])
    queryClient.removeQueries([TOKEN_DETAIL_QUERY_KEY])
    queryClient.removeQueries([COIN_POOL_QUERY_KEY])

    await Promise.all([
      storeDataToAsyncStorage(POOL_LIST_STORAGE_KEY, []),
      storeDataToAsyncStorage(TOKEN_DETAIL_STORAGE_KEY, []),
      storeDataToAsyncStorage(COIN_POOL_STORAGE_KEY, { dataListAddressChecked: [], isExistAddressCoinPool: false })
    ])
  }

  // Shared success path: persist the registered address and switch the drawer to the
  // success state (green badge + "Registered address") instead of closing + alerting.
  const onRegisterSuccess = async () => {
    // Un-register the address we're replacing on the server first (qualifying cases only).
    await removeActiveAddressOnServer()

    // Drop the previous address's cached data before swapping in the new one.
    await clearLiquidityCaches()

    await ReduxService.callDispatchAction(StorageReduxAction.setAddressRegisteredLiquidity([trimmed]))

    // Clear any previously-hidden pools for this address. addressDeletedLiquidity is keyed
    // by owner; if a stale entry (from an earlier registration) lingers, the list hook would
    // keep filtering out this address's pools. Match case-insensitively since owner keys may
    // differ in casing from the trimmed input.
    const deleted = JSON.parse(JSON.stringify(ReduxService.getAddressDeletedLiquidity() || {}))
    const ownerKey = Object.keys(deleted).find((key) => lowerCase(key) === lowerCase(trimmed))
    if (ownerKey) {
      delete deleted[ownerKey]
      await ReduxService.callDispatchAction(StorageReduxAction.setAddressDeletedLiquidity(deleted))
    }

    setStatus(REGISTER_STATUS.SUCCESS)
  }

  // Shared failure path: surface the error inline (same spot as the LP-token error)
  // instead of closing the drawer + alerting. Return to the input step so the user
  // can edit and retry.
  const onRegisterFailed = (messageKey = 'registerFailed') => {
    setApiError(I18n.t(`liquidityManagementScreen.${messageKey}`))
    setStatus(REGISTER_STATUS.INPUT)
  }

  // Single action — run every eligibility check, then POST the registration in one go.
  // Any check failure (already registered / not in the system / no LP token) or API
  // failure surfaces inline; on success we switch the drawer to the success state.
  const onRegister = async () => {
    if (!isValidAddress || isLoading) return

    try {
      setApiError('')
      setStatus(REGISTER_STATUS.REGISTERING)

      // Case "already registered" — V2 keeps a single active EVM address, so block
      // only when it matches the address currently registered. Registering replaces
      // it (see onRegisterSuccess), clearing any stale / Solana entry from old versions.
      const registeredAddress = getActiveLiquidityAddress(ReduxService.getLiquidityList())
      if (lowerCase(registeredAddress) === lowerCase(trimmed)) {
        return onRegisterFailed('thisAddressIsAlreadyRegistered')
      }

      // Coinpool accounts skip the wallet/LP checks (same as the legacy flow).
      const isAccountCoinpool = await onCheckAccountCoinpool(trimmed)
      if (!isAccountCoinpool) {
        // Case "not in the system" — must belong to one of the current wallet's accounts.
        const accountList = ReduxService.getAccountList() || []
        const isAddressInWallet = accountList.some((item) => lowerCase(item?.address) === lowerCase(trimmed))
        if (!isAddressInWallet) {
          return onRegisterFailed('thisAddressDoesNotExistInTheSystem')
        }

        // Case "no LP token" — must hold at least one LP position. Uniswap + Pancakeswap
        // are both EVM; Raydium (Solana) is intentionally excluded.
        const arrPromiseUniswap = CHAINS_SUPPORT_LIQUIDITY_POOL_UNISWAP.map((item) =>
          checkAddressHasLPToken(trimmed, item, typeLiquidityPool.uniswap))
        // -------currently skipping pancakeswap check as the API doesn't support it yet, will add back once the API is ready-------
        // const arrPromisePancakeswap = CHAINS_SUPPORT_LIQUIDITY_POOL_PANCAKESWAP.map((item) =>
        //   checkAddressHasLPToken(trimmed, item, typeLiquidityPool.pancakeswap))
        // const arrayRes = await Promise.all([...arrPromiseUniswap, ...arrPromisePancakeswap])
        // --------------------------------------------------------------------------------------------------------------

        const arrayRes = await Promise.all([...arrPromiseUniswap])

        if (!arrayRes.some((item) => item === true)) {
          return onRegisterFailed('thisAddressDoesNotHaveAnLPToken')
        }
      }

      // All checks passed → POST the registration. The body is identical for both the
      // coinpool and normal paths, so a single post covers both.
      const baseUrl = settings().server.apiKeyringPool
      const res = await BaseAPI.postData(`${baseUrl}/user/add-member`, { address: trimmed }, null, true)

      if (res?.statusCode === 200) {
        await onRegisterSuccess()
      } else {
        onRegisterFailed()
      }
    } catch (error) {
      onRegisterFailed()
    }
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('v2.liquidity.registerAddress')}
        leftIcon={images.UIV2.icons.icon_register}
        rightElement={(isSuccess || !showAction) ? null : (
          // "Register" runs the eligibility checks and posts the registration in one action.
          <MyButton
            // noMinWidth
            size='small'
            label={I18n.t('Initial.register')}
            isLoading={isLoading}
            isDisable={isLoading}
            variant='primary'
            onPress={onRegister}
          />
        )}
      />

      {isSuccess ? (
        <View
          style={{
            gap: pixelByHeight(14)
          }}>
          <StatusMessage
            variant='success'
            title={I18n.t('liquidityManagementScreen.registeredAddress')}
            titleConfig={{ className: 'text-green', variant: 'subTitle' }}
            style={styles.statusSuccess}
          />
          <View>
            <MyText className='text-medium' style={styles.descSuccess}>
              {I18n.t('v2.liquidity.holdsLpTokens')}
            </MyText>
            <MyText className='text-medium' style={styles.descSuccess}>
              {I18n.t('v2.liquidity.canBeAdded')}
            </MyText>
          </View>

        </View>

      ) : (
        <>
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <MyInput
                noErrorSpace={!!apiError}
                isError={!!errorMessage}
                errMessage={errorMessage}
                typeInput='area'
                value={address}
                onChangeText={onChangeText}
                maxLength={MAX_ADDRESS_LENGTH}
                placeholder={I18n.t('v2.liquidity.addressPlaceholder')}
                // The placeholder wraps to 2 lines; without a fixed min height the
                // multiline field shrinks from 2 lines to 1 the instant the user
                // types (1-line content), shifting the layout. Reserve 2 lines and
                // top-align so the box height stays constant whether the 2-line
                // placeholder or the 1-line value is showing.
                textAlignVertical='top'
                inputWrapperConfig={{ style: styles.inputWrapperArea }}
              />
            </View>
            <View
              style={{
                paddingVertical: pixelByHeight(11)
              }}
            >
              <MyButton
                noMinWidth
                size='small'
                disableLiquidGlass
                style={styles.pasteBtn}
                onPress={onPaste}
                label={<MyIcon uri={images.UIV2.icons.icon_past} variant='small' />}
              />
            </View>

          </View>

          {apiError ? (
            <StatusMessage
              variant='error'
              message={apiError}
              style={[styles.statusError]} />

          ) : (
            <View style={styles.descBox}>
              <MyText className='text-medium'>
                {I18n.t('liquidityManagementScreen.desRegisterAddress')}
              </MyText>
            </View>
          )}

        </>
      )}
    </MyViewPage>
  )
}

export default RegisterAddress
