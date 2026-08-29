import BigNumber from 'bignumber.js'
import pLimit from 'p-limit'
import { MULTICALL3_CHAIN_IDS } from 'common/constants/chain'
import { convertWeiToBalance, getChainInfo, sleep } from 'common/function'
import { isNativeToken } from 'common/tokens'
import settings from 'controller/settings'
import { buildViemChain } from 'src/Services/TokenListV2'
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  ExecutionRevertedError,
  fallback,
  FeeCapTooHighError,
  FeeCapTooLowError,
  http,
  InsufficientFundsError,
  IntrinsicGasTooHighError,
  IntrinsicGasTooLowError,
  maxUint256,
  NonceMaxValueError,
  NonceTooHighError,
  NonceTooLowError,
  publicActions,
  TipAboveFeeCapError,
  TransactionRejectedRpcError,
  TransactionTypeNotSupportedError,
  UserRejectedRequestError
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

// readMulticall's fallback (chains without Multicall3) reads one contract per
// RPC request, so it caps concurrent reads at 10 per chain via pLimit — keeps
// the request rate under the endpoint's requests-per-second limit instead of
// bursting every call at once.
const MULTICALL_CALLS_PER_BATCH = 10

const chainReadLimiters = new Map()

const getReadLimiter = (chainId) => {
  const key = Number(chainId)
  if (!chainReadLimiters.has(key)) chainReadLimiters.set(key, pLimit(MULTICALL_CALLS_PER_BATCH))
  return chainReadLimiters.get(key)
}

// trackingTx outcomes. Thrown as Error messages so callers can tell a real
// on-chain failure (reverted) from "we simply could not confirm" (timeout) and
// from an abandoned poll (cancelled) — three states that must NOT be reported
// to the user as the same thing.
export const TX_TRACK_REVERTED = 'TX_REVERTED'
export const TX_TRACK_TIMEOUT = 'TX_TIMEOUT'
export const TX_TRACK_CANCELLED = 'TX_TRACKING_CANCELLED'

// Deterministic node errors. If one RPC returns any of these the request is
// invalid / unaffordable (e.g. a tx with insufficient funds or a stale nonce) —
// every other RPC will reject it identically, and failing over would only
// re-broadcast (risking a double-send). So we STOP and surface the error instead
// of letting fallback() try the next RPC. Harmless for reads: these don't arise
// on eth_call/balanceOf, and `execution reverted` is already a default stop.
const NON_FAILOVER_ERRORS = [
  InsufficientFundsError,
  NonceTooLowError,
  NonceTooHighError,
  NonceMaxValueError,
  FeeCapTooLowError,
  FeeCapTooHighError,
  IntrinsicGasTooLowError,
  IntrinsicGasTooHighError,
  TipAboveFeeCapError,
  TransactionTypeNotSupportedError,
  ExecutionRevertedError
]

// Same idea as NON_FAILOVER_ERRORS, but matched by message: viem ships no error
// class for these. The node already holds a tx for this (sender, nonce) pair, so
// every other RPC would reject the re-broadcast identically. Without this entry
// fallback() sprays the same signed tx across every endpoint and then surfaces
// the LAST node's error instead of the real reason.
// Deliberately NOT matching a bare "transaction underpriced" (no "replacement"):
// that one means the price is below THIS node's floor, and another RPC with a
// lower floor may well accept it — there, failing over is the right move.
const NON_FAILOVER_MESSAGES = [
  /replacement transaction underpriced/i
]

// shouldThrow for every fallback() transport. Returns true to stop failover
// (throw immediately). Keeps viem's default stops (user rejected / tx rejected)
// and adds the deterministic node rejections above. Only genuine
// transport/network errors (no matching code/message) fall over to the next RPC.
const shouldStopFailover = (error) => {
  const code = error?.code
  if (
    code === TransactionRejectedRpcError.code ||
    code === UserRejectedRequestError.code ||
    code === 5000 // CAIP UserRejectedRequestError
  ) {
    return true
  }
  const message = `${error?.details || ''} ${error?.message || ''}`
  return NON_FAILOVER_ERRORS.some((err) => err.nodeMessage?.test(message)) ||
    NON_FAILOVER_MESSAGES.some((pattern) => pattern.test(message))
}

class ViemWeb3 {
  /**
 * Get list RPC sorted by priority
 * @param {*} chainId
 * @returns {string[]}
 * @Note Priority: rpcCustom > rpcUrlPaid > rpcMoreBackup
 */
  static getListRpc (chainId) {
    const rpcUrlPaid = settings().rpcUrlByChainId?.[chainId] || ''

    const chainInfo = getChainInfo(chainId)
    const rpcCustom = chainInfo?.rpcCustom || ''
    const rpcMoreBackup = chainInfo?.rpcs || []
    // keep rpc when to update v2 app when user restore backup file
    const prcBackupOldApp = chainInfo?.linkProvider || ''

    let rpcs = [rpcCustom]

    if (rpcUrlPaid) {
      if (Array.isArray(rpcUrlPaid)) {
        rpcs = [...rpcs, ...rpcUrlPaid]
      } else {
        rpcs = [...rpcs, rpcUrlPaid]
      }
    }

    rpcs = [...rpcs, ...rpcMoreBackup, prcBackupOldApp]

    rpcs = rpcs
      .filter(rpc => !!rpc && rpc?.startsWith('http'))
      .filter((url, index, arr) => arr.indexOf(url) === index)
    return rpcs
  }

  static getPublicClient (chainId, rpcMore) {
    const rpcUrl = this.getListRpc(chainId, rpcMore)
    const chain = buildViemChain(chainId)
    const client = createPublicClient({
      batch: true,
      chain,
      transport: fallback(rpcUrl.map(url => http(url)), { rank: false, retryCount: 3, retryDelay: 150, shouldThrow: shouldStopFailover })
    })
    return client
  }

  static getWalletClient (chainId, rpcMore) {
    const rpcUrl = this.getListRpc(chainId, rpcMore)
    const chain = buildViemChain(chainId, rpcUrl)
    const wallet = createWalletClient({
      chain,
      transport: fallback(rpcUrl.map(url => http(url)), { rank: false, retryCount: 3, retryDelay: 150, shouldThrow: shouldStopFailover })
    }).extend(publicActions)
    return wallet
  }

  /**
   * Poll for a tx receipt until it settles. Preferred over viem's
   * waitForTransactionReceipt for anything driven by a screen, because that one
   * watches EVERY block (emitMissed) and, while the receipt is missing, fetches
   * each full block to look for a replacement tx — and cannot be cancelled. This
   * loop only calls eth_getTransactionReceipt and checks `shouldStop` between
   * polls, so closing the screen actually stops the RPC traffic.
   *
   * @param {number|string} chainId
   * @param {string} hash
   * @param {number} timeout    ms to keep polling before giving up (default 22.5s)
   * @param {Function} [shouldStop] returns true to abandon the poll (screen gone)
   * @returns {Promise<object>} the receipt, when the tx succeeded
   * @throws {Error} TX_REVERTED | TX_TIMEOUT | TX_TRACKING_CANCELLED
   */
  static async trackingTx (chainId, hash, timeout = 1500 * 15, shouldStop) {
    // With no RPC for this chain getPublicClient builds fallback([]), whose very
    // first request throws a TypeError on the missing transport — and the
    // "receipt not found yet" catch below would swallow it, spinning out the
    // whole timeout doing nothing. Give up straight away instead.
    if (!this.getListRpc(chainId).length) throw new Error(TX_TRACK_TIMEOUT)

    const client = this.getPublicClient(chainId)
    const interval = 1500
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      // Checked OUTSIDE the try below, so the cancel isn't swallowed by the
      // "receipt not found yet" handler and mistaken for a still-pending tx.
      if (shouldStop?.()) throw new Error(TX_TRACK_CANCELLED)

      try {
        const receipt = await client.getTransactionReceipt({ hash })

        if (receipt) {
          if (receipt.status === 'success') {
            return receipt
          }

          if (receipt.status === 'reverted') {
            throw new Error(TX_TRACK_REVERTED)
          }
        }
      } catch (error) {
        // viem THROWS TransactionReceiptNotFoundError for a tx that is still
        // pending — the normal case here, so swallow it and poll again. Without
        // this catch the loop dies on the very first poll of any unmined tx.
        if (error?.message === TX_TRACK_REVERTED) throw error
      }

      await sleep(interval)
    }

    throw new Error(TX_TRACK_TIMEOUT)
  }

  /**
   * @param {} chainId
   * @param {Array<{abi: Array, address: string, functionName: string, args?: Array}>} calls
   * @returns {Promise<Array<{status: string, result?: *, error?: Error}>>} viem
   *   multicall shape on every chain: `{ status: 'success', result }` or
   *   `{ status: 'failure', error }` per call.
   */
  static async readMulticall (chainId, calls = []) {
    const client = this.getPublicClient(chainId)

    // Chains without Multicall3 deployed can't answer a batched call — read each
    // contract one-by-one instead. Same output shape as viem's multicall, so
    // every caller (status/result access) works unchanged. Each read is its own
    // RPC request, so they're metered by pLimit (10 in flight per chain at most)
    // to avoid tripping the endpoint's requests-per-second limit.
    // 4663 is chain robinhood, which has a Multicall3 address but the RPC doesn't support it (returns 405 Method Not Allowed). So treat it like a chain without Multicall3.
    if (!MULTICALL3_CHAIN_IDS.has(Number(chainId)) && Number(chainId) !== 4663) {
      const readLimit = getReadLimiter(chainId)
      return Promise.all(
        calls.map((call) =>
          readLimit(async () => {
            try {
              const result = await client.readContract(call)
              return { status: 'success', result }
            } catch (error) {
              return { status: 'failure', error }
            }
          })
        )
      )
    }

    return client.multicall({
      contracts: calls,
      allowFailure: true,
      multicallAddress: MULTICALL3_ADDRESS
    })
  }

  // Single contract read. The public client uses a fallback() transport with
  // per-URL retry, so RPC failover is handled by the transport. Throws on
  // failure (caller catches + defaults).
  static async readContract (chainId, { address, abi, functionName, args = [] }) {
    const client = this.getPublicClient(chainId)
    return client.readContract({ address, abi, functionName, args })
  }

  static async getInfoToken (chainId, tokenAddress) {
    try {
      const calls = [
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'symbol'
        },
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'name'
        },
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'decimals'
        }
      ]

      const result = await this.readMulticall(chainId, calls)
      return {
        symbol: result[0].result,
        name: result[1].result,
        decimals: result[2].result
      }
    } catch (error) {
      return null
    }
  }

  static async getBalanceToken (chainId, addressUser, tokenAddress, isConvertBalance = true) {
    const isNative = isNativeToken(tokenAddress)
    let balance

    if (isNative) {
      balance = await this.getPublicClient(chainId).getBalance({ address: addressUser })
      if (isConvertBalance) {
        balance = convertWeiToBalance(balance)
      }
    } else {
      const calls = [
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'decimals'
        },
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'balanceOf',
          args: [addressUser]
        }
      ]

      const [decimals, balanceResult] = await this.readMulticall(chainId, calls)
      balance = balanceResult.result

      if (isConvertBalance) {
        balance = convertWeiToBalance(balance, decimals.result)
      }
    }

    return balance
  }

  static async simulateTransaction (chainId, privateKey, rawTransaction) {
    try {
      const {
        to,
        data = '0x',
        value = BigInt(0),
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit
      } = rawTransaction

      const account = privateKeyToAccount(`0x${privateKey}`)
      const client = this.getPublicClient(chainId)

      const txRequest = {
        to,
        data,
        value
      }

      if (maxPriorityFeePerGas && maxFeePerGas) {
        txRequest.maxPriorityFeePerGas = BigInt(maxPriorityFeePerGas.toString())
        txRequest.maxFeePerGas = BigInt(maxFeePerGas.toString())
      }

      if (gasLimit) {
        txRequest.gas = BigInt(BigNumber(gasLimit).decimalPlaces(0).toFixed())
      }

      if (typeof txRequest.value === 'string') {
        txRequest.value = BigInt(BigNumber(txRequest.value).toString())
      }

      // `call` simulates tx: throws with revert reason if tx fails, returns data if OK
      const { data: result } = await client.call({
        ...txRequest,
        stateOverride: [
          {
            address: account.address,
            balance: maxUint256
          }
        ]
      })

      return { success: true, data: result }
    } catch (error) {
      // console.log({ simulateTransactionViem: error })
      return { success: false, error }
    }
  }

  static async sendTransaction (chainId, privateKey, rawTransaction) {
    const {
      to,
      data = '0x',
      percent = 1.1,
      maxPriorityFeePerGas,
      maxFeePerGas,
      value = BigInt(0),
      callback,
      gasLimit,
      noEstimateGas = false,
      nonce = null,
      noGasPrice = false
    } = rawTransaction

    const account = privateKeyToAccount(`0x${privateKey}`)

    const walletClient = this.getWalletClient(chainId)
    const client = this.getPublicClient(chainId)

    const txRequest = {
      from: account.address,
      to,
      data,
      value
    }
    if (!noGasPrice) {
      if (maxPriorityFeePerGas && maxFeePerGas) {
        const maxPriorityFeePerGas = BigNumber(txRequest.maxPriorityFeePerGas.toString()).toString()

        const maxFeePerGas = BigNumber(txRequest.maxFeePerGas.toString()).toString()

        txRequest.maxPriorityFeePerGas = BigInt(maxPriorityFeePerGas)
        txRequest.maxFeePerGas = BigInt(maxFeePerGas)
      } else {
        const gasPriceDefault = await client.getGasPrice()
        const gasCustom = BigNumber(gasPriceDefault.toString())
          .multipliedBy(percent)
          .decimalPlaces(0)
          .toString()

        txRequest.gasPrice = BigInt(gasCustom)
      }
    }

    if (nonce) {
      txRequest.nonce = nonce
    } else {
      txRequest.nonce = await client.getTransactionCount({ address: account.address })
    }

    if (gasLimit) {
      txRequest.gas = BigInt(BigNumber(gasLimit).multipliedBy(percent).decimalPlaces(0).toFixed())
      txRequest.gasLimit = BigInt(BigNumber(gasLimit).multipliedBy(percent).decimalPlaces(0).toFixed())
    }

    if (!noEstimateGas && !txRequest.gas) {
      const gas = await walletClient.estimateGas({
        account: txRequest.from,
        ...txRequest
      })

      const gasCustom = BigNumber(gas.toString())
        .multipliedBy(percent)
        .decimalPlaces(0)
        .toString()

      txRequest.gas = BigInt(gasCustom)
      txRequest.gasLimit = BigInt(gasCustom)
    }
    if (typeof txRequest.value === 'string') {
      txRequest.value = BigInt(txRequest.value)
    }

    const hash = await walletClient.sendTransaction({
      account,
      ...txRequest
    })

    if (hash && hash?.startsWith('0x')) {
      callback?.(hash)
    }

    const receipt = await walletClient.waitForTransactionReceipt({ hash })

    if (receipt?.status === 'reverted') {
      throw new Error('TX_FAILED')
    }

    return receipt.transactionHash
  }
}

export default ViemWeb3
