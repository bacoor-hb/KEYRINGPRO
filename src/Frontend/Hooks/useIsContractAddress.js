import { useQuery } from 'react-query'
import { useSelector } from 'react-redux'
import { isAddress } from 'viem'
import { isValidContract } from 'common/function'

export const QUERY_KEY = 'isContractAddress'

// Resolve whether `address` is a contract on ANY of the given chains. Bytecode on
// a single chain is enough. allSettled so one failing chain (RPC error) never
// rejects the whole check — a rejected/false result just doesn't count.
const checkIsContract = async ({ queryKey }) => {
  const [, address, chainIds] = queryKey
  if (!isAddress(address) || !chainIds?.length) return false

  const results = await Promise.allSettled(
    chainIds.map((chainId) => isValidContract(chainId, address))
  )
  return results.some((res) => res.status === 'fulfilled' && res.value === true)
}

// In-memory only (react-query cache, no AsyncStorage). The bytecode for a given
// address rarely changes, so a long stale window avoids re-hitting the RPC every
// time a header with the same address remounts.
//
// `enabled` lets a caller opt out (e.g. the badge isn't wanted on that screen)
// without conditionally calling the hook.
const useIsContractAddress = (address, { enabled = true } = {}) => {
  // Active EVM chains via useSelector so the query re-keys (and re-checks) if the
  // user toggles chains while a header using this hook is mounted.
  const activeEvmChainIdsRedux = useSelector((s) => s.activeEvmChainIdsRedux)
  const chainIds = (activeEvmChainIdsRedux || []).map(Number)

  // `enabled` is deliberately NOT in the key: it says whether this caller wants
  // the check run, not what the answer is. Keying on it split each address into
  // two unrelated entries, so a caller that mounted disabled and later enabled
  // landed on an empty key and re-fetched instead of reusing the known answer.
  const { data } = useQuery(
    [QUERY_KEY, (address || '').toLowerCase(), chainIds],
    checkIsContract,
    {
      enabled: enabled && isAddress(address) && chainIds.length > 0,
      staleTime: 1000 * 60 * 60, // 1h — bytecode is effectively immutable per address
      cacheTime: 1000 * 60 * 60 * 24 // keep across remounts within a session
    }
  )

  return !!data
}

export default useIsContractAddress
