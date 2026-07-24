import I18n from 'assets/Lang'

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

// The x402 charge the agent settles for a paid action, surfaced in the pill's
// label so the cost is visible BEFORE the user commits to the turn (the approval
// sheet is the second, authoritative confirmation — see X402SignModal). Kept
// here rather than baked into the 16 translation files so a price change is one
// edit; the strings interpolate {{fee}}.
const PAID_ACTION_FEE = '0.05 USDC on Base'
export const AI_SUGGESTIONS = [
  {
    // Fully canned, and a dead end by design: it invites the user to type. No
    // children and no prompt, so nothing is sent to the agent — the next turn
    // comes from whatever they write in the input.
    key: 'askQuestion',
    title: () => I18n.t('AISearch.suggestions.askQuestion'),
    userText: () => I18n.t('AISearch.suggestions.askQuestionUser'),
    reply: () => I18n.t('AISearch.suggestions.askQuestionReply')
  },
  {
    key: 'callAgent',
    title: () => I18n.t('AISearch.suggestions.callAgent'),
    // Echoes without the pill's leading emoji — the label is a button, the echo
    // is meant to read as something the user said.
    userText: () => I18n.t('AISearch.suggestions.callAgentUser'),
    reply: () => I18n.t('AISearch.suggestions.callAgentReply'),
    children: [
      {
        key: 'nft',
        title: () => I18n.t('AISearch.suggestions.callAgent_nft'),
        reply: () => I18n.t('AISearch.suggestions.pickOption'),
        children: [
          {
            key: 'list',
            title: () => I18n.t('AISearch.suggestions.nft_list'),
            prompt: () => I18n.t('AISearch.suggestions.nft_listPrompt')
          },
          {
            key: 'send',
            title: () => I18n.t('AISearch.suggestions.nft_send', { fee: PAID_ACTION_FEE }),
            prompt: () => I18n.t('AISearch.suggestions.nft_sendPrompt')
          }
        ]
      },
      {
        key: 'balance',
        title: () => I18n.t('AISearch.suggestions.callAgent_balance'),
        reply: () => I18n.t('AISearch.suggestions.pickOption'),
        children: [
          {
            key: 'show',
            title: () => I18n.t('AISearch.suggestions.balance_show'),
            prompt: () => I18n.t('AISearch.suggestions.balance_showPrompt')
          },
          {
            key: 'send',
            title: () => I18n.t('AISearch.suggestions.balance_send', { fee: PAID_ACTION_FEE }),
            prompt: () => I18n.t('AISearch.suggestions.balance_sendPrompt')
          }
        ]
      },
      {
        key: 'pools',
        title: () => I18n.t('AISearch.suggestions.callAgent_pools'),
        prompt: () => I18n.t('AISearch.suggestions.callAgent_poolsPrompt')
      }
      // {
      //   key: 'lending',
      //   title: () => I18n.t('AISearch.suggestions.callAgent_lending'),
      //   prompt: () => I18n.t('AISearch.suggestions.callAgent_lendingPrompt')
      // }
    ]
  }
]

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
export const getBranchReply = (node) =>
  (node?.reply ? node.reply() : I18n.t('AISearch.suggestions.defaultReply'))

// What the tap echoes as the user's own message. Defaults to the pill's label,
// which is right for most nodes; nodes that should read like real speech rather
// than a button override it with `userText`.
export const getUserText = (node) =>
  (node?.userText ? node.userText() : node?.title?.())
