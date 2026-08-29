import React from 'react'
import MyRollingNumber from 'frontend/Components/UI/MyRollingNumber'
import { balanceHandoffKey } from 'frontend/Components/UI/MyRollingNumber/handoff'
import useOnScreenSettled from 'frontend/Hooks/useOnScreenSettled'

// Decimals shown, and the reason this is a constant: the handoff to the token
// list compares the FORMATTED text, so this has to stay in lockstep with
// TokenRow's balance. A mismatch costs only the handoff (the list would spin the
// change a second time), but there is no reason to leave it to chance.
const BALANCE_FRACTION_DIGITS = 8

// The hero token balance as an odometer — it spins, green up / red down,
// whenever a refresh brings a different number in: a send, a swap, a withdraw,
// or a pull-to-refresh. Same treatment the row on the token list gets, and the
// same component driving it.
//
// A send or a swap done from this screen refreshes the balance while its own
// drawer is still up, and that is fine: the sheet leaves the hero line visible,
// so the number is watched changing behind it. Nothing about the screen's
// existing flow needed to move for this — only the number itself changed.
//
// Its own component rather than inline in page.js for two reasons:
//   - `useOnScreenSettled` re-renders on every focus change. Held down here that
//     is one number rather than the whole screen.
//   - `handoffKey` passes the announcement to the token list: a change this
//     screen has already spun is adopted silently over there, instead of the
//     row replaying it the moment the user goes back.
const HeroBalance = ({ address, metaKey, balance, symbol }) => {
  // Holds a change that lands while this screen is behind the QR scanner or AI
  // search, so it plays on the way back instead of finishing out of sight.
  const settled = useOnScreenSettled()

  return (
    <MyRollingNumber
      className='text-medium'
      value={balance}
      // No spin on arrival and none on recycling: this screen shows one token
      // for its whole life, so a change in `identity` means the whole screen is
      // showing something else and the number should just swap.
      identity={metaKey}
      handoffKey={balanceHandoffKey(address, metaKey)}
      active={settled}
      fractionDigits={BALANCE_FRACTION_DIGITS}
      suffix={` ${symbol || ''}`}
    />
  )
}

export default HeroBalance
