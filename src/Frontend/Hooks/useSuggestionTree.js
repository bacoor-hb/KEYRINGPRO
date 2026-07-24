import { useCallback, useRef } from 'react'
import {
  isLocal,
  hasChildren,
  getBranchReply,
  getUserText
} from 'frontend/Components/ChatAgent/InitSuggestions/suggestionTree'

/**
 * Resolves a tap on the init-suggestion tree (see suggestionTree.js) for AI Search.
 *
 * The tree is app-side only. Selecting a LOCAL node is a canned turn: the tap is
 * echoed into the thread as the user's message, a canned bot line answers it,
 * and that node's children (if any) are attached to the reply — no agent call,
 * no network, no token spend. Selecting a LEAF is a real turn and is handed to
 * `onSendPrompt`, which is AISearch's ordinary sendMessage.
 *
 * There is deliberately no cursor here. The pills live on the MESSAGES that
 * produced them, so the thread itself is the history of where the user has been
 * — every level stays on screen and stays tappable, and tapping an older level
 * again just appends that branch as a fresh turn at the end. A single "current
 * level" would instead have to move, which is what made earlier levels vanish.
 *
 * @param {object}   params
 * @param {(prompt: string, node: object) => void} params.onSendPrompt Called
 *   with a leaf's prompt text when the user reaches one.
 * @param {(userText: string, botText: string, path: string[]) => void} params.onLocalTurn
 *   Called with the two messages a branch tap appends, plus the tree path whose
 *   options the reply should carry.
 * @param {() => void} [params.onDrill] Called on any branch tap — used to retire
 *   the floating root pills once the tree has moved into the thread.
 * @returns {{ select: (node: object, path?: string[]) => void }}
 */
export default function useSuggestionTree ({ onSendPrompt, onLocalTurn, onDrill }) {
  // `select` is handed to memoized message rows; keep it stable by reaching the
  // latest callbacks through refs instead of closing over them.
  const onSendPromptRef = useRef(onSendPrompt)
  onSendPromptRef.current = onSendPrompt
  const onLocalTurnRef = useRef(onLocalTurn)
  onLocalTurnRef.current = onLocalTurn
  const onDrillRef = useRef(onDrill)
  onDrillRef.current = onDrill

  /**
   * @param {object}   node   The tapped node.
   * @param {string[]} [path] Path of the level the node was tapped ON, so the
   *   child level can be addressed as [...path, node.key]. Empty/omitted for the
   *   root pills.
   */
  const select = useCallback((node, path = []) => {
    if (!node) return

    // Local: the app answers. Echo the tap, then hand over the canned reply —
    // with the child level attached when there is one. A local node with no
    // children answers and stops, leaving the user to type the next turn.
    if (isLocal(node)) {
      onDrillRef.current?.()
      onLocalTurnRef.current?.(
        getUserText(node),
        getBranchReply(node),
        hasChildren(node) ? [...path, node.key] : undefined
      )
      return
    }

    // Leaf: a real turn, sent through the normal path.
    const prompt = node.prompt?.()
    if (!prompt) return
    onSendPromptRef.current?.(prompt, node)
  }, [])

  return { select }
}
