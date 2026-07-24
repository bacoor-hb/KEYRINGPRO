import BigNumber from 'bignumber.js'
import { lowerCase } from 'common/function'
import { zeroAddress } from 'viem'

// Resolve the transfers of a transaction that belong to the current wallet on
// the given screen (send/receive), then group them by token.
//
// Rules (applied to erc20_transfers + native_transfers together, so a swap only
// surfaces the leg that matches the screen):
//   - direction must match the screen ('send' → send screen, 'receive' → receive
//     screen). This is what makes `token swap` rows land on the right screen.
//   - value must be > 0.
//   - the wallet must actually be the party for that direction: from_address ===
//     wallet for send, to_address === wallet for receive.
//   - transfers left over are grouped by token: same token → values summed;
//     different tokens → kept as separate entries so both show in the UI.
export const getRelevantTransfers = (tx, address, isSend) => {
  const direction = isSend ? 'send' : 'receive'
  const owner = lowerCase(address)

  const erc20 = (tx?.erc20_transfers || []).map(t => ({ ...t, isNative: false }))
  const native = (tx?.native_transfers || []).map(t => ({ ...t, isNative: true }))

  const relevant = [...erc20, ...native].filter(t => {
    if (t.direction !== direction) return false
    if (!(Number(t.value || 0) > 0)) return false
    if (isSend) {
      return lowerCase(t.from_address) === owner
    }
    return lowerCase(t.to_address) === owner
  })

  // Group by token contract (native tokens share a single 'native' bucket).
  // `order` preserves first-seen ordering so the grouped output is stable.
  const grouped = {}
  const order = []
  relevant.forEach(t => {
    const tokenKey = t.isNative ? 'native' : lowerCase(t.address || zeroAddress)
    if (!grouped[tokenKey]) {
      grouped[tokenKey] = { ...t, valueSum: new BigNumber(t.value_formatted || 0) }
      order.push(tokenKey)
    } else {
      grouped[tokenKey].valueSum = grouped[tokenKey].valueSum.plus(t.value_formatted || 0)
    }
  })

  return order.map(tokenKey => {
    const t = grouped[tokenKey]
    return {
      ...t,
      tokenKey,
      value_formatted: t.valueSum.toFixed()
    }
  })
}
