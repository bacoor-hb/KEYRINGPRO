import { WebsiteTrustKeyringAgent } from 'keyring-agent-core'
import { REVIEW_URL_STATUS } from 'common/constants/app'
import { getWalletconnectSiteOfficalStatus } from 'common/chain'
import ReduxService from 'common/redux'

// The five UI states the connect modal can render for the URL-safety section.
// They map 1:1 to the Figma designs (see WalletConnectConnectModal):
//   OFFICIAL     -> Success icon, neutral info card with the AI/official message, blue Connect
//                   (covers both 3.1 server-official and 3.3 AI-says-safe)
//   PHISHING_API -> Phishing icon, NO info card, blue Connect          (3.2 server flags phishing)
//   AI_PHISHING  -> Phishing icon, RED info card with the AI message, red Connect  (3.4)
//   ERROR        -> Website icon, neutral info card "couldn't retrieve data", blue Connect (3.5)
//   LOADING      -> while the assessment is in flight
export const WC_VERIFY_STATE = {
  LOADING: 'loading',
  OFFICIAL: 'official',
  PHISHING_API: 'phishing_api',
  AI_PHISHING: 'ai_phishing',
  ERROR: 'error'
}

// How long we wait for the (server + AI) assessment before falling back to the
// neutral ERROR state (3.5). Kept generous because the AI pass can be slow.
export const WC_ASSESS_TIMEOUT_MS = 30000

// The app stores its own locale keys (vn, jp, kr, cn...); the agent wants a
// BCP-47 tag (vi, ja, ko, zh...). Map so the AI answer comes back in the app's
// language; unknown locales fall back to English.
const APP_LOCALE_TO_LANG = {
  vn: 'vi',
  jp: 'ja',
  kr: 'ko',
  cn: 'zh',
  cn2: 'zh-TW',
  en: 'en',
  de: 'de',
  es: 'es',
  fr: 'fr',
  it: 'it',
  nl: 'nl',
  pl: 'pl',
  pt: 'pt',
  ru: 'ru',
  th: 'th',
  tr: 'tr'
}

const getAgentLanguage = () => {
  const locale = ReduxService.getReduxDataByKey('localeRedux')
  return APP_LOCALE_TO_LANG[locale] || 'en'
}

/**
 * AI URL check via the WebsiteTrustKeyringAgent (keyring-agent-core).
 *
 *  - isMarkOfficial=true  (server already says OFFICIAL): the agent SKIPS the
 *    phishing checks and just describes what the site is (`isPhishing` is false).
 *  - isMarkOfficial=false (server has no opinion): the agent runs the full
 *    phishing/impersonation assessment.
 *
 * Throws on network failure / timeout so the orchestrator falls back to ERROR.
 *
 * @param {string} url
 * @param {boolean} isMarkOfficial
 * @returns {Promise<{ isPhishing: boolean, message: string, reasons: string[] }>}
 */
export const assessUrlByAI = async (url, isMarkOfficial = false) => {
  const agent = new WebsiteTrustKeyringAgent({
    llm: { model: 'gemini-2.5-flash' }
  })
  const res = await agent.chat({ url, isMarkOfficial, language: getAgentLanguage() })
  return {
    // The agent's natural-language paragraph (shown in the info card).
    message: res?.answer || '',
    isPhishing: !!res?.extraData?.isPhishing,
    // The analyzed site + the official one it impersonates (when provided): the
    // modal renders a fixed "X is a phishing website / official URL is Y" layout.
    currentSite: res?.extraData?.currentSite || '',
    copiedSite: res?.extraData?.copiedSite || '',
    reasons: res?.extraData?.reasons || [],
    keyFeatures: res?.extraData?.keyFeatures || []
  }
}

// Reject a promise if it doesn't settle within `ms`.
const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((resolve, reject) => setTimeout(() => reject(new Error('assess-timeout')), ms))
])

/**
 * Decide which verification UI state to show for a dApp URL.
 *
 * Flow (per product spec 3.1–3.5):
 *  1. Ask the server (getWalletconnectSiteOfficalStatus):
 *     - OFFICIAL      -> still fetch the AI description for the card, state OFFICIAL   (3.1)
 *     - NOT_OFFICIAL  -> PHISHING_API immediately, no card, no AI needed              (3.2)
 *     - no info yet   -> ask the AI:
 *         - not phishing -> OFFICIAL with the AI message                              (3.3)
 *         - phishing     -> AI_PHISHING with the AI message                           (3.4)
 *  2. Any network error / timeout on the way -> ERROR (neutral card)                  (3.5)
 *
 * The function never throws — it always resolves to a state object so the modal
 * can render deterministically.
 *
 * @param {string} url
 * @param {{ timeout?: number }} [opts]
 * @returns {Promise<{ state: string, message?: string, official?: number }>}
 */
export const assessWalletConnectUrl = async (url, opts = {}) => {
  const timeout = opts.timeout || WC_ASSESS_TIMEOUT_MS
  // Optional progressive callback: fired with an intermediate state BEFORE the AI
  // call resolves, so the UI (icon/verdict) can update without waiting on the AI.
  const onPartial = typeof opts.onPartial === 'function' ? opts.onPartial : null

  if (!url) return { state: WC_VERIFY_STATE.ERROR }

  try {
    // opts.skipServerCheck (testing): bypass the Keyring server check and treat the
    // URL as "no info" so the AI runs its full phishing assessment.
    const serverStatus = opts.skipServerCheck
      ? null
      : await withTimeout(getWalletconnectSiteOfficalStatus(url), timeout)

    // 3.2 — server already knows this URL is not official / a phishing risk.
    if (serverStatus === REVIEW_URL_STATUS.NOT_OFFICIAL) {
      return { state: WC_VERIFY_STATE.PHISHING_API, official: serverStatus }
    }

    // For OFFICIAL and "no info yet" we still want the AI-generated description
    // for the info card. When the server already marked the site OFFICIAL we pass
    // isMarkOfficial=true so the agent skips the phishing checks and just describes
    // the site. If the AI call fails we degrade gracefully.
    const isMarkOfficial = serverStatus === REVIEW_URL_STATUS.OFFICIAL

    // Server already says OFFICIAL → surface that verdict NOW so the icon flips to
    // official immediately; the AI description (info card) keeps loading behind it
    // (aiPending). No need to wait on the AI just to show the official state.
    if (isMarkOfficial && onPartial) {
      onPartial({ state: WC_VERIFY_STATE.OFFICIAL, official: serverStatus, aiPending: true })
    }

    let ai = null
    try {
      ai = await withTimeout(assessUrlByAI(url, isMarkOfficial), timeout)
    } catch (aiErr) {
      ai = null
    }

    // 3.1 — server says official: show official regardless of AI, using the AI
    // description when we have it.
    if (serverStatus === REVIEW_URL_STATUS.OFFICIAL) {
      return {
        state: WC_VERIFY_STATE.OFFICIAL,
        message: ai?.message,
        official: serverStatus,
        keyFeatures: ai?.keyFeatures
      }
    }

    // Server has no opinion -> the AI result decides.
    if (!ai) {
      // AI unavailable / failed and server has nothing: 3.5.
      return { state: WC_VERIFY_STATE.ERROR, official: serverStatus }
    }

    if (ai.isPhishing) {
      // 3.4
      return {
        state: WC_VERIFY_STATE.AI_PHISHING,
        message: ai.message,
        currentSite: ai.currentSite,
        copiedSite: ai.copiedSite,
        reasons: ai.reasons,
        official: serverStatus
      }
    }

    // 3.3 — AI says safe -> looks identical to 3.1.
    return {
      state: WC_VERIFY_STATE.OFFICIAL,
      message: ai.message,
      official: serverStatus,
      keyFeatures: ai.keyFeatures
    }
  } catch (error) {
    // 3.5 — network error / timeout reaching the server.
    return { state: WC_VERIFY_STATE.ERROR }
  }
}
