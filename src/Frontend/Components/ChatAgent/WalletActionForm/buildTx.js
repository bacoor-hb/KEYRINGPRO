import { encodeFunctionData } from 'viem'
import { convertBalanceToWei, generateDataToken } from 'common/function'

// Unsigned-tx builders for the in-chat wallet actions. Each returns the array
// `useSendTx` broadcasts — `{ to, data, value }` where `value` is a DECIMAL
// native amount (postBaseSendTxs converts it to wei) and `data` is already
// ABI-encoded calldata.
//
// They live here rather than in the form components so the forms stay purely
// declarative (fields in, message out) and each encoder can be read/tested on
// its own.

// An "unlimited" ERC-20 allowance — max uint256, the same value the wallet's
// own approve flows grant when the user doesn't cap the amount.
export const MAX_UINT256 = '0x' + 'f'.repeat(64)

// Native coin (ETH/BNB/MATIC/…): a plain value transfer, no calldata.
export const buildNativeTx = ({ toAddress, amount }) => [{
  to: toAddress,
  data: '0x',
  value: amount
}]

// ERC-20 `transfer(to, amount)`. Reuses the hand-rolled encoder the Send Token
// screen uses, so the calldata is byte-identical to a normal in-app send.
export const buildTokenTransferTx = ({ contractAddress, toAddress, amount, decimals = 18 }) => [{
  to: contractAddress,
  data: generateDataToken(convertBalanceToWei(amount, decimals), toAddress)
}]

// ERC-20 `approve(spender, value)`. An empty amount means UNLIMITED (max
// uint256) and "0" is a revoke — both are just values here; the form decides.
export const buildApproveTx = ({ contractAddress, spenderAddress, amount, decimals = 18 }) => [{
  to: contractAddress,
  data: encodeFunctionData({
    abi: [{
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }]
    }],
    functionName: 'approve',
    args: [
      spenderAddress,
      amount === '' || amount == null
        ? BigInt(MAX_UINT256)
        : BigInt(convertBalanceToWei(amount, decimals))
    ]
  })
}]

// Plain `transferFrom`, not `safeTransferFrom`: the safe variant calls
// `onERC721Received` on the recipient and reverts if a contract doesn't
// implement it. Recipients here are addresses the user typed, so the unchecked
// transfer is the one that behaves predictably.
const ERC721_TRANSFER_ABI = [{
  name: 'transferFrom',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'tokenId', type: 'uint256' }
  ],
  outputs: []
}]

const ERC1155_SAFE_TRANSFER_ABI = [{
  name: 'safeTransferFrom',
  type: 'function',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'id', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'data', type: 'bytes' }
  ],
  outputs: []
}]

// NFT transfer. The two standards need different calls: ERC-721 uses
// `transferFrom(from, to, tokenId)`, while ERC-1155 only offers
// `safeTransferFrom` and carries an edition count + a data blob. The standard
// the agent resolved picks between them; editions default to 1 (an ERC-721 is
// always a single token).
export const buildNftTransferTx = ({ contractAddress, fromAddress, toAddress, tokenId, amount, isErc1155 }) => [{
  to: contractAddress,
  data: isErc1155
    ? encodeFunctionData({
      abi: ERC1155_SAFE_TRANSFER_ABI,
      functionName: 'safeTransferFrom',
      args: [fromAddress, toAddress, BigInt(tokenId), BigInt(amount || 1), '0x']
    })
    : encodeFunctionData({
      abi: ERC721_TRANSFER_ABI,
      functionName: 'transferFrom',
      args: [fromAddress, toAddress, BigInt(tokenId)]
    })
}]
