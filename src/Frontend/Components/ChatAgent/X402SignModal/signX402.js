import { ethers } from 'ethers'
import { resolvePrivateKey } from 'frontend/Hooks/useSendTx'

// Sign an x402 EIP-712 typed-data challenge with the connected wallet. The core
// already built `typedData` (domain/types/message); the FE only signs and hands
// back the signature, which the core puts in the PAYMENT-SIGNATURE header and
// uses to re-call the paid API. Nothing is broadcast on-chain here.
//
// `onKey` receives the resolved private key, so a caller driving a send can pass
// it on to the broadcast and spare a COLD (keycard) account a second scan for
// what the user did as one action — see `lendKey` in useSendTx. Called only after
// the signature verified, i.e. once this key is proven to be the right account's.
// Handing the key to a callback rather than returning it keeps it out of the
// signature's own return path, where every existing caller would then hold it.
export async function signX402 (typedData, from, nfcProxy, onKey) {
  if (!typedData) throw new Error('Missing typed data to sign')
  if (!from) throw new Error('No connected wallet to sign with')
  // Hot account → secure storage; cold (NFC keycard) account → a card scan,
  // since its key is never held on the device. Shared with the send flow so
  // both places resolve a signing key the same way.
  const privateKey = await resolvePrivateKey(from, nfcProxy)
  const wallet = new ethers.Wallet(privateKey)
  const { domain, types, message } = typedData

  // The core builds the domain straight from the challenge's `extra`, so a
  // server that doesn't send `name`/`version` leaves them as UNDEFINED KEYS.
  // Ethers treats a present-but-undefined field as part of the domain and
  // throws on it ("Cannot read properties of undefined"), where the server
  // hashed a domain with those fields absent. Dropping the empty ones makes the
  // domain we sign identical to the one the server built.
  const cleanDomain = Object.fromEntries(
    Object.entries(domain || {}).filter(([, v]) => v != null)
  )

  const signature = await wallet._signTypedData(cleanDomain, types, message)

  // A domain/message mismatch does NOT fail — it yields a well-formed signature
  // that simply recovers to a DIFFERENT address, which the facilitator rejects
  // with an opaque second 402. Recovering here turns that silent class of bug
  // into a named error at the point it actually happens.
  const recovered = ethers.utils.verifyTypedData(cleanDomain, types, message, signature)
  if (recovered.toLowerCase() !== String(from).toLowerCase()) {
    throw new Error(`x402 signature recovers to ${recovered}, expected ${from}`)
  }

  // Only now, past the recovery check: the key is confirmed to be `from`'s, so a
  // send reusing it cannot end up signing the transaction as a different account.
  onKey?.(privateKey)

  return signature
}
