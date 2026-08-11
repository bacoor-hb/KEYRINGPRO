import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { View, TextInput, Platform, TouchableOpacity, Keyboard } from 'react-native'
import {
  KeyboardProvider,
  KeyboardController,
  KeyboardEvents,
  AndroidSoftInputModes,
  useReanimatedKeyboardAnimation
} from 'react-native-keyboard-controller'
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n, { currentLanguageBcp47 } from 'assets/Lang'
import LinearGradient from 'react-native-linear-gradient'
import images from 'assets/Image'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MessageBubble from 'frontend/Components/ChatAgent/MessageBubble'
import X402SignModal from 'frontend/Components/ChatAgent/X402SignModal'
import DateSeparator, { shouldShowDateSeparator } from 'frontend/Components/ChatAgent/DateSeparator'
import TypingIndicator from 'frontend/Components/ChatAgent/TypingIndicator'
import ReactNativeHapticFeedback from 'react-native-haptic-feedback'
import { getAgent } from 'frontend/Services/keyringAgent'
import { Colors, pixelByHeight, getSafeAreaValues } from 'common/styles'
import { lowerCase } from 'common/function'
import styles from './styles'
import MyText from 'frontend/Components/UI/MyText'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import { getAiMessages, setAiMessages, makeMessageId } from 'common/aiSearchHistory'
import useInitSuggestions from 'frontend/Hooks/useInitSuggestions'
import useX402Fees from 'frontend/Hooks/useX402Fees'
import useSuggestionTree from 'frontend/Hooks/useSuggestionTree'
import InitSuggestions from 'frontend/Components/ChatAgent/InitSuggestions'
import { getRootSuggestions } from 'frontend/Components/ChatAgent/InitSuggestions/suggestionTree'
import GlassView from 'frontend/Components/UI/GlassView'
import FlatListBlurHeader from 'frontend/Components/UI/FlatListBlurHeader'

// Scrim starts at the top of the input: transparent there, fading to dark by
// the input's bottom, then staying dark down behind the keyboard. Anchored to
// Colors.BLACK via hex alpha (00 = transparent, CC ≈ 80%) instead of a literal.
const SCRIM_COLORS = [`${Colors.BLACK}00`, `${Colors.BLACK}CC`, `${Colors.BLACK}CC`]

const SAFE_BOTTOM = getSafeAreaValues().bottom

// Light tap when a bot reply lands, so the user feels the response arrive even
// if they've looked away. Matches the app's standard haptic options.
const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }

// Bot message rendering: true → read-only TextInput with the full native
// selection menu (Select All / Copy / Look Up / Share), but plain text (no
// Markdown). false → rendered Markdown (bold / lists / links). Flip as desired.
const MESSAGE_SELECTABLE = true

// Same keys, same primitive values? Used to drop no-op `txState` writes without
// hard-coding any one widget's field names — each tx widget persists its own
// shape (a single status/hash, or a two-leg approve+supply pair).
const shallowEqual = (a, b) => {
  if (a === b) return true
  if (!a || !b) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((k) => a[k] === b[k])
}

const AISearchContent = (_this) => {
  const { props, state } = _this

  const accountListRedux = props?.accountListRedux || []
  // Same resolution as index.js: explicit address param wins, else the active
  // account, else the first account. Keeps the chat history bound to the account
  // the user is actually on when no address is passed (footer / NFC entry).
  const walletAddress = lowerCase(props?.route?.params?.address || props?.activeAccount?.account?.address || accountListRedux?.[0]?.address || '')
  const selectedChainId = state?.selectedChainId
  // Device location/region the user consented to share (ISO 3166-1 alpha-2),
  // used by the agent to localize content (e.g. local marketplaces). '' when
  // declined/unknown — the core then falls back to its language-based link.
  const locationCountry = props?.userLocationRedux?.country || ''
  // A message handed in via route params (e.g. tapping an "ask AI" link that
  // routes here) — auto-sent once when the screen opens.
  const initialMessage = props?.route?.params?.initialMessage
  // Which entry point opened this screen (footer search / NFC helper / token
  // list / …). Each session keeps its own conversation per address, so the
  // history is stored & seeded under (sessionKey, address). Undefined falls
  // back to the general bucket inside the history helpers.
  const sessionKey = props?.route?.params?.sessionKey
  // Optional structured tool call handed in via route params (e.g. the token
  // detail screen's "Learn more" → get-token-info). When present AND the core
  // exposes runTool, the auto-send runs this tool DIRECTLY — skipping the router
  // and LLM arg-parsing. Otherwise it falls back to sending `initialMessage`
  // through the normal chat() pipeline (safe on cores that predate runTool).
  // Shape: { name, args }.
  const directTool = props?.route?.params?.directTool

  const agentRef = useRef(null)
  if (!agentRef.current) agentRef.current = getAgent()
  // Latest wallet address, read by the x402 signer closure (registered once).
  const walletAddressRef = useRef(walletAddress)
  walletAddressRef.current = walletAddress
  // Holds the in-flight x402 signer's `resolve` while the approval sheet is open.
  const x402ResolveRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const inFlightRef = useRef(false)
  // The in-flight chat() promise + a monotonically-increasing turn id. When the
  // user sends a new message mid-turn we abort the running turn and wait for it
  // to settle (its history rollback must finish before the next turn starts),
  // then ignore any late result from a turn that's no longer the latest.
  const inFlightPromiseRef = useRef(null)
  const requestSeqRef = useRef(0)
  // sendMessage is a stable callback (empty deps) and reaches the scroller
  // through a ref rather than closing over it.
  const scrollToBottomRef = useRef(() => {})
  // Tracks the last chain so we can detect a real user switch (vs the initial
  // default selection) and wipe the agent's memory on switch.
  const prevChainRef = useRef(undefined)
  // Guards the route-param auto-send so it fires exactly once.
  const initialSentRef = useRef(false)
  // The exact array the seed effect handed to `setMessages`, plus whether that
  // value has actually been applied to `messages` yet. React state lags a render
  // behind, so right after mount or an address switch `messages` still holds the
  // initial/previous value for one render — these let the save effect wait until
  // `messages` reflects the active address before persisting (otherwise it would
  // write the wrong address's data, or overwrite stored history with empty).
  const seededRef = useRef(null)
  const seedAppliedRef = useRef(false)
  // The thread key (`session::address`) the seed effect has already run for.
  // The effect depends on the redux history map so it re-runs when that map
  // REHYDRATES from AsyncStorage (it is empty on the first render or two, and a
  // seed taken from it then would show an empty conversation). But every save
  // also replaces that map, and re-seeding on those would throw away the live
  // conversation — so this makes the seed fire once per thread and ignore all
  // later map updates.
  const seededThreadRef = useRef(null)
  // Latest persisted history map ({ [address]: Message[] }) from redux, kept in a
  // ref so the seed/save effects read the current value without depending on it
  // (a dispatch updates the map, which must not re-trigger the seed effect).
  const historyMap = props?.aiSearchHistoryRedux
  const historyMapRef = useRef(historyMap)
  historyMapRef.current = historyMap
  // Dispatch that persists the per-address history map (stable across renders).
  const setAiSearchHistory = props?.setAiSearchHistory

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [footerHeight, setFooterHeight] = useState(0)
  // Live keyboard height as a Reanimated shared value (negative while the keyboard
  // is up — it's meant to be used directly as a translateY). This drives the
  // footer's lift on the UI thread, in sync with the real keyboard frame, on both
  // platforms. Deliberately never mirrored into state per-frame — see the
  // KeyboardEvents effect below for the settled value React gets to see.
  const { height: keyboardHeightSV, progress: keyboardProgressSV } = useReanimatedKeyboardAnimation()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  // Shows a "scroll to bottom" button while the user is scrolled up away from
  // the latest message.
  const [showScrollDown, setShowScrollDown] = useState(false)
  // The pending x402 payment to approve ({ typedData, display }) while the core
  // awaits a signature; null when no approval is in flight.
  const [x402Req, setX402Req] = useState(null)

  // Register the x402 signer ONCE. When the agent calls an API that returns 402,
  // the core builds the payment and AWAITS this function: we surface the approval
  // sheet and resolve with the signature when the user approves (or null if they
  // cancel). The core then re-calls the API and answers — all in one chat() turn.
  useEffect(() => {
    agentRef.current.setX402Signer?.(({ typedData, display }) => new Promise((resolve) => {
      x402ResolveRef.current = resolve
      setX402Req({ typedData, display })
    }))
    return () => agentRef.current?.setX402Signer?.(null)
  }, [])

  // Resolve the awaiting signer with the signature (or null) and close the sheet.
  const handleX402Resolve = useCallback((signature) => {
    const resolve = x402ResolveRef.current
    x402ResolveRef.current = null
    setX402Req(null)
    resolve?.(signature)
  }, [])

  // setUserContext replaces the whole context, so set wallet + chain together.
  // The agent's normalizeChain accepts a decimal chain id, so pass it as-is.
  useEffect(() => {
    agentRef.current.setUserContext({
      walletAddress: walletAddress || null,
      chain: selectedChainId != null ? String(selectedChainId) : null,
      country: locationCountry || null
    })

    // Switching to a different chain wipes the agent's conversation memory so the
    // new chain's turns don't carry over old context. The UI messages are kept
    // on purpose (only the agent forgets). Skip the initial default selection.
    const prev = prevChainRef.current
    if (prev != null && selectedChainId != null && prev !== selectedChainId) {
      agentRef.current.clearHistory?.()
    }
    prevChainRef.current = selectedChainId
  }, [walletAddress, selectedChainId, locationCountry])

  // Auto-focus the input when the screen opens so the user can start typing
  // straight away. Delayed so the navigation transition finishes first — a
  // focus() issued mid-transition is dropped on both platforms.
  //
  // The retry matters on Android: the focus can land (caret shows) without the
  // IME actually coming up, if it fires while the screen/KeyboardProvider is still
  // settling. Re-issuing focus once the keyboard is still not visible reliably
  // brings it up, and costs nothing when the first attempt already worked.
  useEffect(() => {
    // When a turn is auto-sent from a route param, the user is reading the reply
    // — don't pop the keyboard over it.
    if (initialMessage) return
    const timers = []
    timers.push(setTimeout(() => {
      inputRef.current?.focus()
      timers.push(setTimeout(() => {
        if (!KeyboardController.isVisible()) {
          // focus() on an already-focused input is a NO-OP, so it can't summon
          // an IME that failed to come up (caret showing, no keyboard). Blur
          // first so the next focus really re-requests the keyboard.
          inputRef.current?.blur()
          timers.push(setTimeout(() => inputRef.current?.focus(), 50))
        }
      }, 300))
    }, 350))
    return () => timers.forEach(clearTimeout)
  }, [initialMessage])

  // Settled keyboard height, for the plain-JS consumers that can't read a shared
  // value during render (list padding + scrim geometry). KeyboardEvents fires only
  // at the START and END of a keyboard transition, so this commits exactly twice
  // per open/close — never once per animation frame, which would re-render the
  // screen ~60x and re-lay out the list each time (the stutter).
  useEffect(() => {
    const show = KeyboardEvents.addListener('keyboardWillShow', (e) => setKeyboardHeight(e.height))
    const hide = KeyboardEvents.addListener('keyboardWillHide', () => setKeyboardHeight(0))
    return () => { show.remove(); hide.remove() }
  }, [])

  // The init suggestion pills: when they show, when a user interaction takes
  // them down, and when time away brings them back. See the hook for the rules.
  const { visible: showSuggestions, dismiss: dismissInitSuggestions } = useInitSuggestions({
    address: walletAddress,
    session: sessionKey,
    navigation: props?.navigation
  })
  // Which root pill set this entry point opens on. Sessions without their own
  // fall back to the default agent tree.
  const rootSuggestions = useMemo(() => getRootSuggestions(sessionKey), [sessionKey])
  // The x402 price list, so the paid pills can print what the action will
  // actually cost. Fetched once per session and cached; the pills read it out of
  // the tree's module cache and repaint themselves when it lands, so this only
  // has to be MOUNTED — nothing here consumes its return value. Until the prices
  // arrive the pills render their no-fee copy.
  useX402Fees()

  // sendMessage is a stable callback (empty deps), so it reaches the latest
  // dismiss through a ref rather than closing over it.
  const dismissInitSuggestionsRef = useRef(dismissInitSuggestions)
  dismissInitSuggestionsRef.current = dismissInitSuggestions

  // Seed the visible conversation from redux for the active address. Re-runs on
  // address change so each address shows its own messages. It depends on the
  // redux map (rather than reading it through a ref) so a map that arrives late
  // is never missed; `seededThreadRef` is what keeps the later map updates from
  // re-seeding. `seedAppliedRef` is armed here and cleared until `messages`
  // catches up (see the save effect).
  useEffect(() => {
    // Wait for the address to resolve: it starts as '' and only becomes the real
    // account a render later, and a seed taken before then is for no thread at all.
    if (!walletAddress) return
    // Already seeded this thread — this run is just a later map update (a save),
    // which must not clobber the live conversation. Only a genuine thread switch
    // gets past here.
    const threadKey = `${sessionKey || ''}::${walletAddress}`
    if (seededThreadRef.current === threadKey) return
    seededThreadRef.current = threadKey

    const seeded = getAiMessages(historyMap, walletAddress, sessionKey)
    seededRef.current = seeded
    seedAppliedRef.current = false
    // A restore opens on the newest message — which, inverted, is simply where
    // the list already is. No scroll needed.
    setMessages(seeded)
  }, [walletAddress, sessionKey, historyMap])

  // Persist the visible conversation into the per-address redux map. Until the
  // seed has been applied (i.e. `messages` matches the seeded value), skip —
  // this is the one render where `messages` still holds the previous address's
  // data (or the initial empty), which must not be written under this address.
  // Once caught up, persist real changes, skipping no-op writes.
  useEffect(() => {
    if (!walletAddress) return
    if (!seedAppliedRef.current) {
      if (messages === seededRef.current) seedAppliedRef.current = true
      return
    }
    if (getAiMessages(historyMapRef.current, walletAddress, sessionKey) === messages) return
    setAiSearchHistory(setAiMessages(historyMapRef.current, walletAddress, messages, sessionKey))
  }, [messages, walletAddress, sessionKey, setAiSearchHistory])

  // ===== Scrolling =====
  //
  // The list is INVERTED, which is what makes this section small. Offset 0 is
  // the newest message, so "the bottom" is a fixed coordinate rather than
  // something that has to be measured against a growing content height — and
  // the list already rests there. Opening a conversation, appending a turn and
  // the keyboard resizing therefore need no scroll at all: new content is added
  // at offset 0 and the older rows slide away from the viewport on their own.
  //
  // That removes every piece of machinery this screen used to need: the end
  // anchor and its native measureLayout pass, the Android re-assert timer, the
  // onContentSizeChange scroller, and the follow-bottom tracking that decided
  // whether an arriving message was allowed to move the list.

  // Jump to the newest message. The ONLY programmatic scroll left on this
  // screen: the jump-to-bottom button, and bringing the user back down when
  // they send while scrolled up. Nothing scrolls when content arrives.
  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToOffset?.({ offset: 0, animated })
  }, [])

  // Inverted: contentOffset.y IS the distance from the newest message, so the
  // jump-to-bottom button needs no content-size arithmetic at all.
  const handleScroll = useCallback((e) => {
    setShowScrollDown(e.nativeEvent.contentOffset.y > pixelByHeight(120))
  }, [])

  scrollToBottomRef.current = scrollToBottom

  const handleScrollToBottom = useCallback(() => {
    setShowScrollDown(false)
    scrollToBottom(true)
  }, [scrollToBottom])

  const sendMessage = useCallback(async (text, language, options) => {
    const trimmed = (text || '').trim()
    if (!trimmed) return

    // A turn is still running: abort it and wait for it to fully settle before
    // starting the new one. The agent rolls its history back to the pre-turn
    // snapshot when aborted — that rollback runs as the old chat() promise
    // rejects, so we must await it or it could wipe the new turn's messages.
    if (inFlightRef.current) {
      agentRef.current?.stop?.()
      try { await inFlightPromiseRef.current } catch (_) { /* aborted turn rejects — expected */ }
    }

    const seq = ++requestSeqRef.current
    inFlightRef.current = true
    // Any send takes the pills down — tapping a pill goes through here too, so
    // this one path covers both ways of dismissing them.
    dismissInitSuggestionsRef.current()
    // Bring the user back to the newest message if they had scrolled up to read;
    // their own message must land in view. A no-op when they were already there,
    // which is the common case.
    scrollToBottomRef.current()
    // Tag the user message with an id so its reply can link back via replyToId —
    // that pairing is how we later tell an answered question from one the user
    // stopped/abandoned (see isQuestionAnswered).
    const userMessageId = makeMessageId()
    setMessages((prev) => [...prev, { role: 'user', content: trimmed, timestamp: Date.now(), id: userMessageId }])
    setInput('')
    Keyboard.dismiss()
    setIsThinking(true)

    // Hoisted so finally() can match it against inFlightPromiseRef (const inside
    // try is out of scope there).
    let turnPromise = null

    // Intentionally do NOT dismiss the keyboard on send — keep it up so the user
    // can fire off follow-up turns without re-tapping the input (ChatGPT-style),
    // and so the footer doesn't slide down and cancel this button's press.
    // Dismiss explicitly with Keyboard.dismiss() only where it's actually wanted.
    try {
      // `language` is set when this turn comes from an action-button tap — the
      // button's prompt is often synthetic English, so we pin the conversation
      // language to keep the reply/form in the user's language.
      //
      // Direct-tool fast path: when the caller already knows which tool to run
      // (options.directTool) AND the core exposes runTool, execute it straight
      // away — skipping the router + LLM arg-parsing. `trimmed` is the visible
      // question, passed as the synthesiser's userMessage so the answer reads
      // (and is localized) exactly like a chat() reply. Falls back to chat() on
      // older cores so this is always safe.
      const directTool = options?.directTool
      turnPromise = (directTool && typeof agentRef.current.runTool === 'function')
        ? agentRef.current.runTool(directTool.name, directTool.args, { userMessage: trimmed, ...(language ? { language } : {}) })
        : agentRef.current.chat(trimmed, language ? { language } : undefined)
      inFlightPromiseRef.current = turnPromise
      const res = await turnPromise
      // A newer turn superseded this one — drop its result.
      if (seq !== requestSeqRef.current) return
      // Light tap so the reply arriving is felt, not just seen.
      ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res?.answer || '...',
        timestamp: Date.now(),
        messageId: res?.messageId || null,
        // Link this reply to the question it answers, so a later open can tell
        // this question was actually answered (see isQuestionAnswered).
        replyToId: userMessageId,
        uiActions: Array.isArray(res?.uiActions) ? res.uiActions : [],
        // Clickable buttons the core attaches to a reply (e.g. token / chain
        // picks). Rendered stacked at the end of the list.
        actionButtons: Array.isArray(res?.actionButtons) ? res.actionButtons : []
      }])
      // No scroll here on purpose. The list is inverted and already rests on the
      // newest content, so the reply simply appears in place. An earlier version
      // scrolled to park the question at the top, which meant the reply rendered
      // at the bottom and THEN slid away — the movement that read as sluggish.
    } catch (err) {
      // User tapped Stop (or sent a replacement message) — the turn was cancelled
      // on purpose. The agent rolled its history back, so just leave the user's
      // message in place (like ChatGPT) and surface nothing.
      if (err?.name === 'AbortError') return
      if (seq !== requestSeqRef.current) return
      // console.log('AISearch chat error:', err, err?.stack)
      // Surface the real error while debugging so we can see what Hermes/the
      // agent is choking on. TODO: revert to a friendly message once stable.
      const detail = err?.message || String(err)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: __DEV__ ? `⚠️ ${detail}` : 'Sorry, an error occurred while processing your request. Please try again.',
        timestamp: Date.now(),
        // Still link it to the question, but mark it an error so the question is
        // treated as unanswered and retried on the next open.
        replyToId: userMessageId,
        isError: true,
        uiActions: []
      }])
    } finally {
      // Lifecycle vs. UI are cleared on different conditions:
      // - inFlightRef tracks THIS turn's promise — clear it whenever this turn is
      //   the one still on inFlightPromiseRef, even if it was superseded (e.g. by
      //   Stop bumping the seq). Otherwise a stopped turn would leave the flag
      //   stuck true forever.
      // - isThinking is a shared UI flag only the latest turn owns, so a late
      //   settling old turn must not clear the new turn's spinner. (When Stop ran,
      //   it already cleared the spinner itself.)
      if (inFlightPromiseRef.current === turnPromise) inFlightRef.current = false
      if (seq === requestSeqRef.current) setIsThinking(false)
    }
  }, [])

  // How long the typing indicator runs before a LOCAL (canned) reply lands. A
  // real turn has genuine latency; a local one is instant, and popping the answer
  // out the same frame as the tap reads as a UI glitch rather than a reply. The
  // pause gives it the rhythm of the agent actually answering.
  const LOCAL_REPLY_DELAY = 1500

  // Pending local-reply timer, so unmounting mid-pause doesn't setState on a
  // dead component (and a rapid second tap doesn't leave two timers racing).
  const localReplyTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(localReplyTimerRef.current), [])

  // A LOCAL turn from the suggestion tree: the user's tap and the canned answer
  // are written straight into the thread, with no agent call. They are ordinary
  // messages (persisted, timestamped, id-linked like a real turn) so the history
  // reads back identically after leaving and returning.
  //
  // `path` is the tree position the reply's pills should show — stored on the
  // message as keys (not nodes) so it survives persistence and re-translates on
  // a language switch. Because the pills ride on the MESSAGE, every level the
  // user drilled through stays in the thread and stays tappable; only the
  // floating root pair is taken down (see the dismiss in select below).
  const appendLocalTurn = useCallback((userText, botText, path) => {
    const userMessageId = makeMessageId()
    const now = Date.now()
    // The tap echoes immediately — only the ANSWER waits.
    setMessages((prev) => [...prev, { role: 'user', content: userText, timestamp: now, id: userMessageId }])
    // The user tapped while possibly scrolled up — their own message must land
    // in view. A no-op when they were already at the newest message.
    scrollToBottomRef.current()
    setIsThinking(true)

    clearTimeout(localReplyTimerRef.current)
    localReplyTimerRef.current = setTimeout(() => {
      setIsThinking(false)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: botText,
        timestamp: Date.now(),
        replyToId: userMessageId,
        // Marks the reply as canned app copy rather than an agent answer, so
        // nothing downstream mistakes it for a model response.
        isLocal: true,
        suggestionPath: path,
        uiActions: [],
        actionButtons: []
      }])
    }, LOCAL_REPLY_DELAY)
  }, [])

  // Walks the suggestion tree: branches drill down locally via appendLocalTurn,
  // leaves send a real turn. The prompt is translated app copy, so the reply
  // language is pinned explicitly (as the reply action buttons do) rather than
  // left for the agent to guess from the prompt text.
  const { select: selectSuggestion } = useSuggestionTree({
    onSendPrompt: useCallback((prompt) => sendMessage(prompt, currentLanguageBcp47()), [sendMessage]),
    onLocalTurn: appendLocalTurn,
    // The first drill-down takes the floating root pills down for good — from
    // then on the tree lives in the thread. Leaf taps dismiss via sendMessage.
    onDrill: useCallback(() => dismissInitSuggestionsRef.current(), [])
  })

  // Cancel the in-flight turn. The agent aborts the live LLM request, rolls its
  // history back to the pre-turn state, and the chat() promise rejects with an
  // AbortError that sendMessage swallows.
  //
  // We clear the "thinking" UI RIGHT HERE instead of waiting for that promise to
  // reject: an in-flight LLM stream / tool request can take a moment to actually
  // unwind after abort(), and making the user watch the spinner until then feels
  // like Stop "didn't work". Bumping requestSeqRef marks the turn superseded, so
  // when its promise finally settles sendMessage's guards drop the result and its
  // finally() no longer owns the UI flags (won't fight this immediate reset). The
  // agent's own rollback still runs in the background; the next sendMessage awaits
  // inFlightPromiseRef before starting, so history stays consistent.
  const handleStop = useCallback(() => {
    agentRef.current?.stop?.()
    requestSeqRef.current++
    setIsThinking(false)
  }, [])

  // Auto-send a message passed via route params (e.g. an "ask AI" link). Wait
  // until history is restored so the appended turn isn't wiped by the restore,
  // and guard so it fires only once.
  useEffect(() => {
    if (!initialMessage || initialSentRef.current) return
    let cancelled = false
    const fire = () => {
      if (cancelled || initialSentRef.current) return
      initialSentRef.current = true
      // Forward the structured tool call (if any) so the first turn runs via the
      // direct-tool fast path; without it AISearch sends the plain initialMessage.
      // For a direct tool, pin the reply to the app language too — the auto-send
      // prompt is often synthetic, so we don't want the core guessing the
      // language off it. Plain chat keeps the guess-from-message behavior.
      sendMessage(
        initialMessage,
        directTool ? currentLanguageBcp47() : undefined,
        directTool ? { directTool } : undefined
      )
    }
    const run = async () => {
      // The device region is read at app start (see App.js) and already flows
      // into the agent context via `locationCountry`, so here we only wait for
      // history to restore so the appended turn isn't wiped.
      const ready = agentRef.current.historyReady
      if (ready?.then) { try { await ready } catch (_) { /* ignore restore errors */ } }
      fire()
    }
    run()
    return () => { cancelled = true }
  }, [initialMessage, directTool, sendMessage])

  // NOTE: there is deliberately no onStatusChange handler for tx widgets any
  // more. It existed to follow a widget's status change down to the bottom of
  // the list; inverted, a row growing extends away from the anchored newest
  // content instead of pushing it out of view, so nothing needs to move. Widgets
  // also poll on a timer the user cannot see, and scrolling from one used to
  // yank the list out from under them mid-read.

  // Persist a tx widget's live status/hash back into its message so the timeline
  // survives leaving and returning to the chat (the widget otherwise remounts to
  // IDLE and loses the state). Matches the message by identity, then stamps
  // `txState` onto the target uiAction's props. Immutable update so MessageBubble
  // (memoized on uiActions identity) re-renders and the save effect persists it.
  const handleWidgetPersist = useCallback((targetMessage, actionIdx, txState) => {
    setMessages((prev) => {
      // `targetMessage` is the shallow copy produced by the `data` memo (it adds
      // showDateSeparator), so it isn't reference-equal to any element here —
      // match on the message's stable identifiers instead.
      const mi = prev.findIndex((m) =>
        m.timestamp === targetMessage.timestamp &&
        m.replyToId === targetMessage.replyToId &&
        m.role === targetMessage.role
      )
      if (mi === -1) return prev
      const msg = prev[mi]
      const action = msg.uiActions?.[actionIdx]
      if (!action) return prev
      // No-op if nothing changed, so we don't churn state/persistence.
      //
      // Compared field-agnostically: widgets persist DIFFERENT shapes — the
      // wallet-action forms send `{status, txHash, …}` while the supply card
      // sends `{step, approveHash, supplyHash, …}` for its two-transaction
      // flow. Naming `status`/`txHash` here made every supply update compare
      // `undefined === undefined` and get dropped as a no-op, so its timeline
      // never survived a remount.
      //
      // Comparing every key also matters for fields that move while status and
      // hash both stand still: `x402Paid` is set during GATING with no hash yet,
      // and dropping that write would let a retry charge the user's fee twice.
      const cur = action.props?.txState
      if (cur && shallowEqual(cur, txState)) return prev

      const nextActions = msg.uiActions.map((a, i) =>
        i === actionIdx ? { ...a, props: { ...a.props, txState } } : a
      )
      const next = prev.slice()
      next[mi] = { ...msg, uiActions: nextActions }
      return next
    })
  }, [])

  // Copy a tx hash and surface the app's standard "copied" toast — same call
  // shape as the send-token flow (message first, `type: 'toast'`) so the two
  // screens show the identical toast instead of a default alert.
  const handleCopyHash = useCallback((value) => {
    if (!value) return
    Clipboard.setString(value)
    _this.func.showAlert?.(I18n.t('Initial.copyDone', { value: I18n.t('v2.common.hash') }), '', { type: 'toast' })
  }, [_this])

  // The list renders INVERTED (see the FlatList below): it is flipped upside
  // down, so index 0 is drawn at the BOTTOM. Feeding it newest-first therefore
  // puts the newest message at the bottom of the screen — where the viewport
  // already sits at rest, so opening a conversation needs no scrolling at all.
  //
  // The whole history goes in: since the newest messages are now at the START of
  // the array, FlatList's own virtualization (initialNumToRender) mounts only
  // the screenful the user can actually see, and the older ones stay unmounted
  // until scrolled to. No hand-rolled windowing needed.
  //
  // The date separator still belongs above its message and is still computed
  // against the message that PRECEDES it in time — which, after reversing, is
  // the NEXT element in this array. Each row draws its own separator first, and
  // since rows come out upright the separator lands above the bubble as usual.
  const data = useMemo(() => {
    const reversed = messages.slice().reverse()
    return reversed.map((item, index) => ({
      ...item,
      showDateSeparator: shouldShowDateSeparator(item, reversed[index + 1])
    }))
  }, [messages])

  // NO counter-flip here. React Native's `inverted` prop already applies
  // scaleY: -1 to BOTH the backing ScrollView and its cell renderers, so rows
  // come out the right way up on their own. Adding our own flip made it a third
  // transform and turned all the text upside down.
  const renderItem = useCallback(
    ({ item }) => (
      <View>
        {/* Drawn FIRST so it sits above the bubble on screen, i.e. between this
            message and the older one, exactly as before the flip. */}
        {item.showDateSeparator && <DateSeparator timestamp={item.timestamp} />}
        <MessageBubble
          message={item}
          onSend={sendMessage}
          onCopyHash={handleCopyHash}
          onPersist={handleWidgetPersist}
          onSelectSuggestion={selectSuggestion}
          selectable={MESSAGE_SELECTABLE}
          // The screen container, so a widget nested in this bubble can open a
          // real app drawer (this.openDrawer) — its own MyDrawerUI would be
          // positioned against the bubble, not the screen.
          screenRef={_this.func}
        />
      </View>
    ),
    [sendMessage, handleCopyHash, handleWidgetPersist, selectSuggestion, _this.func]
  )

  // Lift the floating footer (and the jump-to-bottom button riding above it) by
  // the live keyboard height, on the UI thread so it tracks the keyboard frame
  // exactly instead of snapping after the fact.
  //
  // The `progress * SAFE_BOTTOM/2` term folds the "sit closer to the keyboard"
  // adjustment into the SAME animated transform: with the keyboard open the
  // footer only needs half the safe-area gap (the keyboard covers the home
  // indicator area), and morphing it here keeps it in sync with the keyboard
  // frame. The old approach — swapping the footer's paddingBottom between
  // SAFE_BOTTOM and SAFE_BOTTOM/2 via state — resized the footer in ONE jump at
  // the start of the transition while the translate animated smoothly, which
  // read as the input "jerking" on every keyboard open/close. The footer's
  // height is now constant, so its onLayout also fires exactly once.
  //
  // This translateY is the ONLY thing that moves the footer, on both platforms:
  // the screen runs Android in SOFT_INPUT_ADJUST_NOTHING (see AndroidSoftInputMode
  // at the bottom of the file), so the window itself never pans or resizes.
  const footerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboardHeightSV.value + keyboardProgressSV.value * (SAFE_BOTTOM / 2) }]
  }))

  // Scrim spans from the input's top down to the screen bottom (covering the
  // keyboard). The fade-to-dark finishes by the input's bottom, so its location
  // is the input (footer) height over the full scrim height.
  const scrimTotal = footerHeight + keyboardHeight
  const scrimFadeFrac = scrimTotal > 0 ? footerHeight / scrimTotal : 0.5

  return (
    <MyViewPage style={styles.container}>
      <FlatListBlurHeader
        ref={listRef}
        style={styles.list}
        data={data}
        keyExtractor={(item, index) => item.id || (item.replyToId ? `reply-${item.replyToId}` : `${item.role}-${item.timestamp}-${index}`)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        // THE INVERSION. The list is flipped vertically, so index 0 renders at
        // the BOTTOM of the screen and the resting scroll offset (0) already IS
        // the newest message. Nothing has to scroll when the screen opens, when a
        // turn is appended, or when the keyboard resizes the viewport — which is
        // what removed the auto-scroll stutter on slower devices.
        inverted
        // Header and footer swap places under the flip: ListHeaderComponent is
        // drawn at the START of the data, which inverted means the BOTTOM of the
        // screen. So the things that belong below the newest message — the typing
        // indicator and the suggestion pills — go here, and the welcome text that
        // belongs above the OLDEST message goes in the footer.
        //
        // Like the rows, these need no counter-flip: VirtualizedList composes its
        // inversion style onto the header/footer wrappers too, so each block is
        // flipped once and back. Children inside a block therefore keep their
        // normal top-to-bottom order — only the blocks themselves swap ends.
        ListHeaderComponent={(
          <View style={{ paddingBottom: footerHeight + keyboardHeight + pixelByHeight(20) }}>
            {isThinking ? <TypingIndicator /> : null}
            {/* The ROOT pills only, and the root the SESSION asked for (a
                feature entry point opens on its own set — see
                getRootSuggestions). Every deeper level renders inside the reply
                that produced it (see MessageBubble's suggestionPath), which is
                what keeps earlier levels on screen and tappable. */}
            {showSuggestions && <InitSuggestions options={rootSuggestions} onSelect={selectSuggestion} />}
          </View>
        )}
        ListFooterComponent={(
          <MyText style={styles.textIntroduce}>{I18n.t('AISearch.welcome')}</MyText>
        )}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        // Defaults to TRUE on Android only. It detaches offscreen rows, so
        // scrolling back over them remounts and re-measures each bubble — with
        // variable-height content that re-measure shifts the rows below it, which
        // reads as the list juddering and losing its place. iOS defaults to false,
        // which is why the same list scrolls smoothly there. Pin it off on both.
        removeClippedSubviews={false}
        // Virtualization budget for a long thread. removeClippedSubviews is off
        // above (variable-height bubbles judder when detached/re-measured), so
        // these are what actually keep a big conversation cheap: FlatList mounts
        // ~windowSize screenfuls around the viewport and leaves the rest as blank
        // spacer, and each scroll batch renders at most maxToRenderPerBatch rows.
        //
        // Tuned for THIS list, not FlatList's defaults (windowSize 21 / batch 10):
        // - windowSize 7 (~3 screens up + viewport + 3 down) is plenty of scroll
        //   buffer for a chat; higher just mounts more offscreen bubbles for no
        //   visible gain since the user reads from the bottom.
        // - initialNumToRender 15 is what the list opens with. Inverted, those
        //   are the NEWEST messages and they are exactly what fills the screen,
        //   so this alone keeps opening a long thread cheap — the older rows are
        //   never mounted until scrolled to.
        // - updateCellsBatchingPeriod 50ms spreads the fill so mounting a batch
        //   doesn't block a scroll frame.
        windowSize={7}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        // 'always', not 'handled': the list fills the screen and the floating
        // footer/send-button sits on top of its frame. 'handled' installs a
        // native tap-to-dismiss recognizer over that frame that races (and beats)
        // the button's JS press — dismissing the keyboard, sliding the footer, and
        // cancelling the tap. 'always' disables that recognizer, so taps never
        // auto-dismiss; the keyboard only closes when we call Keyboard.dismiss().
        // keyboardShouldPersistTaps='always'
        showsVerticalScrollIndicator={false}
      />

      {/* Jump-to-bottom — floats just above the input, only while scrolled up.
          Rides the same keyboard translate as the footer so it stays glued to it. */}
      {showScrollDown && messages.length > 0 && (
        <Reanimated.View
          style={[styles.scrollDownWrap, { bottom: footerHeight }, footerAnimStyle]}
          pointerEvents='box-none'
        >
          <TouchableOpacity activeOpacity={0.8} onPress={handleScrollToBottom}>
            {isThinking ? (
              <GlassView interactive effect='clear' style={styles.scrollDownBtnThinking}>
                <TypingIndicator bare />
              </GlassView>
            ) : (
              <GlassView interactive effect='clear' style={styles.scrollDownBtn}>
                <MyIcon uri={images.UIV2.icons.goArrowDownLow} style={styles.scrollDownIcon} />
              </GlassView>
            )}
          </TouchableOpacity>
        </Reanimated.View>
      )}

      <Reanimated.View
        style={[styles.footer, footerAnimStyle]}
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      >
        <LinearGradient
          colors={SCRIM_COLORS}
          locations={[0, scrimFadeFrac, 1]}
          // Extends below the footer to cover the keyboard area. The footer is
          // translated up by the keyboard height, so the scrim has to reach the
          // same distance back down to still touch the screen bottom.
          style={[styles.scrim, { top: 0, bottom: -keyboardHeight }]}
          pointerEvents='none'
        />
        <TouchableOpacity
          onPress={() => {
            inputRef.current?.focus()
          }}
          activeOpacity={1}
          style={{

            flex: 1
          }}>
          <GlassView interactive effect='clear' style={styles.searchWrap}>
            <View style={styles.searchInner}>
              <MyIcon uri={images.UIV2.icons.aiChat} style={styles.AIicon} />
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder={I18n.t('v2.aiSearch.searchPlaceholder')}
                placeholderTextColor={Colors.TEXT_MEDIUM}
                style={styles.input}
                returnKeyType='send'
                // While a turn runs, typing is allowed but the keyboard send key
                // is a no-op — sending is blocked until the turn finishes/stops.
                onSubmitEditing={() => !isThinking && sendMessage(input)}
              />
            </View>
          </GlassView>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => (isThinking ? handleStop() : sendMessage(input))}

        >
          <GlassView
            interactive
            effect='clear'
            style={[styles.roundBtn, !isThinking && !input.trim() && styles.roundBtnDisabled]}
          >
            {isThinking
              ? <MyIcon uri={images.UIV2.icons.home.icon_stop} style={styles.searchIcon} />
              : <MyIcon uri={images.UIV2.icons.home.send} style={styles.searchIcon} />}
          </GlassView>
        </TouchableOpacity>
      </Reanimated.View>

      {/* x402 payment approval — surfaced while the core awaits a signature. */}
      <X402SignModal
        request={x402Req}
        walletAddress={walletAddress}
        onResolve={handleX402Resolve}
        screenRef={_this.func}
      />
    </MyViewPage>
  )
}

// Scope react-native-keyboard-controller to THIS screen only — the rest of the
// app keeps the manifest's `adjustPan` and its existing keyboard handling.
// KeyboardProvider restores the previous soft-input mode on unmount, so nothing
// leaks to other screens.
//
// Android soft-input mode matters a lot here, because the footer is already
// lifted by our own translateY:
//   - adjustPan (the manifest default) pans the window by the CARET, so it moved
//     the footer a second time, by the wrong amount — the original bug.
//   - adjustResize (KeyboardProvider's default) shrinks the window, which ALSO
//     moves everything a second time and re-lays out the header/list mid-
//     animation — that's the stutter.
// SOFT_INPUT_ADJUST_NOTHING tells Android to leave the window alone entirely, so
// our translateY is the single source of truth for the footer's position and the
// header never moves. This is the mode the library documents for exactly this
// "I animate the keyboard myself" case.
//
// The hooks inside AISearchContent must run UNDER the provider, so it has to be
// a child element — not a call — hence the extra component layer. The whole
// container instance is passed through as the single `_this` prop, matching how
// BaseContainer's Template invokes this page.
const AISearchPage = (_this) => (
  <KeyboardProvider
    statusBarTranslucent
    navigationBarTranslucent
  >
    <AndroidSoftInputMode />
    <AISearchContent {..._this} />
  </KeyboardProvider>
)

// Applies SOFT_INPUT_ADJUST_NOTHING for as long as this screen is mounted, and
// hands the window back to the app's default (adjustPan) on the way out.
const AndroidSoftInputMode = () => {
  useEffect(() => {
    if (Platform.OS !== 'android') return
    KeyboardController.setInputMode(AndroidSoftInputModes.SOFT_INPUT_ADJUST_NOTHING)
    return () => KeyboardController.setDefaultMode()
  }, [])
  return null
}

export default AISearchPage
