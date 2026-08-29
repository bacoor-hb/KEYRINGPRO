import BigNumber from 'bignumber.js'
import { formatUnits, keccak256, toHex } from 'viem'
import { receiptDecimals, receiptUnit } from './receiptToken'

// How much the depositor actually got back, read from the deposit's own receipt.
//
// Every market in this flow credits the user by MINTING an ERC-20 to them — an
// aToken for Aave, a vault share for Spark/Morpho, and Comet's own balance token
// for Compound v3 — so the exact figure is already sitting in the deposit's logs
// as a `Transfer` into the wallet. Reading it there is the only way to state the
// received amount as a FACT rather than an estimate:
//
//   - a vault mints at the rate of the block it landed in, which is not the rate
//     `convertToShares` quoted while the form was open
//   - an Aave aToken is 1:1 with the asset in principle, but the amount credited
//     is what the pool actually pulled
//
// Deliberately parsed from the receipt the flow ALREADY waited on: no extra RPC,
// no second read that could disagree with the transaction that just settled.
//
// Everything here is best-effort and fails to `null` — a supply that succeeded
// must never be reported as failed, or held up, because a display figure could
// not be derived. The timeline simply shows "Success" on its own, exactly as it
// did before.

// The ERC-20 `Transfer(address,address,uint256)` topic0. Hashed here rather than
// pasted as a literal: it is derived once at import, and a hand-copied 32-byte
// constant that is one character wrong fails SILENTLY — every log stops matching
// and the received line simply never appears, with nothing to point at why.
const TRANSFER_TOPIC = keccak256(toHex('Transfer(address,address,uint256)'))

const norm = (value) => String(value || '').trim().toLowerCase()

/**
 * The address a 32-byte indexed topic encodes.
 *
 * An indexed `address` is left-padded to 32 bytes, so the address is the last 20
 * — taking the whole topic would never match a wallet address.
 */
const topicToAddress = (topic) => {
  const hex = norm(topic)
  if (!/^0x[0-9a-f]{64}$/.test(hex)) return null
  return `0x${hex.slice(26)}`
}

/**
 * Sum of every receipt-token `Transfer` into `walletAddress` in this receipt.
 *
 * Filtered on THREE things, all of which have to hold before a log counts:
 *
 *   - the emitter is the RECEIPT token (`market.token`). A deposit's receipt also
 *     carries the USDC that LEFT the wallet, plus whatever else the protocol
 *     touched; matching on any `Transfer` would report the wrong token, and on a
 *     vault it would report the deposit amount rather than the shares minted.
 *   - `topic0` is the ERC-20 Transfer signature, so an unrelated 3-topic event on
 *     the same contract is not misread as one.
 *   - the recipient is the depositor. Vaults commonly mint a fee share to a
 *     treasury in the same transaction, and that is not what the user received.
 *
 * Summed rather than first-match: a market is free to credit across more than one
 * mint, and the total is what the wallet gained either way.
 *
 * @returns {bigint|null} smallest units, or null when nothing matched.
 */
const sumReceiptTransfers = (logs, receiptAddress, walletAddress) => {
  const receipt = norm(receiptAddress)
  const wallet = norm(walletAddress)
  if (!receipt || !wallet) return null

  let total = 0n
  let matched = false

  for (const log of logs) {
    if (norm(log?.address) !== receipt) continue
    const topics = log?.topics
    // `to` is the SECOND indexed argument, so a Transfer always carries exactly
    // three topics. A shorter list is a different event (or a non-standard
    // token) and is skipped rather than indexed into.
    if (!Array.isArray(topics) || topics.length < 3) continue
    if (norm(topics[0]) !== TRANSFER_TOPIC) continue
    if (norm(topicToAddress(topics[2])) !== wallet) continue

    try {
      // `value` is un-indexed, so it is the data word — not a topic.
      const raw = BigInt(log?.data ?? '0x0')
      total += raw
      matched = true
    } catch (_err) {
      // A malformed data word disqualifies only this log; another may still be
      // readable.
    }
  }

  return matched ? total : null
}

/**
 * The "Received X SYMBOL" figure for a settled supply, or null when it could not
 * be derived — an unreadable receipt, a market that credits in a way these logs
 * don't describe, or an RPC that returned no logs at all.
 *
 * Returned pre-formatted (`{ amount, symbol }`, both strings) so the timeline
 * renders a value rather than re-deriving decimals, and so what is persisted
 * into the chat message stays displayable after a restart without the market
 * metadata having to be re-resolved.
 *
 * The amount is truncated, never rounded up, to the receipt token's own
 * decimals — same rule as every other balance-derived figure in the app.
 */
export const parseReceivedAmount = ({ receipt, market, asset, walletAddress }) => {
  // Wrapped whole, and never allowed to throw. This runs on the SUCCESS path of
  // a supply that has already settled on-chain: an exception escaping here would
  // unwind into the flow's outer catch and report a completed deposit as a
  // failed one — by far the worst outcome available to a cosmetic figure.
  try {
    const logs = receipt?.logs
    if (!Array.isArray(logs) || logs.length === 0) return null

    const units = sumReceiptTransfers(logs, market?.token, walletAddress)
    if (units == null || units <= 0n) return null

    const decimals = receiptDecimals(market?.receiptToken, asset)
    const formatted = BigNumber(formatUnits(units, decimals))
    if (!formatted.isFinite() || formatted.lte(0)) return null

    return {
      // Grouped and floored, matching `fmt` in the shell — the same figure the
      // "Est. Received" row above it was written in.
      amount: formatted.decimalPlaces(decimals, BigNumber.ROUND_DOWN).toFormat(),
      symbol: receiptUnit(market?.receiptToken, asset)
    }
  } catch (_err) {
    return null
  }
}

export default parseReceivedAmount
