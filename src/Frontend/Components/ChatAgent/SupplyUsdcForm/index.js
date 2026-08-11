import React from 'react'
import AaveSupply from './AaveSupply'
import CompoundSupply from './CompoundSupply'
import SparkSupply from './SparkSupply'
import MorphoSupply from './MorphoSupply'

/**
 * Supply USDC into one lending market — a self-contained in-chat card.
 *
 * This file only picks the protocol. Each family owns its own component because
 * what the depositor receives differs per protocol: Aave and Compound credit a
 * receipt denominated 1:1 in USDC, while Spark and Morpho are ERC-4626 vaults
 * that mint shares at a live rate. Everything they share — the amount field, the
 * approve → deposit sequence, the timeline — lives once in `SupplyFormShell`, so
 * the per-protocol files stay a few lines each and none can break another.
 *
 * An unrecognised `market.type` falls through to the vault card, matching the
 * core's own default for a market kind added upstream after this was written
 * (`Erc4626VaultProtocol`): it previews rather than assuming a 1:1 credit, which
 * is the assumption that would show a wrong number if it were wrong.
 */
const BY_TYPE = {
  'aave-v3': AaveSupply,
  'compound-v3': CompoundSupply,
  spark: SparkSupply,
  'spark-ethereum': SparkSupply,
  'morpho-v2': MorphoSupply
}

export default function SupplyUsdcForm (props) {
  const Protocol = BY_TYPE[props?.props?.market?.type] || SparkSupply
  return <Protocol {...props} />
}
