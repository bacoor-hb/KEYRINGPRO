import { lowerCase } from 'common/function'

// AI Search UI chat history lives in redux (`aiSearchHistoryRedux`) as a map
// { [sessionKey::lowerAddress]: Message[] }, persisted via the store's
// AsyncStorage layer. The session segment lets each entry point into AI Search
// (the general footer search, the NFC-tag helper, the token list, …) keep its
// own conversation per address, instead of sharing one bucket per address.
// These are pure helpers for reading/updating that map — addresses are always
// lowercased so reads and writes line up regardless of caller casing.

// Default session for callers that don't pass one — keeps the general footer
// search on a single bucket per address.
export const AI_SEARCH_SESSION = {
  general: 'general',
  nfcTag: 'nfcTag',
  token: 'token',
  swapAndSend: 'swapAndSend'
}

const DEFAULT_SESSION = AI_SEARCH_SESSION.general

// Composite map key for a (session, address) pair. Address is the suffix so
// removeAiMessages can drop every session bucket for a deleted account.
const buildKey = (session, address) => `${session || DEFAULT_SESSION}::${lowerCase(address)}`

// Messages for a single (address, session) (always an array, safe for FlatList).
export const getAiMessages = (map, address, session) => {
  if (!address) return []
  const msgs = map?.[buildKey(session, address)]
  return Array.isArray(msgs) ? msgs : []
}

// Unique id for a chat message. Each USER message gets one; the AI reply carries
// it back as `replyToId` so a question is linked to its answer explicitly — no
// reliance on array position or matching content. timestamp + random is plenty
// unique within a single thread and avoids adding a uuid dependency.
export const makeMessageId = () => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

// Whether `content` was already asked AND successfully answered in this list.
//
// The link is by id, not position: we find the latest USER message with this
// content, then look for an assistant reply whose `replyToId` points back at it.
// A turn the user stopped / abandoned before a reply has no such assistant, so it
// counts as unanswered (and gets re-sent). An assistant reply flagged `isError`
// (the "something went wrong" fallback) also counts as unanswered, so the next
// open retries the question instead of treating the error as a real answer.
export const isQuestionAnswered = (messages, content) => {
  if (!Array.isArray(messages) || !content) return false
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg?.role === 'user' && msg?.content === content && msg?.id) {
      return messages.some((m) => m?.role === 'assistant' && m?.replyToId === msg.id && !m?.isError)
    }
  }
  return false
}

// ===== Init suggestion pills =====
//
// The pills are pure UI, NOT part of the conversation: exactly one set exists,
// pinned below the last message, and it is never written into the thread or to
// storage. Dismissing them (tapping a pill, or sending any message) hides them
// until a trigger brings them back.

// How long a thread must sit dismissed, with the user away from the screen,
// before the pills are offered again.
// TODO: restore to 30 minutes once the flow has been verified on device.
export const SUGGESTIONS_IDLE_MS = 30 * 60 * 1000

// Per (session, address) thread. A thread is in exactly one of two states:
//
//   - SHOWING  — no entry in the map. The pills are up and STAY up: nothing but
//                a user interaction can take them down, so leaving and coming
//                back (however briefly, however often) never hides them.
//   - HIDDEN   — { leftAt } after the user dismissed them. `leftAt` is 0 while
//                the user is still on the screen and is stamped with NOW every
//                time they leave, so the clock only runs while they are away and
//                always measures the LATEST absence. Once one absence has lasted
//                SUGGESTIONS_IDLE_MS the thread goes back to SHOWING — and the
//                entry is DELETED, which is what makes "shown" stick until the
//                next dismissal.
//
// That deletion is the fix for the reported bug: previously a thread stayed
// flagged dismissed forever, so every later visit re-measured the same old stamp
// and the pills flickered back off on the next quick return.
//
// In memory ONLY — a relaunch wipes the map, i.e. every thread returns to
// SHOWING. That IS the "kill app, open again" trigger, so this must never be
// persisted.
const suggestionsState = {}

// Whether this thread's pills should be visible. Pure — call it as often as you
// like; `refreshSuggestions` is what actually advances the state machine.
export const areSuggestionsVisible = (address, session) => {
  if (!address) return false
  return !suggestionsState[buildKey(session, address)]
}

// Re-evaluate a HIDDEN thread and promote it back to SHOWING when its time is
// up. Call on arrival (mount / focus); returns the resulting visibility so the
// caller can render straight off it.
export const refreshSuggestions = (address, session) => {
  if (!address) return false
  const key = buildKey(session, address)
  const entry = suggestionsState[key]
  if (!entry) return true
  // Still on the screen (never left since dismissing) — the clock has not begun.
  if (!entry.leftAt) return false
  if (Date.now() - entry.leftAt < SUGGESTIONS_IDLE_MS) return false
  delete suggestionsState[key]
  return true
}

// Hide this thread's pills — the user tapped one or sent a message. `leftAt` is
// 0 because they are still here; staying put must never bring the pills back.
export const dismissSuggestions = (address, session) => {
  if (!address) return
  suggestionsState[buildKey(session, address)] = { leftAt: 0 }
}

// Put threads back to SHOWING because their conversation no longer exists.
//
// The idle clock is the only OTHER way out of HIDDEN, and it is deliberately
// slow — but a thread whose messages were just wiped has nothing left to have
// dismissed the pills over, so it must not sit hidden waiting out that clock.
// Wiping history is therefore a trigger in its own right: reset wallet, restore
// from backup, and deleting an account all clear the thread and must clear this
// alongside it, or the user comes back to an empty chat with no pills at all.
//
// `address` omitted (the wallet-wide wipes) clears EVERY thread; passing one
// clears just that address's session buckets — the mirror of removeAiMessages,
// which is the map-side half of the same operation.
export const resetSuggestions = (address) => {
  if (!address) {
    Object.keys(suggestionsState).forEach((key) => delete suggestionsState[key])
    return
  }
  const suffix = `::${lowerCase(address)}`
  Object.keys(suggestionsState)
    .filter((key) => key.endsWith(suffix))
    .forEach((key) => delete suggestionsState[key])
}

// The user left the screen: (re)start a HIDDEN thread's clock from NOW.
//
// Every departure resets it, so the wait is always measured from the LAST time
// they left, not the first. Coming back too early therefore costs the user the
// time already served — they leave again and the full window starts over.
//
// No-op for a SHOWING thread: there is nothing to time, which is exactly why
// leaving and returning can never hide pills that are already up.
export const markSuggestionsLeft = (address, session) => {
  if (!address) return
  const entry = suggestionsState[buildKey(session, address)]
  if (entry) entry.leftAt = Date.now()
}

// Returns a new map with one (address, session) bucket replaced. Never mutates input.
export const setAiMessages = (map, address, messages, session) => {
  if (!address) return map || {}
  return { ...(map || {}), [buildKey(session, address)]: messages || [] }
}

// Returns a new map with every session bucket for one address dropped (e.g. its
// account was deleted). Returns the same map if nothing matches, so callers can
// skip a redundant dispatch.
export const removeAiMessages = (map, address) => {
  const lower = lowerCase(address || '')
  if (!lower || !map) return map || {}
  const suffix = `::${lower}`
  const keys = Object.keys(map).filter((key) => key.endsWith(suffix))
  if (keys.length === 0) return map
  const next = { ...map }
  keys.forEach((key) => delete next[key])
  return next
}
