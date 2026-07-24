import React, { useMemo } from 'react'
import ChainSelectorDropdown from 'frontend/Components/UI/ChainSelectorDropdown'

const RightHeader = ({ _this }) => {
  const { state, handleSelectChain } = _this
  const { chainId, optionsPayments } = state
  const chainIds = useMemo(() => {
    if (optionsPayments) {
      return Object.keys(optionsPayments)
    }
    return []
  }, [optionsPayments])

  return (
    <ChainSelectorDropdown
      isUseHeader
      selectedChainId={chainId}
      data={chainIds}
      onSelectChain={handleSelectChain}
    />
  )
}

export default RightHeader
