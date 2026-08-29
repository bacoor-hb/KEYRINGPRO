import I18n, { resolveLocale } from 'assets/Lang'
import { formatFeeLabel } from '../x402FeeLabel'
import { LENDING_ENABLED } from 'frontend/Services/keyringAgent'

// The init-suggestion decision TREE.
//
// This whole file is app-side only — nothing here talks to the agent. A node is
// LOCAL (canned question + canned answer, no network, no token spend) whenever
// it carries a `reply`, and an AI turn otherwise. A local node may additionally
// carry `children`, which become the pills attached to its reply — that is what
// makes the tree drill deeper. A local node WITHOUT children is a dead end on
// purpose: it answers and then hands the conversation back to the text input
// (this is what "Ask a question" does).
//
// Depth is arbitrary: a child may itself have children, so a branch can drill as
// deep as the copy needs. The traversal helpers below don't care about depth.
//
// Node shape:
//   key       string   unique among its siblings — the path is built from these
//   title     fn       () => label on the pill (translated at render time, so a
//                      language switch re-labels without a rebuild)
//   reply     fn?      () => canned bot message. Present ⇒ the node is LOCAL.
//   userText  fn?      () => what the tap echoes as the USER's message. Defaults
//                      to `title`, which carries an emoji and reads as a button
//                      rather than something a person would type — override it
//                      wherever the echo should read like real speech.
//   children  array?   sub-options attached to this node's reply. Local nodes only.
//   prompt    fn?      () => the text sent to the agent. Used when there is no
//                      `reply` ⇒ the node is a LEAF (an AI turn).
//
// Titles carry their own leading emoji, so no icon asset is involved.

// Every label / canned line in the tree resolves through here.
//
// `locale` is the BCP-47 tag of the language the CONVERSATION is in — which is
// not always the app's language: someone running the app in Vietnamese can chat
// in English, and the menu must follow what they TYPED, not the app chrome. It
// is threaded down from the turn the core reports (`rewrite.language`).
//
// Omitted (the tap path, where the pills ARE app chrome) it falls back to the
// app language, so every existing call keeps its current behavior. Same
// `resolveLocale` mapping the rest of ChatAgent uses (vi→vn, ja→jp, …), so an
// unknown tag degrades to the app language rather than showing raw keys.
const tt = (key, locale, opts) =>
  I18n.t(key, { ...(opts || {}), ...(locale ? { locale: resolveLocale(locale) } : {}) })

// ─── x402 fees ───────────────────────────────────────────────────────────────
//
// The charge the agent settles for a paid action, surfaced in the pill's label so
// the cost is visible BEFORE the user commits to the turn (the approval sheet is
// the second, authoritative confirmation — see X402SignModal).
//
// The numbers are NOT kept here: they come from the paid backend's own OpenAPI
// document (`x-payment-info.price` per route), fetched once by useX402Fees. This
// module only holds the last map that hook resolved, because the pills render
// from inside a memoized list (MessageBubble) — a module cache labels every level
// of the tree without threading a prop through the whole thread.
//
// Nodes name the operationId they are priced by (`sendNft`, `sendToken`, …), so
// the app tracks the operation rather than a path the server is free to move.
let X402_FEES = {}

// Pills already sitting in the thread render inside a memoized bubble that only
// compares message fields, so a price arriving after a bubble was built would
// never reach it — the bubble would keep its no-fee label for the rest of the
// session. Subscribers are notified when the map is replaced, which lets those
// bubbles re-render exactly once. See useX402FeeLabels.
const feeListeners = new Set()

export const subscribeX402Fees = (fn) => {
  feeListeners.add(fn)
  return () => { feeListeners.delete(fn) }
}

export const setX402Fees = (fees) => {
  X402_FEES = fees || {}
  feeListeners.forEach((fn) => fn())
}

// The fee label for an operation, e.g. "0.05 USDC on Base". Null until the spec
// has loaded, or when the server does not price that operation up front — the
// title then renders its no-fee variant instead of a stale or invented number.
//
// Formatted per call rather than read off the cached entry, so the phrase follows
// the app's current language (the pills are app chrome — they have no per-turn
// language of their own, hence no argument). See formatFeeLabel.
export const getFeeLabel = (operationId) => formatFeeLabel(X402_FEES[operationId])

// A pill's label, with the fee appended only once it is actually known. The
// unpriced string is the same copy without the "(Fee: …)" suffix, so a slow or
// unreachable spec degrades to a plain button rather than an empty price or a
// flash of the wrong one.
const withFee = (key, operationId) => (locale) => {
  const fee = getFeeLabel(operationId)
  return fee ? tt(`${key}WithFee`, locale, { fee }) : tt(key, locale)
}
const LENDING_SUGGESTION = {
  key: 'lending',
  title: (locale) => tt('AISearch.suggestions.callAgent_lending', locale),
  prompt: (locale) => tt('AISearch.suggestions.callAgent_lendingPrompt', locale)
}

export const AI_SUGGESTIONS = [
  {
    // Fully canned, and a dead end by design: it invites the user to type. No
    // children and no prompt, so nothing is sent to the agent — the next turn
    // comes from whatever they write in the input.
    key: 'askQuestion',
    title: (locale) => tt('AISearch.suggestions.askQuestion', locale),
    userText: (locale) => tt('AISearch.suggestions.askQuestionUser', locale),
    reply: (locale) => tt('AISearch.suggestions.askQuestionReply', locale)
  },
  {
    key: 'callAgent',
    title: (locale) => tt('AISearch.suggestions.callAgent', locale),
    // Echoes without the pill's leading emoji — the label is a button, the echo
    // is meant to read as something the user said.
    userText: (locale) => tt('AISearch.suggestions.callAgentUser', locale),
    reply: (locale) => tt('AISearch.suggestions.callAgentReply', locale),
    children: [
      {
        key: 'nft',
        title: (locale) => tt('AISearch.suggestions.callAgent_nft', locale),
        reply: (locale) => tt('AISearch.suggestions.pickOption', locale),
        children: [
          {
            key: 'list',
            title: (locale) => tt('AISearch.suggestions.nft_list', locale),
            prompt: (locale) => tt('AISearch.suggestions.nft_listPrompt', locale)
          },
          {
            key: 'send',
            // Priced by the spec's `sendNft` operation (/api/send-nft).
            title: withFee('AISearch.suggestions.nft_send', 'sendNft'),
            prompt: (locale) => tt('AISearch.suggestions.nft_sendPrompt', locale)
          }
        ]
      },
      {
        key: 'balance',
        title: (locale) => tt('AISearch.suggestions.callAgent_balance', locale),
        reply: (locale) => tt('AISearch.suggestions.pickOption', locale),
        children: [
          {
            key: 'show',
            title: (locale) => tt('AISearch.suggestions.balance_show', locale),
            prompt: (locale) => tt('AISearch.suggestions.balance_showPrompt', locale)
          },
          {
            key: 'send',
            // Priced by the spec's `sendToken` operation (/api/send-token). The
            // native-coin variant (`sendNative`) is the same price today, and the
            // pill covers both kinds of send — token is the representative one.
            title: withFee('AISearch.suggestions.balance_send', 'sendToken'),
            prompt: (locale) => tt('AISearch.suggestions.balance_sendPrompt', locale)
          }
        ]
      },
      {
        key: 'pools',
        // The ranking itself is free — the `addPool` fee is only charged if the
        // user goes on to add liquidity from it, so no price is shown here.
        title: (locale) => tt('AISearch.suggestions.callAgent_pools', locale),
        prompt: (locale) => tt('AISearch.suggestions.callAgent_poolsPrompt', locale)
      },
      // Only when the lending subagent is routable: with it off the core has
      // nothing to answer a supply/earn question with, so the pill would promise
      // a turn that cannot happen.
      ...(LENDING_ENABLED ? [LENDING_SUGGESTION] : [])
    ]
  }
]

// ─── Per-session root pills ─────────────────────────────────────────────────
//
// AI_SUGGESTIONS above is the DEFAULT root, shown for the general footer search
// and every session that doesn't ask for its own. A session opened from a
// specific feature (the Swap-and-send drawer, …) starts on its own root instead,
// so the first pills the user sees are about the thing they just tapped away
// from rather than the generic agent menu.
//
// These nodes are LEAVES (a `prompt`, no `reply`): tapping one sends a real turn
// to the agent, exactly like the deepest level of the default tree. Nothing else
// changes — history, dismissal and the idle timer are all keyed by session
// already, so a session's pills come and go independently of the others.
//
// Unlike the default tree these carry NO emoji and the label IS the prompt: the
// pill reads as the question the user is about to ask, so one key drives both.
const SESSION_SUGGESTIONS = {
  swapAndSend: [
    {
      key: 'crossChainGasCharges',
      title: (locale) => tt('AISearch.suggestions.swapAndSend_gasCharges', locale),
      prompt: (locale) => tt('AISearch.suggestions.swapAndSend_gasCharges', locale)
    },
    {
      key: 'whyAddGasCrossChain',
      title: (locale) => tt('AISearch.suggestions.swapAndSend_whyAddGas', locale),
      prompt: (locale) => tt('AISearch.suggestions.swapAndSend_whyAddGas', locale)
    }
  ]
}

// ─── Typed-text equivalent of the "Call Keyring Agent" pill ─────────────────
//
// The pills are app-side only, so a user who TYPES or pastes the same request
// ("Call Keyring Agent", "what can you do?", "menu") never touches this tree —
// their text goes to the agent, which answers in prose and leaves them with no
// way to act. The core flags that intent on the turn it returns
// (`rewrite.aboutAssistant`, decided by its query rewriter — no phrase matching
// anywhere), and AISearch then plays back THIS node instead of the prose reply.
//
// Deliberately the same node the pill opens, not a flattened copy of the whole
// tree: the branch level ("Which can I help you with?" + the four options) is
// what the tap produces, so typing must produce exactly it — same canned reply,
// same four pills, same free drill-down into the sub-levels. A flattened
// one-shot menu would look similar but behave differently, and every sub-level
// would then cost a real agent turn to reveal.
export const CALL_AGENT_KEY = 'callAgent'

// The node the "Call Keyring Agent" pill opens, or undefined if the tree no
// longer carries it — callers fall back to the agent's own reply, so renaming or
// removing the node degrades to today's prose answer instead of throwing.
export const getCallAgentNode = () => AI_SUGGESTIONS.find((n) => n.key === CALL_AGENT_KEY)

// The root pill set for a session. Unknown / undefined sessions fall back to the
// default tree, so adding an entry point never has to touch this file.
export const getRootSuggestions = (session) => SESSION_SUGGESTIONS[session] || AI_SUGGESTIONS

// Whether tapping this node is answered by the app instead of the agent. Having
// a `reply` is what decides it — NOT having children, so a node can be canned
// and still be a dead end ("Ask a question"). A node carrying both `reply` and
// `prompt` stays local; `reply` wins.
export const isLocal = (node) => typeof node?.reply === 'function'

// Whether this node's reply carries a further set of pills.
export const hasChildren = (node) => Array.isArray(node?.children) && node.children.length > 0

// The options to show for a path. `path` is an array of node keys from the root
// down (empty = the root options). Returns [] if the path no longer resolves —
// which is what makes a stale path (e.g. after the tree is edited in an update,
// or read back from storage) degrade to "no pills" instead of throwing.
export const getOptionsAt = (path) => {
  let level = AI_SUGGESTIONS
  for (const key of path || []) {
    const node = level.find((n) => n.key === key)
    if (!hasChildren(node)) return []
    level = node.children
  }
  return level
}

// The bot line shown when a local node is opened. Falls back to a shared prompt
// so a new branch needs no dedicated copy to be usable.
export const getBranchReply = (node, locale) =>
  (node?.reply ? node.reply(locale) : tt('AISearch.suggestions.defaultReply', locale))

// What the tap echoes as the user's own message. Defaults to the pill's label,
// which is right for most nodes; nodes that should read like real speech rather
// than a button override it with `userText`.
export const getUserText = (node, locale) =>
  (node?.userText ? node.userText(locale) : node?.title?.(locale))
