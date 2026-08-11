import React, { useMemo } from 'react'
import SupplyFormShell, { fmt } from './SupplyFormShell'
import ReceivedValue from './ReceivedValue'
import { receiptUnit } from './receiptToken'

/**
 * Supply USDC to a Compound v3 (Comet) market.
 *
 * The Comet contract IS the receipt token and its balance is denominated in the
 * underlying, so — as with Aave — the amount typed is the amount received and no
 * on-chain preview is needed.
 *
 * Shown in the Comet's own symbol (cUSDCv3) rather than "USDC".
 */
export default function CompoundSupply (props) {
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
