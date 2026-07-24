import BigNumber from 'bignumber.js'
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
  return NON_FAILOVER_ERRORS.some((err) => err.nodeMessage?.test(message))
}

class ViemWeb3 {
  static getChainSettingInApp (chainId) {
    const data = settings().web3Link
    const chain = Object.values(data).find(chain => {
      return chain.chainId?.toString() === chainId?.toString()
    })
    return chain
  }

  /**
 * Get list RPC sorted by priority
 * @param {*} chainId
 * @returns {string[]}
 * @Note Priority: rpcCustom > rpcUrlPaid > rpcMoreBackup
 */
  static getListRpc (chainId) {
    const chainSettingInApp = this.getChainSettingInApp(chainId)
    const rpcUrlPaid = chainSettingInApp?.linkProvider || ''

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

  static async trackingTx (chainId, hash, timeout = 160000) {
    const client = this.getPublicClient(chainId)
    const interval = 1500
    let elapsedTime = 0

    while (elapsedTime < timeout) {
      try {
        const receipt = await client.getTransactionReceipt({ hash })

        if (receipt) {
          if (receipt.status === 'success') {
            return receipt
          }
        }
      } catch (error) {
        if (error.message === 'TX_REVERTED') throw error
      }

      elapsedTime += interval
      await sleep(interval)
    }

    throw new Error('TX_TIMEOUT')
  }

  /**
   * @param {} chainId
   * @param {Array<{abi: Array, address: string, functionName: string, args?: Array}>} calls
   * @returns
   */
  static readMulticall (chainId, calls = []) {
    const client = this.getPublicClient(chainId)
    const result = client.multicall({
      contracts: calls,
      allowFailure: true,
      multicallAddress: MULTICALL3_ADDRESS
    })
    return result
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
      noEstimateGas = false
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

    if (maxPriorityFeePerGas && maxFeePerGas) {
      const maxPriorityFeePerGas = BigNumber(txRequest.maxPriorityFeePerGas.toString())
        .multipliedBy(percent)
        .decimalPlaces(0)
        .toString()

      const maxFeePerGas = BigNumber(txRequest.maxFeePerGas.toString())
        .multipliedBy(percent)
        .decimalPlaces(0)
        .toString()

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

    if (gasLimit) {
      txRequest.gas = BigInt(BigNumber(gasLimit).multipliedBy(percent).decimalPlaces(0).toFixed())
      txRequest.gasLimit = BigInt(BigNumber(gasLimit).multipliedBy(percent).decimalPlaces(0).toFixed())
    }

    if (!noEstimateGas && !txRequest.gas) {
      const gas = await walletClient.estimateGas(txRequest)
      txRequest.gas = gas
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

    callback?.(hash)
    const receipt = await this.trackingTx(chainId, hash)
    return receipt.transactionHash
  }
}

export default ViemWeb3
