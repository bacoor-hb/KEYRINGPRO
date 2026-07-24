import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils'
import { getConnectorV2 } from 'common/walletconnect'
import { getWalletconnectSiteOfficalStatus } from 'common/chain'
import { lowerCase } from 'common/function'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { REDUX_KEY } from 'common/constants/redux'

// --- Pending hand-off -------------------------------------------------------
// ScanScreen pairs + receives the session_proposal, then hands it off here and
// navigates to the WalletConnect management screen, which consumes it and shows
// the connect drawer. Kept as a module singleton (instead of nav params) so we
// don't push a large non-serializable proposal through React Navigation.
let pendingWcConnect = null

export const setPendingWcConnect = (data) => {
  pendingWcConnect = data
}

// Returns the pending connect payload once, then clears it (safe to call twice).
export const consumePendingWcConnect = () => {
  const data = pendingWcConnect
  pendingWcConnect = null
  return data
}

// --- Approve ----------------------------------------------------------------
/**
 * Approve a WalletConnect session_proposal with the CURRENT account across ALL
 * eip155 chains the dApp requests. Stores the legacy session entry shape (so
 * signing / manageRequestScreenV2 keep working) plus `accountAddress` so the
 * connected-dApps list can filter per account.
 *
 * Dispatches via ReduxService (screen-agnostic). On success it only closes the
 * host drawer (onClose) — the caller stays on the WalletConnect screen.
 *
 * @param {object}   args
 * @param {object}   args.proposal        the WC session_proposal event
 * @param {string}   args.uri             the pairing uri
 * @param {boolean}  args.isFromDeepLink
 * @param {Function} [args.onClose]        close the host drawer
 * @param {Function} [args.onError]        surfaced on unexpected failure
 */
export const approveWalletConnectProposal = async ({
  proposal,
  uri,
  isFromDeepLink = false,
  chainIds,
  account,
  urlVerifyState,
  onClose,
  onError
} = {}) => {
  try {
    const { optionalNamespaces = {}, requiredNamespaces = {} } = proposal?.params || {}

    const connectorV2 = await getConnectorV2()

    // The account we connect with = the currently selected account.
    const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
    const { account: accountActive } = activeAccount
    // The account we connect with: the one explicitly chosen in the modal (mobile
    // deep link picks an account), else the currently selected account (desktop).
    const connectAccount = account || accountActive
    const address = connectAccount?.address

    // Chains to connect: the explicit set chosen in the connect modal (matched
    // active chains, or the chains the user picked & added), built as eip155:chainId.
    // Falls back to every eip155 chain the dApp asked for (required + optional).
    const chainSet = new Set()
    ;[requiredNamespaces?.eip155, optionalNamespaces?.eip155].forEach((ns) => {
      if (Array.isArray(ns?.chains)) ns.chains.forEach((c) => chainSet.add(c))
    })
    const chainsArr = (Array.isArray(chainIds) && chainIds.length > 0)
      ? chainIds.map((id) => `eip155:${Number(id)}`)
      : [...chainSet].filter((c) => typeof c === 'string' && c.startsWith('eip155:'))

    if (!address || chainsArr.length === 0) {
      onClose && onClose()
      await connectorV2.rejectSession({
        id: proposal.id,
        reason: getSdkError('UNSUPPORTED_CHAINS')
      })
      return
    }

    const accountArr = chainsArr.map((c) => `${c}:${address}`)
    const accountArrInfo = chainsArr.map(() => ({ address }))
    const supportedNetwork = chainsArr.reduce((obj, c) => {
      obj[c.split(':')[1]] = 1
      return obj
    }, {})

    const methods = [...new Set([
      ...(requiredNamespaces?.eip155?.methods || []),
      ...(optionalNamespaces?.eip155?.methods || [])
    ])]
    const events = [...new Set([
      ...(requiredNamespaces?.eip155?.events || []),
      ...(optionalNamespaces?.eip155?.events || [])
    ])]

    const namespacesParams = {
      proposal: proposal.params,
      supportedNamespaces: {
        eip155: { chains: chainsArr, accounts: accountArr, methods, events }
      }
    }

    try {
      const approvedNamespaces = buildApprovedNamespaces(namespacesParams)
      const session = await connectorV2.approveSession({
        id: proposal.id,
        namespaces: approvedNamespaces
      })

      if (session) {
        const walletConnectRedux = ReduxService.getReduxDataByKey('walletConnectRedux') || []
        const callRequestRedux = ReduxService.getReduxDataByKey('callRequestRedux') || []
        const wcIndexRedux = walletConnectRedux.length
        const callRequestReduxTemp = callRequestRedux.slice()

        ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect([...walletConnectRedux, {
          connector: {},
          pairingTopic: proposal.params.pairingTopic,
          id: proposal.params.id,
          topic: session.topic,
          uri: uri,
          session: session,
          chainArray: chainsArr,
          accountArr,
          accountArrInfo,
          // Binds this session to a single account so the connected-dApps list
          // can be filtered by the current account.
          accountAddress: lowerCase(address),
          supportedNetwork,
          currentNamespace: namespacesParams,
          isWalletConnectV2: true,
          isFromDeepLink: isFromDeepLink,
          // The URL verdict the connect modal already computed (server + AI). The
          // dApp detail modal reads this back — it's fixed once connected, so no
          // re-assessment is needed there.
          urlVerifyState,
          // Resolved in the background below (the review API can be slow — don't
          // block closing the sheet on it).
          isAlreadyReviewUrl: 0
        }]))

        if (!callRequestReduxTemp[wcIndexRedux]) {
          callRequestReduxTemp.push([])
        }
        ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestReduxTemp))

        // Close the drawer immediately — the session is already approved. Staying
        // on the WalletConnect screen, the user sees the new dApp in the connected
        // list (no jump to the legacy manageRequestScreenV2).
        onClose && onClose()

        // Fetch the URL-review status in the background and patch it into the
        // session entry (found by topic) so the spinner doesn't hang on this API.
        const urlForReview = session?.peer?.metadata?.url?.trim()
        if (urlForReview) {
          getWalletconnectSiteOfficalStatus(urlForReview)
            .then((status) => {
              const list = ReduxService.getReduxDataByKey('walletConnectRedux') || []
              const idx = list.findIndex((s) => s?.session?.topic === session.topic)
              if (idx >= 0) {
                const next = list.slice()
                next[idx] = { ...next[idx], isAlreadyReviewUrl: status }
                ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect(next))
              }
            })
            .catch(() => {})
        }
      }
    } catch (e) {
      onClose && onClose()
      await connectorV2.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED_METHODS')
      })
    }
  } catch (error) {
    ReduxService.remoteDebugLog('approveWalletConnectProposal - final catch', error?.message || 'no message')
    onError && onError(error)
  }
}

// --- Reject -----------------------------------------------------------------
export const rejectWalletConnectProposal = async (proposal, onClose) => {
  try {
    const connectorV2 = await getConnectorV2()
    if (connectorV2 && proposal?.id) {
      await connectorV2.rejectSession({
        id: proposal.id,
        reason: getSdkError('USER_REJECTED_METHODS')
      })
    }
  } catch (e) {
    // ignore — session may already be gone
  } finally {
    onClose && onClose()
  }
}
