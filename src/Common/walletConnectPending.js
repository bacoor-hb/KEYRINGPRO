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

// Topics of incoming requests that arrived while NO opener was registered. On a
// cold start walletKit is initialised during App boot (before the UI renders), so
// a pending session_request can be emitted before WalletConnectRequestHost mounts.
// Without this queue that request would land in callRequestRedux but its drawer
// would never open (nor be stashed for after-unlock).
let unopenedRequestTopics = []

// WalletConnectRequestHost registers its opener while mounted. Registering also
// replays requests that arrived before it mounted; the opener itself applies the
// locked-vault gate (stashes the topic until unlock).
export const registerWcRequestsOpener = (fn) => {
  requestsOpener = fn
  const topics = unopenedRequestTopics
  unopenedRequestTopics = []
  topics.forEach((topic) => {
    try {
      fn(topic)
    } catch (e) {
      // one failing topic must not block the others
    }
  })
}

export const unregisterWcRequestsOpener = (fn) => {
  if (requestsOpener === fn) requestsOpener = null
}

export const getWcRequestsOpener = () => requestsOpener

// Entry point for an INCOMING request (not a user tap): open it now if the host is
// mounted, otherwise queue it until the host registers.
export const openIncomingWcRequest = (topic) => {
  if (!topic) return
  if (requestsOpener) {
    requestsOpener(topic)
  } else if (!unopenedRequestTopics.includes(topic)) {
    unopenedRequestTopics.push(topic)
  }
}

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
