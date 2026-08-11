import { AgentCore } from 'keyring-agent-core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import settings from 'controller/settings'
import Keys from 'react-native-keys'

// Build the core's top-level rpcUrls map ({ '<chainId hex>': '<rpc>' }) from the
// app's QuickNode endpoints in settings().rpcUrlByChainId, so the agent core uses
// the same authenticated RPCs as the rest of the app instead of public fallbacks.
// The core lowercases keys and resolves by hex chainId (e.g. '0x1', '0xa').
const buildRpcUrls = () => {
  const rpcUrlByChainId = settings().rpcUrlByChainId || {}
  return Object.entries(rpcUrlByChainId).reduce((acc, [chainId, rpcUrl]) => {
    if (rpcUrl) {
      acc[`0x${Number(chainId).toString(16)}`] = rpcUrl
    }
    return acc
  }, {})
}

// Is the lending subagent routable? Exported because the init-suggestion tree
// hides its "lending" pill when it isn't — tapping it would send a turn nothing
// can serve. Flip this one flag to enable both.
export const LENDING_ENABLED = false

const DEFAULT_CONFIG = {
  maxIterations: 8,
  maxHistoryMessages: 20,
  debug: __DEV__,
  storage: AsyncStorage,
  storageKey: 'keyring-agent-history',
  persistHistory: false,
  uniswap: {
    minProvideUsd: 0.01,
    isProduction: true
  },

  // Generic x402 (pay-per-call) is enabled by registering a signer at runtime
  // (agent.setX402Signer in the AISearch screen) — no config flag needed. Any API
  // the agent calls that returns HTTP 402 then makes the core build an EIP-712
  // payment, AWAIT that signer (the user signs with their wallet), re-call the API
  // and answer — all in one turn. Requires keyring-agent-core bumped past 0.2.36.

  subagents: {
    wallet: true,
    'pool-subgraph': false,
    'wallet-action': true,
    pool: true,
    token: true,
    nft: true,
    ai: true,
    nfc: true,
    lending: LENDING_ENABLED
  },

  // Swap and buy are not done in chat — the app has its own screens for them.
  // Both tools keep their name and routing, so the intent still lands on them,
  // but they only relay this message (the core translates it to the user's
  // language) instead of opening a form. Every other wallet action opens its
  // real in-chat form.
  noFormTools: {
    'open-swap-token-form': 'You can swap tokens directly in the app.',
    'open-buy-token-form': 'You can buy tokens directly in the app.'
  }
}

export const HISTORY_STORAGE_KEY = DEFAULT_CONFIG.storageKey

export const getAgent = (overrides) => {
  // secretKey and rpcUrls are resolved here (not at module scope) because both
  // read from native modules — react-native-keys and settings() — that are not
  // guaranteed to be initialized at import time.
  return new AgentCore({
    ...DEFAULT_CONFIG,
    llm: {
      model: 'gemini-2.5-flash',
      apiKey: Keys.secureFor('AGENT_CORE_GEMINI_API_KEY')
    },
    secretKey: Keys.secureFor('AGENT_CORE_SECRET_KEY'),
    rpcUrls: buildRpcUrls(),
    ...(overrides || {})
  })
}

export const setAgentUserContext = (ctx, agent) => {
  if (!ctx || !agent) return
  agent.setUserContext(ctx)
}

export const resetAgent = async (agent) => {
  if (agent && typeof agent.clearHistory === 'function') {
    try {
      await agent.clearHistory()
    } catch (e) {
      // console.log('resetAgent clearHistory failed', e)
    }
  }
}
