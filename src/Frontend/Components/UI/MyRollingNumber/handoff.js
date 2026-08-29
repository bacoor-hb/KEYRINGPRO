// Which number changes have already been ANNOUNCED to the user, so the next
// screen showing the same number doesn't announce them a second time.
//
// The case this exists for: the token list and the token detail screen show the
// same balance, and both stay mounted (a native stack keeps the screen behind
// the one on top). A send made from the detail screen spins there — and the row
// on the list, parked while it was off screen, would then replay that very same
// change the moment the user goes back. Once seen is once.
//
// Entries are keyed by WHAT the number is (see balanceHandoffKey) and hold the
// exact formatted text that was announced, not a timestamp or a flag: the next
// change produces different text and is announced normally, and a value that
// comes back around later (spend it, receive it again) is a different change
// from whatever is recorded, so it spins too.
//
// A miss is harmless by construction — the number simply animates as it does
// today — so two screens that format the same balance differently degrade to the
// old behaviour rather than showing something wrong.

// Enough to cover a wallet's worth of tokens across a few accounts. Old entries
// are dropped in announcement order, so what falls out is whatever has gone
// longest without changing — the entries least likely to still be handed over.
const MAX_ENTRIES = 300

const announced = new Map()

// One place defines the key format, so the two screens can't drift apart.
// `metaKey` is only `chainId:tokenAddress`, so the account has to be in there:
// two accounts can hold the same token with different balances.
export const balanceHandoffKey = (accountAddress, metaKey) => {
  if (!accountAddress || !metaKey) return null
  return `${String(accountAddress).toLowerCase()}|${metaKey}`
}

export const markAnnounced = (key, text) => {
  if (!key) return
  // Delete before set so re-announcing moves the key to the end of the insertion
  // order — the eviction below then drops the least-recently announced entry
  // instead of one that is still changing.
  announced.delete(key)
  announced.set(key, text)
  if (announced.size > MAX_ENTRIES) announced.delete(announced.keys().next().value)
}

export const wasAnnounced = (key, text) => !!key && announced.get(key) === text
