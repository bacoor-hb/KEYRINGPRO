import React from 'react'
import SupplyFormShell from './SupplyFormShell'
import useVaultReceivedRow from './VaultReceivedRow'

/**
 * Supply USDC to a Spark savings vault — covers both `spark` and the Ethereum
 * variant `spark-ethereum`, which differ only in deposit encoding (handled in
 * `buildSupplyTx`), not in what the card shows.
 *
 * ERC-4626: the deposit mints shares at the vault's current rate, so the
 * received figure is a live preview in `sUSDC` (18 decimals), not the USDC
 * amount typed.
 */
export default function SparkSupply (props) {
  const { market, asset, chainId } = props?.props || {}
  const ReceivedRow = useVaultReceivedRow({ chainId, market, asset })

  return <SupplyFormShell {...props} ReceivedRow={ReceivedRow} />
}
