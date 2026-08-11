import React from 'react'
import SupplyFormShell from './SupplyFormShell'
import useVaultReceivedRow from './VaultReceivedRow'

/**
 * Supply USDC to a Morpho v2 vault.
 *
 * ERC-4626 like Spark, so the received figure is a live share preview in the
 * vault's own share token rather than the USDC amount typed.
 *
 * Morpho carries one extra safety gate the others don't — the dead-shares check
 * against the inflation attack — but that lives in the pre-flight
 * (`supplyChecks`) and runs on execute, so it changes nothing about this card's
 * layout.
 */
export default function MorphoSupply (props) {
  const { market, asset, chainId } = props?.props || {}
  const ReceivedRow = useVaultReceivedRow({ chainId, market, asset })

  return <SupplyFormShell {...props} ReceivedRow={ReceivedRow} />
}
