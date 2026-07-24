import { ethers } from 'ethers'
import { getPrivateKeyByAddress } from 'common/wallet'

// Sign an x402 EIP-712 typed-data challenge with the connected wallet. The core
// already built `typedData` (domain/types/message); the FE only signs and hands
// back the signature, which the core puts in the PAYMENT-SIGNATURE header and
// uses to re-call the paid API. Nothing is broadcast on-chain here.
export async function signX402 (typedData, from) {
  if (!typedData) throw new Error('Missing typed data to sign')
  if (!from) throw new Error('No connected wallet to sign with')
  const privateKey = getPrivateKeyByAddress(from)
  if (!privateKey) throw new Error(`Private key not found for ${from}`)
  const wallet = new ethers.Wallet(privateKey)
  const { domain, types, message } = typedData
  return wallet._signTypedData(domain, types, message)
}
