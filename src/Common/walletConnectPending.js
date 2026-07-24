// Lightweight hand-off so an incoming WalletConnect request opens the NEW
// requests drawer (on the WalletConnect screen) for the right account, instead
// of the legacy manageRequestScreenV2.
//
// Intentionally dependency-free: this is imported by common/redux.js, so it must
// NOT import redux/screens (would create a circular dependency).

let pendingRequestTopic = null
let requestsOpener = null

// Set by the request producer (redux.addCallRequestWalletConnectV2) when the
// WalletConnect screen isn't the current screen; consumed by the screen on focus.
export const setPendingWcRequest = (topic) => { pendingRequestTopic = topic }

export const consumePendingWcRequest = () => {
  const topic = pendingRequestTopic
  pendingRequestTopic = null
  return topic
}

// The WalletConnect screen registers an opener while mounted so a request that
// arrives while it's already the current screen can open the drawer directly
// (navigating to an already-current screen wouldn't re-fire `focus`).
export const registerWcRequestsOpener = (fn) => { requestsOpener = fn }

export const unregisterWcRequestsOpener = (fn) => {
  if (requestsOpener === fn) requestsOpener = null
}

export const getWcRequestsOpener = () => requestsOpener

// An incoming request that arrives while the vault is locked must NOT open its
// drawer over the unlock screen. The host stashes the topic here; UnlockScreen
// replays them via flushLockedWcRequests() after a successful unlock. The request
// itself stays in callRequestRedux, so reopening just re-renders the pending one.
let lockedRequestTopics = []

export const stashLockedWcRequest = (topic) => {
  if (topic && !lockedRequestTopics.includes(topic)) lockedRequestTopics.push(topic)
}

export const flushLockedWcRequests = () => {
  const topics = lockedRequestTopics
  lockedRequestTopics = []
  if (requestsOpener) topics.forEach((topic) => requestsOpener(topic))
}
