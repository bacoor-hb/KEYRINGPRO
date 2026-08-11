import { utils } from 'ethers'
import { ed25519 } from '@noble/curves/ed25519.js'
import { Buffer } from 'buffer'
import { chainType } from './constants/chain'

/**
 * Re-encoding an EVM private key into the formats the LEGACY display-only chains
 * (Bitcoin, Solana) use. Read-only support: V2 never signs on these chains, this
 * exists so "View private key" shows a key the user can actually import elsewhere.
 *
 * Why it is needed at all: an NFC keycard stores exactly ONE key — the EVM one.
 * The old app derived the BTC and Solana accounts from it and saved each in its
 * own format on the device, so a HOT legacy account already has the right string
 * stored and must NOT come through here. Only a keycard account has to be
 * re-encoded at display time, from what the card hands back.
 *
 * The output matches the old app byte for byte — both algorithms below are the
 * standard ones the old code used (see __tests__/legacyChainKey.test.js, which
 * pins them to public Bitcoin/RFC 8032 vectors).
 *
 * Deliberately NOT wired into anything EVM: `toLegacyChainPrivateKey` returns its
 * input untouched for every other chain, so the EVM path is unchanged.
 */

// Strip an optional 0x and validate: exactly 32 bytes of hex. Anything else is
// not an EVM key (already-encoded WIF, empty string, a legacy oddity) and must be
// left alone rather than mangled.
const toKeyBytes = (privateKey) => {
  const hex = String(privateKey || '').replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null
  return Buffer.from(hex, 'hex')
}

/**
 * Bitcoin WIF (compressed) — `base58(0x80 ‖ key ‖ 0x01 ‖ checksum)`, checksum
 * being the first 4 bytes of a double SHA-256 over that payload. Compressed is
 * what the old app produced (`generateWifKeyFromKey(key, newFormat = true)`),
 * which is why its BTC accounts are segwit (p2wpkh).
 *
 * @param {string} privateKey EVM private key, hex, with or without 0x
 * @returns {string} 52-char WIF, or '' when the input isn't a 32-byte key
 */
export const evmKeyToBtcWif = (privateKey) => {
  const key = toKeyBytes(privateKey)
  if (!key) return ''
  const payload = Buffer.concat([Buffer.from([0x80]), key, Buffer.from([0x01])])
  const checksum = Buffer.from(utils.arrayify(utils.sha256(utils.sha256(payload)))).subarray(0, 4)
  return utils.base58.encode(Buffer.concat([payload, checksum]))
}

/**
 * Solana secret key — `base58(seed ‖ publicKey)`, the 64-byte layout
 * `@solana/web3.js` exposes as `Keypair.secretKey`. The old app built it with
 * `Keypair.fromSeed(evmKey)`, i.e. the EVM key IS the ed25519 seed.
 *
 * @param {string} privateKey EVM private key, hex, with or without 0x
 * @returns {string} 88-char base58 secret key, or '' when the input isn't a key
 */
export const evmKeyToSolanaSecret = (privateKey) => {
  const seed = toKeyBytes(privateKey)
  if (!seed) return ''
  const publicKey = Buffer.from(ed25519.getPublicKey(seed))
  return utils.base58.encode(Buffer.concat([seed, publicKey]))
}

/**
 * Re-encode a key READ FROM AN NFC CARD for the account it is being shown as.
 * Every chain other than the two legacy ones gets its key back unchanged — EVM
 * included, which is why wiring this in cannot alter the EVM flow.
 *
 * Never call this with a key read from device storage: a hot legacy account
 * already holds its key in the chain's own format, and re-encoding a WIF would
 * be nonsense. (It would in fact return the WIF untouched, since that is not
 * 32-byte hex — but the intent is what matters at the call site.)
 *
 * @param {string} privateKey the EVM key the card returned
 * @param {string} chain the account's `chain` field
 * @returns {string} the key in that chain's format
 */
export const toLegacyChainPrivateKey = (privateKey, chain) => {
  if (chain === chainType.btc) return evmKeyToBtcWif(privateKey) || privateKey
  if (chain === chainType.solana) return evmKeyToSolanaSecret(privateKey) || privateKey
  return privateKey
}
