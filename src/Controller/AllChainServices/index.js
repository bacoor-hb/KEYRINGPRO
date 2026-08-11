import {
  convertWeiToBalance,
  convertBalanceToWei,
  generateDataToken,
  scientificToDecimal,
  isValidContract
} from 'common/function'
import { ethers } from 'ethers'
import BigNumber from 'bignumber.js'
import { LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_UNISWAP, LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_PANCAKESWAP, typeLiquidityPool } from 'common/constants/chain'
import { numberToHex, encodeFunctionData } from 'viem'

import ViemWeb3 from 'src/Web3/ViemWeb3'

/**
 * Where to setting all function which can used by all chain
 */
export default class AllChainServices {
  static async getBalanceByChain (chainTypeOrChainId, address, isFormatBalance = true) {
    try {
      const balanceRaw = await ViemWeb3.getPublicClient(chainTypeOrChainId).getBalance({ address })
      const balance = balanceRaw != null ? balanceRaw.toString() : '0'
      return isFormatBalance ? scientificToDecimal(convertWeiToBalance(balance)) : balance
    } catch (error) {
      return 0
    }
  }

  static async signTypedData (privateKey, message) {
    try {
      const ethWallet = new ethers.Wallet(privateKey)

      if (ethWallet) {
        const formatMessage = JSON.parse(message)

        const { domain, types, message: data } = formatMessage
        delete types.EIP712Domain

        const signedData = await ethWallet._signTypedData(domain, types, data)
        return signedData
      } else {
        return ''
      }
    } catch (e) {
      return ''
    }
  }

  static async signPersionalMessage (privateKey, message) {
    try {
      const ethWallet = new ethers.Wallet(privateKey)
      if (ethWallet) {
        const signature = await ethWallet.signMessage(
          ethers.utils.isHexString(message) ? ethers.utils.arrayify(message) : message
        )
        return signature
      } else {
        return ''
      }
    } catch (e) {
      return ''
    }
  }

  static async signTransaction (privateKey, payload, isWaitDone = false, chainId, isNeedSignTxOnly = false) {
    return new Promise(async (resolve, reject) => {
      try {
        const generateTxs = {
          to: payload.to,
          nonce: payload.nonce,
          gasLimit: payload.gasLimit,
          gasPrice: payload.gasPrice,
          data: payload.data
        }

        if (payload.chainId) {
          generateTxs.chainId = payload.chainId
        }

        if (payload.value) {
          generateTxs.valueNoConvert = payload.value
        }

        if (payload.percent) {
          generateTxs.percent = payload.percent
        }

        this.postBaseSendTxsForWalletConnect(chainId, privateKey, [generateTxs], false, null, null, isNeedSignTxOnly).then((result) => {
          resolve(result[0])
        }).catch(err => {
          reject(err)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  static async estimateGasTxs (chainIdOrChainType, rawTransaction) {
    try {
      const client = ViemWeb3.getPublicClient(chainIdOrChainType)

      // Normalize the raw tx (from + hex value/gasPrice) into the client's shape
      // (account + BigInt value/gasPrice). Callers may omit value/gasPrice — e.g.
      // gas is estimated WITHOUT gasPrice on purpose (see postBaseSendTxs) so the
      // node doesn't prepay gas and shrink the simulated balance.
      const { to, from, data, value, gasPrice } = rawTransaction || {}
      const params = {}
      if (to) params.to = to
      if (data) params.data = data
      if (from) params.account = from
      if (value != null && value !== '') params.value = BigInt(value)
      if (gasPrice != null) params.gasPrice = BigInt(gasPrice)

      const gas = await client.estimateGas(params)
      // Return a Number so BigNumber(...).multipliedBy(gas) works
      // (BigNumber can't multiply by a BigInt).
      return Number(gas)
    } catch (err) {
      // The 0 return tells the caller nothing about WHY (revert vs unreachable
      // RPC vs a malformed param), so log the real reason in dev — every
      // "this transaction cannot be completed" traces back to here.
      if (__DEV__) console.log('[estimateGasTxs] failed', { chainIdOrChainType, rawTransaction, message: err?.shortMessage || err?.message, err })
      return 0
    }
  }

  static async postBaseSendTxsForWalletConnect (chainTypeOrChainId, privateKey, arrSend, isWaitDone, callback, isNeedConvertBanlanceToWei = false, isNeedSignTxOnly = false) {
    return new Promise(async (resolve, reject) => {
      const ethWallet = new ethers.Wallet(privateKey)

      const promise = arrSend.map(async (item, index) => {
        return new Promise(async (resolve, reject) => {
          try {
            const { to, data, value, valueNoConvert, nonce, gasPrice, gasLimit, percent } = item

            let gasPriceCustom
            const nonceFinal = await this.getTransactionCount(chainTypeOrChainId, ethWallet.address)

            if (!gasPrice) {
              gasPriceCustom = await this.getGasPrice(chainTypeOrChainId)
              gasPriceCustom = `0x${gasPriceCustom.toString(16)}`
            }

            const rawTransaction = {
              nonce: nonceFinal >= 0 ? `0x${nonceFinal.toString(16)}` : nonce,
              to,
              from: ethWallet.address,
              gasPrice: gasPrice || gasPriceCustom,
              data
            }

            if (percent) {
              rawTransaction.gasPrice = new BigNumber(rawTransaction.gasPrice * percent).decimalPlaces(0, 1)
              rawTransaction.gasPrice = '0x' + (rawTransaction.gasPrice).toString(16)
            }

            if (value) {
              if (isNeedConvertBanlanceToWei) {
                rawTransaction.value = convertBalanceToWei(value)
              } else {
                rawTransaction.value = numberToHex(BigInt(valueNoConvert || convertBalanceToWei(value)))
              }
            } else if (valueNoConvert) {
              rawTransaction.value = valueNoConvert
            }

            if (gasLimit) {
              rawTransaction.gasLimit = gasLimit
            } else {
              const gasLimitResult = await this.estimateGasTxs(chainTypeOrChainId, rawTransaction)
              rawTransaction.gasLimit = '0x' + gasLimitResult.toString(16)
            }

            rawTransaction.chainId = Number(chainTypeOrChainId)

            delete rawTransaction.from
            const signedTransaction = await ethWallet.signTransaction(rawTransaction)

            if (isNeedSignTxOnly) {
              callback && callback(signedTransaction)
              resolve(signedTransaction)
              return
            }

            // Use new retry mechanism
            this.sendSignedTransactionWithRetry(chainTypeOrChainId, signedTransaction, isWaitDone, callback)
              .then(result => resolve(result))
              .catch(err => reject(err))
          } catch (error) {
            reject(error)
          }
        })
      })

      Promise.all(promise).then(result => {
        resolve(result)
      }).catch(err => {
        reject(err)
      })
    })
  }

  static async getTokenDecimal (chain, contractAddress) {
    try {
      const decimals = await ViemWeb3.readContract(chain, {
        address: contractAddress,
        abi: [{ inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }],
        functionName: 'decimals'
      })
      return decimals != null ? decimals.toString() : ''
    } catch (error) {
      return ''
    }
  }

  static async getTokenSymbol (chain, contractAddress) {
    try {
      const symbol = await ViemWeb3.readContract(chain, {
        address: contractAddress,
        abi: [{ inputs: [], name: 'symbol', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }],
        functionName: 'symbol'
      })
      return symbol ?? ''
    } catch (error) {
      return ''
    }
  }

  static async getTokenName (chain, contractAddress) {
    try {
      const name = await ViemWeb3.readContract(chain, {
        address: contractAddress,
        abi: [{ inputs: [], name: 'name', outputs: [{ type: 'string' }], stateMutability: 'view', type: 'function' }],
        functionName: 'name'
      })
      return name ?? ''
    } catch (error) {
      return ''
    }
  }

  static async getTokenDecimalByChain (chainTypeOrChainId, contractAddress) {
    try {
      const decimals = await ViemWeb3.readContract(chainTypeOrChainId, {
        address: contractAddress,
        abi: [{ inputs: [], name: 'decimals', outputs: [{ type: 'uint8' }], stateMutability: 'view', type: 'function' }],
        functionName: 'decimals'
      })
      return decimals != null ? Number(decimals) : 18
    } catch (error) {
      return 18
    }
  }

  /*
  For contract just need decimal and address only *Only in send token*
  */
  //
  static async sendEthTokenTxs (chainTypeOrChainId, payload, privateKey, callback) {
    return new Promise(async (resolve, reject) => {
      try {
        const isSendToken = payload.contractAddress

        const generateTxs = {
          to: payload.contractAddress || payload.toAddress,
          gasPrice: payload.gasPrice,
          data: '0x'
        }

        // sending erc20 token
        if (isSendToken) {
          const amountConvert = convertBalanceToWei(payload.amount, payload.tokenDecimal)
          generateTxs.data = generateDataToken(amountConvert, payload.toAddress)
        } else {
          generateTxs.value = payload.amount
        }

        if (payload.percentGas) {
          generateTxs.percent = (payload.percentGas / 100)
        }

        this.postBaseSendTxs(chainTypeOrChainId, privateKey, [generateTxs], false, callback).then((result) => {
          resolve(result[0])
        }).catch(err => {
          reject(err)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  static async getGasPrice (chain, percent = 1.1) {
    try {
      const gasPrice = await ViemWeb3.getPublicClient(chain).getGasPrice()
      // viem returns a BigInt; keep the math in BigNumber (bigint * number throws)
      return new BigNumber(gasPrice.toString()).multipliedBy(percent).decimalPlaces(0, 1)
    } catch (err) {
      return 0
    }
  }

  static async getTransactionCount (chain, userAddress) {
    try {
      // viem returns a number for the nonce (blockTag defaults to 'latest')
      return await ViemWeb3.getPublicClient(chain).getTransactionCount({ address: userAddress })
    } catch (_error) {
      return -1
    }
  }

  static async getChainId (chainTypeOrChainId) {
    try {
      // viem returns a number chainId, which ethers accepts when signing
      return await ViemWeb3.getPublicClient(chainTypeOrChainId).getChainId()
    } catch (err) {
      return 0
    }
  }

  // Encode ERC20 transfer(recipient, 0) calldata. Pure ABI encoding — no RPC
  // (used only to size a tx for gas / L1-fee estimation). First arg kept for
  // call-site compatibility; not needed for encoding.
  static generateDataTx (chainTypeOrChainId, contractAddress, addressFrom) {
    try {
      return encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'recipient', type: 'address' },
              { name: 'value', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
          }
        ],
        functionName: 'transfer',
        args: [addressFrom, 0n]
      })
    } catch (e) {
      return null
    }
  }

  static async checkAllowance (chain, coinContract, owner, spender) {
    try {
      const allowance = await ViemWeb3.readContract(chain, {
        address: coinContract,
        abi: [{ constant: true, inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'allowance',
        args: [owner, spender]
      })
      return allowance != null ? allowance.toString() : 0
    } catch (err) {
      return 0
    }
  }

  static async checkIsNeedApproveToken (chain, userAddress, tokenAddress, contractAddress, amount, tokenDecimals = 18) {
    const allowance = await this.checkAllowance(chain, tokenAddress, userAddress, contractAddress)
    return Number(allowance) < Number(convertBalanceToWei(amount, tokenDecimals))
  }

  static async postBaseSendTxsForSwap (chainId, privateKey, rawTransaction) {
    return ViemWeb3.sendTransaction(chainId, privateKey, rawTransaction)
  }

  static async sendSignedTransactionWithRetry (chain, signedTransaction, isWaitDone, callback) {
    // Broadcast an already-signed raw tx. The public client's fallback() transport
    // stops on deterministic tx rejections (insufficient funds, nonce too low, ...)
    // instead of failing over to another RPC and re-broadcasting; only genuine
    // network errors fall over (see shouldStopFailover in ViemWeb3).
    const client = ViemWeb3.getPublicClient(chain)

    const hash = await client.sendRawTransaction({ serializedTransaction: signedTransaction })

    if (!isWaitDone) {
      callback && callback(hash)
      return hash
    }

    const receipt = await client.waitForTransactionReceipt({ hash })
    callback && callback(receipt.transactionHash)
    return receipt.transactionHash
  }

  static async postBaseSendTxs (chainTypeOrChainId, privateKey, arrSend, isWaitDone, callback, isNeedConvertBanlanceToWei = false) {
    return new Promise(async (resolve, reject) => {
      const ethWallet = new ethers.Wallet(privateKey)

      const nonce = await this.getTransactionCount(chainTypeOrChainId, ethWallet.address)
      const promise = arrSend.map(async (item, index) => {
        return new Promise(async (resolve, reject) => {
          try {
            const { to, data, value, percent, valueNoConvert, gasPrice } = item

            const gasPriceFinal = gasPrice || await this.getGasPrice(chainTypeOrChainId)

            const rawTransaction = {
              nonce: nonce + index,
              to,
              from: ethWallet.address,
              gasPrice: gasPriceFinal,
              data
            }

            if (percent) {
              rawTransaction.gasPrice = new BigNumber(rawTransaction.gasPrice * percent).decimalPlaces(0, 1)
            }

            // Normalize gasPrice to a hex string so ethers can serialize it when
            // signing. getGasPrice / the percent bump produce a bignumber.js
            // instance, which ethers can't hexlify. Gas is estimated on a copy of
            // the tx, so normalize the shared rawTransaction explicitly here. Pass
            // through values that are already 0x-hex.
            if (rawTransaction.gasPrice != null &&
              !(typeof rawTransaction.gasPrice === 'string' && rawTransaction.gasPrice.startsWith('0x'))) {
              rawTransaction.gasPrice = numberToHex(BigInt(new BigNumber(rawTransaction.gasPrice).toFixed(0)))
            }

            if (value || valueNoConvert) {
              if (isNeedConvertBanlanceToWei) {
                rawTransaction.value = convertBalanceToWei(value)
              } else {
                rawTransaction.value = numberToHex(BigInt(valueNoConvert || convertBalanceToWei(value)))
              }
            }

            // eth_estimateGas without a `gas` field makes the node use the block
            // gas limit and PREPAY gas (= gasLimit × gasPrice) from the sender
            // BEFORE simulating the value transfer. On strict nodes (e.g. Celo)
            // that prepayment isn't recapped to the balance first, so block-limit ×
            // gasPrice can swallow almost the whole balance, leaving ~0 for the
            // actual transfer → reverts "transfer value exceeded balance of sender"
            // even for a tiny value. Estimating WITHOUT gasPrice makes the
            // prepayment 0, so the transfer simulates against the full balance. Gas
            // used is independent of gasPrice; we still sign/broadcast with it.
            const estimateTx = { ...rawTransaction }
            delete estimateTx.gasPrice

            this.estimateGasTxs(chainTypeOrChainId, estimateTx).then(async (gasLimit) => {
              rawTransaction.gasLimit = '0x' + gasLimit.toString(16)

              rawTransaction.chainId = await this.getChainId(chainTypeOrChainId)

              // delete rawTransaction.chainId
              // delete rawTransaction.from

              const signedTransaction = await ethWallet.signTransaction(rawTransaction)

              // Use new retry mechanism
              this.sendSignedTransactionWithRetry(chainTypeOrChainId, signedTransaction, isWaitDone, callback)
                .then(result => resolve(result))
                .catch(err => reject(err))
            }).catch((err) => {
              reject(err)
            })
          } catch (error) {
            reject(error)
          }
        })
      })

      Promise.all(promise).then(result => {
        resolve(result)
      }).catch(err => {
        reject(err)
      })
    })
  }

  static async getTokenBalanceByChain (chainTypeOrChainId, contractAddress, address, decimalToken, isFormatBalance = true) {
    try {
      const balanceRaw = await ViemWeb3.readContract(chainTypeOrChainId, {
        address: contractAddress,
        abi: [{ constant: true, inputs: [{ name: '_owner', type: 'address' }], name: 'balanceOf', outputs: [{ name: 'balance', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'balanceOf',
        args: [address]
      })
      const balance = balanceRaw != null ? balanceRaw.toString() : '0'

      if (!isFormatBalance) return balance

      const tokenDecimal = decimalToken || await this.getTokenDecimalByChain(chainTypeOrChainId, contractAddress)
      return scientificToDecimal(convertWeiToBalance(balance, tokenDecimal))
    } catch (error) {
      return 0
    }
  }

  static async getTokenOfOwnerByInitByChain (chainTypeOrChainId, contractAddress, address, index = 0) {
    try {
      const tokenId = await ViemWeb3.readContract(chainTypeOrChainId, {
        address: contractAddress,
        abi: [{ inputs: [{ internalType: 'address', name: 'owner', type: 'address' }, { internalType: 'uint256', name: 'index', type: 'uint256' }], name: 'tokenOfOwnerByIndex', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'tokenOfOwnerByIndex',
        args: [address, BigInt(index)]
      })
      return tokenId != null ? tokenId.toString() : 0
    } catch (error) {
      return 0
    }
  }

  static async getTokenBalanceOfPositionByChain (chainTypeOrChainId, contractAddress, address) {
    try {
      const balance = await ViemWeb3.readContract(chainTypeOrChainId, {
        address: contractAddress,
        abi: [{ inputs: [{ internalType: 'address', name: 'owner', type: 'address' }], name: 'balanceOf', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'balanceOf',
        args: [address]
      })
      return balance != null ? balance.toString() : 0
    } catch (error) {
      return 0
    }
  }

  static async getPositionsByChain (chainTypeOrChainId, contractAddress, tokenId) {
    return new Promise(async (resolve, reject) => {
      try {
        const minABI = [
          {
            inputs: [
              {
                internalType: 'uint256',
                name: 'tokenId',
                type: 'uint256'
              }
            ],
            name: 'positions',
            outputs: [
              {
                internalType: 'uint96',
                name: 'nonce',
                type: 'uint96'
              },
              {
                internalType: 'address',
                name: 'operator',
                type: 'address'
              },
              {
                internalType: 'address',
                name: 'token0',
                type: 'address'
              },
              {
                internalType: 'address',
                name: 'token1',
                type: 'address'
              },
              {
                internalType: 'uint24',
                name: 'fee',
                type: 'uint24'
              },
              {
                internalType: 'int24',
                name: 'tickLower',
                type: 'int24'
              },
              {
                internalType: 'int24',
                name: 'tickUpper',
                type: 'int24'
              },
              {
                internalType: 'uint128',
                name: 'liquidity',
                type: 'uint128'
              },
              {
                internalType: 'uint256',
                name: 'feeGrowthInside0LastX128',
                type: 'uint256'
              },
              {
                internalType: 'uint256',
                name: 'feeGrowthInside1LastX128',
                type: 'uint256'
              },
              {
                internalType: 'uint128',
                name: 'tokensOwed0',
                type: 'uint128'
              },
              {
                internalType: 'uint128',
                name: 'tokensOwed1',
                type: 'uint128'
              }
            ],
            stateMutability: 'view',
            type: 'function'
          }
        ]
        const r = await ViemWeb3.readContract(chainTypeOrChainId, {
          address: contractAddress,
          abi: minABI,
          functionName: 'positions',
          args: [BigInt(tokenId)]
        })

        // Multi-output results come back as an array; map them into a named
        // struct (callers read fields like `.liquidity`). Numeric fields are
        // stringified so callers receive string values.
        resolve({
          nonce: r[0]?.toString(),
          operator: r[1],
          token0: r[2],
          token1: r[3],
          fee: r[4]?.toString(),
          tickLower: r[5]?.toString(),
          tickUpper: r[6]?.toString(),
          liquidity: r[7]?.toString(),
          feeGrowthInside0LastX128: r[8]?.toString(),
          feeGrowthInside1LastX128: r[9]?.toString(),
          tokensOwed0: r[10]?.toString(),
          tokensOwed1: r[11]?.toString()
        })
      } catch (error) {
        resolve(0)
      }
    })
  }

  static async checkIsContractERC20 (chainTypeOrChainId, contractAddress) {
    const minAbi = [{
      inputs: [
        {
          internalType: 'bytes4',
          name: 'interfaceId',
          type: 'bytes4'
        }
      ],
      name: 'supportsInterface',
      outputs: [
        {
          internalType: 'bool',
          name: '',
          type: 'bool'
        }
      ],
      stateMutability: 'view',
      type: 'function'
    }]

    try {
      const isContract = await isValidContract(chainTypeOrChainId, contractAddress)
      if (!isContract) return false

      const chainId = chainTypeOrChainId
      try {
        // ERC721 (0x80ac58cd) or ERC1155 (0xd9b67a26) → not an ERC20
        const isERC721 = await ViemWeb3.readContract(chainId, { address: contractAddress, abi: minAbi, functionName: 'supportsInterface', args: ['0x80ac58cd'] })
        if (isERC721) return false
        const isERC1155 = await ViemWeb3.readContract(chainId, { address: contractAddress, abi: minAbi, functionName: 'supportsInterface', args: ['0xd9b67a26'] })
        if (isERC1155) return false
        return true
      } catch (e) {
        // supportsInterface reverts on plain ERC20s → fall back to decimals()
        const decimals = await AllChainServices.getTokenDecimalByChain(chainTypeOrChainId, contractAddress)
        return decimals >= 0
      }
    } catch (err) {
      return false
    }
  }

  static async estimateL1DataFee (isMainToken, targetChainType, userAddress, tokenAddress) {
    const gasPriceOracleContract = '0x420000000000000000000000000000000000000F'

    try {
      let rawTransactionForEstimateGas
      if (isMainToken) {
        rawTransactionForEstimateGas = {
          to: userAddress
        }
      } else {
        const dataTx = await AllChainServices.generateDataTx(targetChainType, tokenAddress, userAddress)
        rawTransactionForEstimateGas = {
          to: tokenAddress,
          data: dataTx
        }
      }
      const txDataSize = ethers.utils.serializeTransaction(rawTransactionForEstimateGas)

      const value = await ViemWeb3.readContract(targetChainType, {
        address: gasPriceOracleContract,
        abi: [{ inputs: [{ internalType: 'bytes', name: '_data', type: 'bytes' }], name: 'getL1Fee', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' }],
        functionName: 'getL1Fee',
        args: [txDataSize]
      })
      return value != null ? value.toString() : 0
    } catch (error) {
      return 0
    }
  }

  static async getTickSpacing (chain, contractAddress) {
    try {
      const tickSpacing = await ViemWeb3.readContract(chain, {
        address: contractAddress,
        abi: [{ inputs: [], name: 'tickSpacing', outputs: [{ internalType: 'int24', name: '', type: 'int24' }], stateMutability: 'view', type: 'function' }],
        functionName: 'tickSpacing'
      })
      return tickSpacing != null ? tickSpacing.toString() : ''
    } catch (error) {
      return ''
    }
  }

  // Reads the on-chain NFT name for a Uniswap/Pancake V3 position by calling
  // tokenURI(tokenId) on the position-manager contract and decoding its
  // data:application/json;base64 payload. The name is the exact string the NFT
  // renders, e.g. "Uniswap - 0.3% - VIRTUAL/WETH - 2270.2<>3413.8". Returns '' on
  // any failure (unsupported chain, RPC error, unexpected URI shape).
  static async getPositionNftName (chainId, tokenId, type = typeLiquidityPool.uniswap) {
    try {
      if (chainId == null || tokenId == null) return ''
      const addressMap = type === typeLiquidityPool.pancakeswap
        ? LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_PANCAKESWAP
        : LIST_ADDRESS_CONTRACT_POSITION_LIQUIDITY_POOL_UNISWAP
      const positionManager = addressMap[Number(chainId)]
      if (!positionManager) return ''

      const uri = await ViemWeb3.readContract(chainId, {
        address: positionManager,
        abi: [{ inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }], name: 'tokenURI', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' }],
        functionName: 'tokenURI',
        args: [BigInt(tokenId)]
      })
      if (!uri) return ''

      const base64Marker = 'base64,'
      const idx = uri.indexOf(base64Marker)
      if (idx === -1) return ''
      const jsonStr = Buffer.from(uri.slice(idx + base64Marker.length), 'base64').toString('utf-8')
      const meta = JSON.parse(jsonStr)
      return meta?.name || ''
    } catch (error) {
      return ''
    }
  }
}
