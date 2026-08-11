import React, { useMemo } from 'react'
import SupplyFormShell, { fmt } from './SupplyFormShell'
import ReceivedValue from './ReceivedValue'
import { receiptUnit } from './receiptToken'

/**
 * Supply USDC to an Aave v3 market.
 *
 * Aave mints an aToken (aBasUSDC, aEthUSDC, …) denominated 1:1 in the underlying
 * and rebasing as interest accrues, so the amount typed IS the amount received.
 * No preview call, and nothing read from chain while the user types.
 *
 * The unit is the aToken's real symbol from the payload, not "USDC": what lands
 * in the wallet is aBasUSDC, and labelling it USDC misnames the position.
 */
export default function AaveSupply (props) {
  const { market, asset } = props?.props || {}

  const ReceivedRow = useMemo(() => {
    const unit = receiptUnit(market?.receiptToken, asset)
    const decimals = asset?.decimals ?? 6
    return ({ amount, validAmount }) => (
      <ReceivedValue value={validAmount ? fmt(amount, decimals) : null} unit={unit} />
    )
  }, [market, asset])

  return <SupplyFormShell {...props} ReceivedRow={ReceivedRow} />
}
