import BigNumber from 'bignumber.js'
import I18n, { resolveLocale } from 'assets/Lang'
import ViemWeb3 from 'src/Web3/ViemWeb3'

// Per-action "first check": the one thing that has to be true on-chain before a
// given action can possibly succeed, asked directly rather than inferred.
//
// `useSendTx`'s generic pre-flight (gas estimate + fee coverage) already catches
// these indirectly — a transfer of more than you hold reverts, so the estimate
// fails — but it can only report the non-committal "this transaction cannot be
// completed", because estimateGasTxs swallows the revert reason. Asking the
// specific question first buys a specific message: which balance is short, by
// how much, or that the NFT isn't yours.
//
// Reads go through ViemWeb3, so they inherit the app's standard RPC handling:
// a viem `fallback` transport over the full ordered RPC list (paid endpoint
// first, public backups after), rotating on failure.
//
// Each check returns null when the action is good to go, or a ready-to-show
// error string. They are deliberately permissive about their OWN failures: the
// read helpers resolve to 0/'0' both for "really zero" and for "no RPC
// reachable", so a zero reading is never allowed to block on its own — only a
// balance we positively read can fail the check. The gas estimate downstream
// stays the final gate.

const tr = (key, language, opts) =>
  I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(language) })

// The agent hands us a HEX chain id ("0xa"), but the chain catalog
// (blockchainListRedux, via getChainInfo) is keyed by the DECIMAL number — a raw
// hex key misses, which would leave the RPC list empty and fail every read here.
// Normalize once, at the boundary, so everything downstream looks it up as a
// number. Same reason useSendTx does `Number(chainId)` for the native symbol.
const toChainId = (chainId) => {
  const n = Number(chainId)
  return Number.isFinite(n) ? n : chainId
}

// Truncate for display so an 18-decimal balance doesn't fill the error line.
const fmt = (n) => BigNumber(n).decimalPlaces(6, BigNumber.ROUND_DOWN).toFixed()

/**
 * Native send: the balance must cover the amount. Only the amount — the network
 * fee draws on the same balance but is checked by the fee pre-flight right
 * after, which knows the actual gas estimate.
 */
export const checkNativeBalance = async ({ chainId, from, amount, symbol, language }) => {
  const want = BigNumber(amount)
  if (!want.isFinite() || want.lte(0)) return null

  // 'native' routes getBalanceToken down its getBalance path; converted, so the
  // comparison is in the same decimal units the user typed.
  const have = BigNumber(await ViemWeb3.getBalanceToken(toChainId(chainId), from, 'native', true))
  // An unreadable balance also resolves to 0 — don't block someone who can pay.
  if (!have.isFinite() || have.lte(0)) return null
  if (have.gte(want)) return null

  return tr('walletActionNotEnoughBalance', language, {
    symbol: symbol || '',
    balance: fmt(have)
  })
}

/**
 * ERC-20 send: `balanceOf(from)` on the token contract must cover the amount.
 * Asks the contract rather than trusting the agent's `spendable` figure, which
 * was resolved when the message was built and can be stale by submit time.
 */
export const checkTokenBalance = async ({ chainId, from, contractAddress, amount, symbol, language }) => {
  const want = BigNumber(amount)
  if (!want.isFinite() || want.lte(0) || !contractAddress) return null

  // Multicalls decimals + balanceOf and converts, so the token's own decimals
  // are used rather than the agent's (possibly absent) figure.
  const have = BigNumber(await ViemWeb3.getBalanceToken(toChainId(chainId), from, contractAddress, true))
  if (!have.isFinite() || have.lte(0)) return null
  if (have.gte(want)) return null

  return tr('walletActionNotEnoughBalance', language, {
    symbol: symbol || '',
    balance: fmt(have)
  })
}

const ERC721_ABI = [{
  name: 'ownerOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'tokenId', type: 'uint256' }],
  outputs: [{ name: '', type: 'address' }]
}]

const ERC1155_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'account', type: 'address' },
    { name: 'id', type: 'uint256' }
  ],
  outputs: [{ name: '', type: 'uint256' }]
}]

/**
 * NFT send: the user must actually own the token being transferred.
 *  - ERC-721: `ownerOf(tokenId)` has to be the sending wallet. A token that was
 *    sold or burned since the agent listed it fails here with a clear reason.
 *  - ERC-1155: `balanceOf(from, id)` has to cover the requested editions.
 *
 * Read directly off a public client rather than through a ViemWeb3 helper —
 * neither call has one, and this is the only caller. The client still carries
 * the same fallback transport as every other read in the app.
 */
export const checkNftOwnership = async ({ chainId, from, contractAddress, tokenId, amount, isErc1155, language }) => {
  if (!contractAddress || tokenId == null || tokenId === '') return null

  // Built OUTSIDE the try on purpose. Everything the try catches is reported as
  // "you don't own this", and failing to construct a client (unknown chain, empty
  // RPC list) says nothing about ownership — it must not borrow that message.
  let client
  try {
    client = ViemWeb3.getPublicClient(toChainId(chainId))
  } catch (_err) {
    return null
  }
  if (!client) return null

  try {
    if (isErc1155) {
      const owned = BigNumber(String(await client.readContract({
        abi: ERC1155_ABI,
        address: contractAddress,
        functionName: 'balanceOf',
        args: [from, BigInt(tokenId)]
      })))
      // Editions default to 1 — the form leaves the field optional.
      const want = BigNumber(amount || 1)
      if (!owned.isFinite()) return null
      if (owned.gte(want)) return null
      return tr('walletActionNotEnoughEditions', language, { owned: owned.toFixed() })
    }

    const owner = await client.readContract({
      abi: ERC721_ABI,
      address: contractAddress,
      functionName: 'ownerOf',
      args: [BigInt(tokenId)]
    })
    if (!owner) return null
    if (String(owner).toLowerCase() === String(from).toLowerCase()) return null
    return tr('walletActionNotNftOwner', language)
  } catch (_err) {
    // Any failure to establish ownership blocks the send. In practice what lands
    // here is `ownerOf` reverting on a token id the contract doesn't have — the
    // chain saying the NFT isn't there to send — so it's reported as such.
    //
    // Deliberately does NOT single that case out from an RPC/transport failure,
    // unlike the balance checks above (which stay silent when they can't read
    // and let the gas estimate decide). The trade is accepted knowingly: an
    // unreachable RPC will tell someone who does own the NFT that they don't.
    // If that shows up in the wild, the fix is to report a reverted read only —
    // viem names it ContractFunctionRevertedError, reachable via `_err.cause`.
    //
    // Worth knowing the message is a weaker fit on the ERC-1155 path: `balanceOf`
    // returns 0 rather than reverting for an id that doesn't exist, so a throw
    // there is nearly always transport trouble, not missing ownership.
    return tr('walletActionNotNftOwner', language)
  }
}
