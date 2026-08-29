import { useQuery } from 'react-query'
import { LendingService } from 'keyring-agent-core'
import { REACT_QUERY_KEY } from 'common/constants/reactQuery'
import { getRpcUrlByChain, lowerCase } from 'common/function'
import BigNumber from 'bignumber.js'

// Silence the core's `[LEND]` step-by-step pipeline tracing (catalogue lookup,
// on-chain discovery, asset resolution, market state, APY fetch). It is opt-out
// rather than opt-in inside the core, so without this every token scan logs a
// dozen lines. Set before the service is constructed so no core lending code has
// run yet.
globalThis.__LENDING_DEBUG__ = false

// One shared instance: the service is stateless apart from its concurrency gate,
// and that gate is exactly what we want shared — two screens scanning at once
// stay within one ceiling instead of two. Defaults point at the same CoinPool /
// Aave / Morpho endpoints the lending subagent uses.
const lendingService = new LendingService()

// The core resolves chains by hex id ('0x1', '0x2105'), while the app keys
// everything by the numeric chainId.
const toHexChain = (chainId) => {
  const num = Number(chainId)
  return Number.isFinite(num) && num > 0 ? `0x${num.toString(16)}` : null
}

const getData = async ({ queryKey }) => {
  const [, chainId, contractAddress] = queryKey
  const hexChain = toHexChain(chainId)
  if (!hexChain || !contractAddress) return null

  // The core defines ~12 chains; this app ships far more built in, plus whatever
  // `blockchainListRedux` adds at runtime. Handing it OUR endpoint for the chain
  // we're about to read is what lets a yield token on Unichain, Katana, Plasma —
  // or any chain the API adds tomorrow — resolve at all: without an endpoint the
  // core has no way to reach a chain it carries no definition for, and the read
  // comes back empty as though the token were a plain ERC-20.
  //
  // Resolved per call rather than once at startup because the RPC list itself is
  // dynamic (Redux `blockchainListRedux` + `settings().web3Link` both load after
  // boot). Core installs it as its own override for this chain before reading.
  const rpcUrl = getRpcUrlByChain(chainId)

  // Resolves the market from the RECEIPT TOKEN the wallet holds — the curated
  // catalogue first, then the token itself on chain for reserves the catalogue
  // omits (Base aWETH is a real Aave v3 market that `/supply/v2`, which curates
  // USDC, does not list). Only this one market is described, so it costs one APY
  // request plus a batched read rather than the whole chain's catalogue.
  const overview = await lendingService.findMarketByReceiptToken(hexChain, contractAddress, rpcUrl)
  if (!overview) return null

  // Oldest → newest, which is the order `apyHistory` already comes in and the
  // order the chart draws in. Non-finite samples would break Math.min/max.
  const series = (overview.apyHistory || [])
    .map((point) => Number(point?.apyPercent))
    .filter(Number.isFinite)

  return {
    series,
    // ---- Market identity ---------------------------------------------------
    // Everything below describes WHERE the position lives, as opposed to how it
    // is performing. The APY card ignores it; the withdraw flow cannot work
    // without it, because a withdrawal is encoded against the market's own
    // contract and its own underlying — neither of which can be guessed from the
    // receipt token the wallet holds.
    //
    // `type` is the protocol family ('aave-v3' | 'compound-v3' | 'spark' |
    // 'spark-ethereum' | 'morpho-v2'), and it is what selects the withdraw call:
    // the five families take five different signatures. `contract` is the pool /
    // vault the call goes to, `token` the receipt token that gets burned.
    type: overview.type,
    contract: overview.contract,
    receiptToken: overview.token,
    // The underlying this market lends, read on chain by core — NOT assumed to
    // be USDC. `asset.address` and `asset.decimals` are what a withdrawal amount
    // is denominated in, so both must travel with the market: parsing a WETH
    // withdrawal with USDC's 6 decimals would be off by 10^12.
    //
    // `asset.logo` rides along too — core looks the underlying's icon up in
    // Pantograph's token metadata. It is the image the withdraw drawer shows,
    // because the user receives the UNDERLYING, not the receipt token they hold.
    // Null whenever Pantograph doesn't know the token, so callers still need a
    // fallback.
    asset: overview.asset || null,
    // The protocol's own app page for this market, when core knows one — the
    // "Supply info" link in the withdraw drawer. Null is normal (discovered
    // markets carry no URL), so the link is only rendered when it resolves.
    protocolUrl: overview.protocolUrl || null,
    // Headline number, top-left of the card: the live rate when the protocol
    // reports one, else the mean of the series.
    currentApyPercent: BigNumber(overview.currentApyPercent).decimalPlaces(2, BigNumber.ROUND_DOWN).toNumber(),
    // The dashed reference line + the "AVG x%" badge.
    avgApyPercent: BigNumber(overview.avgApyPercent).decimalPlaces(2, BigNumber.ROUND_DOWN).toNumber(),
    // Today's rate minus yesterday's, in percentage POINTS — what the pill shows.
    apyChangePercent: overview.apyChangePercent,
    // Market size, rendered on the right of the second row. Denominated in
    // `assetSymbol` below — NOT always USDC — so the two must be rendered
    // together; a WETH figure labelled "USDC" is worse than no label.
    totalSupplied: overview.totalSuppliedUsdc,
    // The asset this market actually lends, resolved on chain by core. Null
    // symbol when it couldn't be read — render the amount bare rather than
    // guessing a ticker.
    assetSymbol: overview.asset?.symbol || null,
    protocol: overview.protocol,
    name: overview.name,
    // The protocol family as a reader should see it — 'Aave V3', 'Spark',
    // 'Compound V3', 'Morpho V2' — derived by core from `type`, the only field
    // guaranteed exact. Neither `name` nor `protocol` is that label: discovery
    // writes 'Aave v3' with a lowercase v, `protocol` is an upper-case enum
    // ('AAVE'), and for a Morpho market `name` is the VAULT's own name
    // ('Gauntlet USDC Core') because the market's app URL slug is built from it.
    //
    // Null for a market kind core ships no label for, so a caller titling a
    // market still needs `name` / `protocol` as a fallback.
    protocolLabel: overview.protocolLabel || null
  }
}

/**
 * Lending-market info for a yield / lending receipt token, from the core's
 * LendingService — the same data the lending subagent answers with: the market's
 * protocol / name / underlying asset, its live and average supply APY, the daily
 * APY samples and the total supplied.
 *
 * A yield token's price history is the UNDERLYING's, so it can't be charted
 * against the per-share price the screen shows (see TokenDetailScreen). Its APY
 * series can: this hook returns the daily APY samples plus the average, the
 * live rate and the market's total supplied, which is what the APY chart card
 * renders instead of a price chart.
 *
 * Works for any asset, not just USDC: core reads each market's underlying on
 * chain, so an aWETH position reports WETH's APY and size rather than the
 * chain's stablecoin. Check `assetSymbol` before labelling any amount.
 *
 * Nor does it depend on the token being in CoinPool's catalogue: every receipt
 * token is identified from its OWN contract first, and the catalogue is consulted
 * afterwards only for cosmetics (curated display name, platform score). Aave /
 * Morpho markets take their APY from those protocols' own APIs; only Compound and
 * generic ERC-4626 still source history from CoinPool.
 *
 * Nor is it limited to the chains the core defines. This app supports many more
 * (and loads more at runtime from `blockchainListRedux`), so the chain's RPC URL
 * is passed to `findMarketByReceiptToken`, which installs it as the core's
 * override for that chain before reading. Any EVM chain with a working endpoint
 * and a Multicall3 deployment resolves.
 *
 * Besides the display numbers it also reports the market's IDENTITY — `type`,
 * `contract`, `receiptToken` and the underlying `asset` — which is what lets the
 * withdraw flow encode a redemption for this exact position. That is the only
 * source for it: the wallet's token list knows the receipt token but not the
 * pool behind it, nor which of the five protocol families that pool belongs to.
 *
 * Returns `data: null` — not an error — whenever the token is no lending receipt
 * at all (plain ERC-20, no RPC for the chain, upstream down), so the caller can
 * simply fall back to the normal price chart.
 *
 * @param {number|string} chainId  numeric chainId (converted to hex internally)
 * @param {string} contractAddress the receipt token the wallet holds
 * @param {boolean} enabled        pass false for tokens that aren't yield tokens,
 *                                 so a plain token never fires the scan
 */
const useGetLendingTokenInfo = (chainId, contractAddress, enabled = true) => {
  const { data, ...restData } = useQuery(
    [REACT_QUERY_KEY.getLendingTokenInfo, chainId, lowerCase(contractAddress || '')],
    getData,
    {
      enabled: !!enabled && !!chainId && !!contractAddress
    }
  )

  return {
    data: data || null,
    ...restData
  }
}

export default useGetLendingTokenInfo
