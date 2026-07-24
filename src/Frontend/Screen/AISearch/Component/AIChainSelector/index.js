import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { SUPPORTED_CHAINS } from 'keyring-agent-core'
import ChainSelectorDropdown, { buildChainItems } from 'frontend/Components/UI/ChainSelectorDropdown'
import { getDataFromAsyncStorage, storeDataToAsyncStorage } from 'common/storage/asyncStorage'

// Persisted last-picked chain for the AI search screen. Exported so callers that
// seed the chain from outside (e.g. opening AI search from a token's chain) can
// persist it under the same key, keeping the picker's stored last-chain in sync.
export const AI_SEARCH_CHAIN_STORAGE_KEY = 'ai_search_selected_chain_id'
const STORAGE_KEY = AI_SEARCH_CHAIN_STORAGE_KEY

// The agent can only query a fixed EVM set — restrict the picker to those so the
// chain we stamp into the AI context is always one the agent can actually use.
const SUPPORTED_CHAIN_ID_SET = new Set((SUPPORTED_CHAINS || []).map((hex) => parseInt(hex, 16)))

const AIChainSelector = ({ isUseHeader = false, selectedChainId, onSelect }) => {
  const { activeEvmChainIdsRedux, blockchainListRedux } = useSelector((s) => s)

  const data = useMemo(() => {
    const supported = buildChainItems(activeEvmChainIdsRedux, blockchainListRedux, SUPPORTED_CHAIN_ID_SET)
    // If none of the currently active chains are in the AI-supported set, fall
    // back to showing ALL active chains so the picker is never empty.
    if (supported.length > 0) return supported
    return buildChainItems(activeEvmChainIdsRedux, blockchainListRedux)
  }, [activeEvmChainIdsRedux, blockchainListRedux])

  // Persist the choice and lift it to the parent.
  const handleSelect = useCallback((chainId) => {
    onSelect(chainId)
    storeDataToAsyncStorage(STORAGE_KEY, chainId)
  }, [onSelect])

  // First load with no selection: prefer the stored chain; fall back to the first
  // supported chain if storage is empty or the stored chain is no longer
  // supported/active (e.g. it was removed). Runs once.
  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current || selectedChainId != null || data.length === 0) return
    initRef.current = true
    let cancelled = false
    ;(async () => {
      const stored = await getDataFromAsyncStorage(STORAGE_KEY)
      if (cancelled) return
      const storedId = stored != null ? Number(stored) : null
      const valid = storedId != null && data.some((d) => d.chainId === storedId)
      handleSelect(valid ? storedId : data[0].chainId)
    })()
    return () => { cancelled = true }
  }, [selectedChainId, data, handleSelect])

  return (
    <ChainSelectorDropdown
      isUseHeader={isUseHeader}
      data={data}
      selectedChainId={selectedChainId}
      onSelectChain={handleSelect}
    />
  )
}

export default AIChainSelector
