import { useQuery } from 'react-query'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import BaseAPI from 'controller/API/BaseAPI'
import { isArrayWithData, lowerCase } from 'common/function'

const EMPTY = { iconUrl: null, priceUSD: null }

// Keyring (pantograph) token catalog: one chain, one address. The same endpoint
// useGetNameFunctionDecoded uses to put an icon on an approve request, and that
// TokenListV2 reads `icon_image` / `price` from for the balance list.
const getData = async ({ queryKey }) => {
  const [, chainId, address] = queryKey

  const res = await BaseAPI.getData(`keyrings/tokens/all/${Number(chainId)}?addresses=${address}`)
  const items = res?.items || []
  if (!isArrayWithData(items)) return EMPTY

  // The endpoint echoes back a LIST for the addresses asked about, so match the
  // one we asked for rather than trusting position. Both key spellings appear in
  // the catalog depending on the token's source.
  const match = items.find((item) =>
    lowerCase(item?.address) === lowerCase(address) ||
    lowerCase(item?.contractAddress) === lowerCase(address)
  )
  if (!match) return EMPTY

  // A missing/zero/unparseable price stays null rather than becoming 0 — the
  // caller hides the fiat estimate entirely instead of printing "~$0.00" next to
  // a balance that is actually worth something.
  const price = Number(match?.price)
  return {
    iconUrl: match?.icon_image || null,
    priceUSD: Number.isFinite(price) && price > 0 ? price : null
  }
}

/**
 * Catalog data for the token an x402 charge is denominated in: its icon and its
 * USD price, in ONE request (the endpoint returns both).
 *
 * Both fields are presentational — the sheet renders the unknown-token
 * placeholder while this loads or misses, and drops the `(~$…)` estimate when
 * there is no price. A slow or absent catalog entry therefore never holds up (or
 * blocks) a payment approval, which is why the error path resolves to empty
 * rather than surfacing a failure.
 */
export default function usePaymentToken (chainId, address) {
  const { data } = useQuery(
    [REACT_QUERY_KEY.getPaymentTokenInfo, chainId, address],
    getData,
    {
      enabled: !!chainId && !!address,
      // Price moves, but this is a fiat ESTIMATE beside an exact token amount —
      // a few minutes stale is fine, and it keeps reopening the sheet cheap.
      staleTime: 5 * 60 * 1000,
      retry: 1
    }
  )

  return data || EMPTY
}
