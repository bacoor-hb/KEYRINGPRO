import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import ChainSelectorDropdown, { buildChainItems } from 'frontend/Components/UI/ChainSelectorDropdown'

// TokenList header chain filter: all active EVM chains, plus an "All" row.
const RightHeaderChainSelector = ({ selectedChainId, onSelect }) => {
  const { activeEvmChainIdsRedux, blockchainListRedux } = useSelector((s) => s)

  const data = useMemo(
    () => buildChainItems(activeEvmChainIdsRedux, blockchainListRedux),
    [activeEvmChainIdsRedux, blockchainListRedux]
  )

  return (
    <ChainSelectorDropdown
      isUseHeader
      data={data}
      selectedChainId={selectedChainId}
      onSelectChain={onSelect}
      showAll
    />
  )
}

export default RightHeaderChainSelector
