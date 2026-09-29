import React, { useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native'
// The result list lives inside a bottom-sheet drawer, so its scroller must be
// gesture-handler's — RN's own ScrollView doesn't scroll there on Android.
import { ScrollView } from 'react-native-gesture-handler'
import LottieView from 'lottie-react-native'
import { isAddress } from 'ethers/lib/utils'
// TouchableOpacity is only used for the search button beside the input; the
// chain-selector trigger must be a plain View so press events reach the
// library's own TouchableOpacity that opens the dropdown.
import { useSelector } from 'react-redux'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import MyInput from 'frontend/Components/UI/MyInput'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import MySelectDropdown from 'frontend/Components/UI/MySelectDropdown'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import { Colors, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import { convertAddressArrToString, getRpcUrlByChain, getTokenName, lowerCase } from 'common/function'
import { isNativeToken } from 'common/tokens'
import { resolveApiYieldProtocol, resolveApiYieldAsset } from 'common/constants/lending'
import { isShareBasedProtocol } from 'keyring-agent-core'
import I18n from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'
import BaseAPI from 'controller/API/BaseAPI'
import CoinGeckoAPI from 'controller/API/CoinGeckoAPI'
import ReduxService from 'common/redux'
import { resolveKeyringTokenPriceUSD } from 'src/Services/TokenListV2'
import { resolveOnchainSymbolFor } from 'src/Services/TokenListV2/symbolOnchain'
import { getAddress, formatUnits } from 'viem'
import { FIELD_MIN_HEIGHT } from 'frontend/Screen/TokenDetailScreen/Component/SendToken/styles'
import { filterTokenToShow } from 'frontend/Screen/TokenList/page'

// EVM contract address is at most 42 chars (0x + 40 hex). Used to decide when a
// mistyped address is worth flagging, not to cap the input any more — the field
// now also takes a token name, which can be longer.
const MAX_ADDRESS_LENGTH = 42

// Input cap for the free-text search. Generous enough for the longest listed
// token names while still refusing a pasted essay.
const MAX_QUERY_LENGTH = 64

// A single character is enough to search on. It does match thousands of tokens
// (`key=a` answers with 8k+ on Ethereum) and only the API's first page of them
// comes back, so the sort below can rank only what that page contained — a
// one-letter query is a browse, not a lookup.
const MIN_KEYWORD_LENGTH = 1

const DEFAULT_CHAIN_ID_SET = new Set(LIST_DEFAULT_CHAIN_ID.map(Number))

// Unified Keyring token API (`keyrings/tokens/all/{chainId}`) for every EVM
// chain — served from the default API base URL (relative, via BaseAPI), same as
// the token-list refresh service.
const KEYRING_TOKENS_ALL_API = 'keyrings/tokens/all'

// Keyword search over the same Keyring token DB: `key` matches name, symbol AND
// address (substring, case-insensitive) and works for custom chains too. This is
// a DIFFERENT endpoint from KEYRING_TOKENS_ALL_API above — that one only filters
// by exact `addresses` — and it answers with `result` as an object keyed by
// address rather than an `items` array. Same endpoint the swap token picker uses
// (see useGetTokenSearchByChain).
const KEYRING_TOKEN_SEARCH_API = 'token-list/all'

// One page of keyword hits. The API's own default is 50; asking for more just
// buries the wanted token deeper in a list nobody scrolls.
const SEARCH_RESULT_LIMIT = 50

// Result states
const RESULT_STATE = {
  IDLE: 'idle',
  LOADING: 'loading',
  // ERROR is the address path's "this contract holds no token" answer; NO_MATCH
  // is the keyword path's "nothing listed by that name". Two states because the
  // two messages say different things to the user.
  ERROR: 'error',
  NO_MATCH: 'noMatch',
  EXISTS: 'exists',
  SUCCESS: 'success'
}

const buildMetaKey = (chainId, contractAddress) => `${chainId}:${contractAddress}`

const AddTokenDrawer = ({ _this }) => {
  const { activeEvmChainIdsRedux, blockchainListRedux } = useSelector((s) => s)

  // All active EVM chains — defaults first, then custom.
  const chainList = useMemo(() => {
    const active = (activeEvmChainIdsRedux || []).map(Number)
    const activeSet = new Set(active)
    const defaults = LIST_DEFAULT_CHAIN_ID.map(Number).filter((id) => activeSet.has(id))
    const others = active.filter((id) => !DEFAULT_CHAIN_ID_SET.has(id))
    return [...defaults, ...others].map((id) => {
      const info = blockchainListRedux?.[id] || {}
      return { chainId: id, name: info?.name || `Chain ${id}`, icon: info?.icon, chain: info?.chain, chainCoingecko: info?.chainCoingecko, linkProvider: info?.linkProvider }
    })
  }, [activeEvmChainIdsRedux, blockchainListRedux])

  // Pre-select the chain the token list is currently filtered by (if any) so
  // "Add token" opens already scoped to the chain the user was viewing; falls
  // back to the first active chain when the filter is "All".
  const [selectedChain, setSelectedChain] = useState(() => {
    const filterChainId = _this?.state?.selectedChainId
    return chainList.find((c) => Number(c.chainId) === Number(filterChainId)) || chainList[0] || null
  })
  const [searchText, setSearchText] = useState('')
  const [resultState, setResultState] = useState(RESULT_STATE.IDLE)
  // Always a list: the address lookup produces a single-entry one, so the result
  // rows below render the same way for both paths.
  const [results, setResults] = useState([])
  // metaKey of the row currently being added — only that row shows the spinner.
  const [addingKey, setAddingKey] = useState(null)
  const dropdownRef = useRef(null)

  const formatAddress = (raw) => {
    let addr = (raw || '').trim()
    if (addr.startsWith('0X')) addr = addr.replace('0X', '0x')
    if (addr.toLowerCase().startsWith('xdc')) {
      return addr.toLowerCase().replace('xdc', '0x')
    }
    try { addr = getAddress(addr) } catch { /* keep as-is */ }
    return addr
  }

  // The field takes either a contract address or a free-text name/symbol, so the
  // query decides which lookup runs: a valid EVM address goes to the by-address
  // path (unchanged), anything else to the keyword search.
  //
  // Only one inline error survives from the address-only days: a full-length
  // 0x-string that still isn't a valid address is a mistyped address, not a token
  // name, so it's worth flagging. The old "must start with 0x" error is gone —
  // under the new placeholder a name that doesn't start with 0x is correct input.
  const trimmedQuery = searchText.trim()
  const isValidAddress = isAddress(trimmedQuery)
  const looksLikeAddress = trimmedQuery.startsWith('0x') || trimmedQuery.toLowerCase().startsWith('xdc')
  const addressError = (looksLikeAddress && trimmedQuery.length >= MAX_ADDRESS_LENGTH && !isValidAddress)
    ? I18n.t('v2.addToken.invalidContract')
    : ''
  // Enough to search on: a real address, or a keyword past the minimum length.
  const canSearch = !addressError && (isValidAddress || trimmedQuery.length >= MIN_KEYWORD_LENGTH)

  // True when this chain+contract is already a visible token in the connected
  // account's list — used to show the "already exists" error on search instead
  // of letting the user add a duplicate.
  const isTokenAlreadyAdded = (chainId, contractAddr) => {
    const address = lowerCase(_this?.props?.route?.params?.address || '')
    if (!address) return false
    const metaKey = buildMetaKey(chainId, lowerCase(contractAddr))
    const entry = ReduxService.getAccountTokenList()?.[address]
    const existing = (entry?.tokens || []).find((t) => t.metaKey === metaKey)
    if (!existing) return false
    // Reuse the token list's own visibility predicate so "already added" means
    // exactly "a row the user can already see". Checking isManuallyShown alone
    // only caught manually added tokens — an auto-discovered token with a real
    // balance is just as visible and must be blocked too. Conversely a hidden
    // or dust-filtered token stays re-addable, since adding is what brings it
    // back into the list.
    return filterTokenToShow(existing)
  }

  const handleSearch = async () => {
    if (!selectedChain || !canSearch) return
    Keyboard.dismiss()
    // Not an address → keyword search over name/symbol.
    if (!isValidAddress) return handleKeywordSearch()

    const addr = formatAddress(searchText)
    const chainId = Number(selectedChain.chainId)

    // Already in the wallet -> surface the inline error immediately, skip the lookup.
    if (isTokenAlreadyAdded(chainId, addr)) {
      setResults([])
      setResultState(RESULT_STATE.EXISTS)
      return
    }

    setResultState(RESULT_STATE.LOADING)
    setResults([])
    try {
      // 1. Prefer the Keyring token API — it already carries price + metadata
      //    and means the token is a known ERC20, so we can skip the on-chain
      //    contract checks below.
      const keyring = await _fetchKeyringToken(chainId, addr)
      if (keyring) {
        const meta = _keyringToTokenMeta(keyring, addr)
        // `_keyringToTokenMeta` already prefers the API's `symbolOnchain`. When
        // the API didn't return one, read `symbol()` so a token added while it IS
        // listed shows the same ticker as one added while it isn't — the path
        // below reads the contract directly. Keeps the listing symbol when the
        // contract can't answer.
        setResults([{
          ...meta,
          symbol: (await resolveOnchainSymbolFor(chainId, addr, keyring?.symbolOnchain)) || meta.symbol
        }])
        setResultState(RESULT_STATE.SUCCESS)
        return
      }

      // 2. Not listed by Keyring — resolve name/symbol/decimals on-chain and
      //    enrich via CoinGecko. getTokenName is the validity gate: a real ERC20
      //    returns its metadata, while an EOA / non-token address throws and we
      //    fall through to the error state. We intentionally skip the ERC20
      //    supportsInterface probe — plain ERC20s don't implement ERC165, so on
      //    custom chains that eth_call reverts and wrongly fails valid tokens.
      // Resolve RPC by chainId (not chain type): Quicknode chains hit
      // settings().rpcUrlByChainId, and custom chains fall back to the chain's
      // linkProvider in blockchainListRedux. Passing the chain type string fails
      // for custom chains (e.g. Plasma 9745), leaving rpcUrl null.
      const rpcUrl = getRpcUrlByChain(Number(selectedChain.chainId)) || selectedChain.linkProvider

      const meta = await _getTokenMeta(rpcUrl, addr, selectedChain)
      if (!meta) {
        setResultState(RESULT_STATE.ERROR)
        return
      }
      setResults([meta])
      setResultState(RESULT_STATE.SUCCESS)
    } catch {
      setResultState(RESULT_STATE.ERROR)
    }
  }

  // Free-text path: ask the Keyring search endpoint for this chain's tokens whose
  // name/symbol/address contains the query. Unlike the address path there is no
  // on-chain fallback — a token the API doesn't list can't be found by name, only
  // by its contract address.
  const handleKeywordSearch = async () => {
    const chainId = Number(selectedChain.chainId)
    setResultState(RESULT_STATE.LOADING)
    setResults([])
    try {
      const list = await _fetchTokensByKeyword(chainId, trimmedQuery)
      if (list.length === 0) {
        setResultState(RESULT_STATE.NO_MATCH)
        return
      }
      // Drop what the wallet already shows — adding it again is a no-op, so
      // offering it is just noise. Same predicate the address path uses, so a
      // token hidden by the user (or filtered out for having no value) stays
      // listed: re-adding it is exactly how it comes back.
      const addable = list.filter((token) => !isTokenAlreadyAdded(chainId, token.contractAddress))
      if (addable.length === 0) {
        // The query DID match, every hit is already in the wallet. "No matching
        // token" would read as a lie, so say what the address path says.
        setResultState(RESULT_STATE.EXISTS)
        return
      }
      setResults(addable)
      setResultState(RESULT_STATE.SUCCESS)
    } catch {
      setResultState(RESULT_STATE.ERROR)
    }
  }

  // The token list is filtered by `_this.state.selectedChainId` — a token added
  // on a different chain would land outside the current filter and be invisible.
  // Move the filter onto the chain we just added to, so the new row is on screen
  // when the drawer closes. "All" (null) already shows it — leave it alone.
  const syncChainFilter = (chainId) => {
    const filterChainId = _this?.state?.selectedChainId
    if (filterChainId == null) return
    if (Number(filterChainId) === Number(chainId)) return
    _this?.setSelectedChainId && _this.setSelectedChainId(Number(chainId))
  }

  const handleAdd = async (tokenData) => {
    if (!tokenData || !selectedChain || addingKey) return
    const address = lowerCase(_this?.props?.route?.params?.address || '')
    if (!address) return

    const contractAddr = lowerCase(tokenData.contractAddress)
    const chainId = Number(selectedChain.chainId)
    const metaKey = buildMetaKey(chainId, contractAddr)

    const list = ReduxService.getAccountTokenList()
    const entry = list[address] || { tokens: [], totalUSD: 0, lastSyncedAt: 0 }
    const existing = (entry.tokens || []).find((t) => t.metaKey === metaKey)
    if (existing) {
      // Already tracked. If it's currently invisible — hidden by the user, or
      // filtered out for having no price/value (e.g. dropped from the Keyring
      // list) — force it fully visible: clear isHidden AND set isManuallyShown
      // so it bypasses BOTH the hidden filter and the MIN_VALUE filter. When
      // it's already visible there is nothing to change; just close the drawer.
      if (!filterTokenToShow(existing)) {
        const tokens = entry.tokens.map((t) => (
          t.metaKey === metaKey ? { ...t, isHidden: false, hiddenByUser: false, isManuallyShown: true } : t
        ))
        // Mirror the choice into the account-level map so it survives the token
        // object being rebuilt by a later refresh (see commitChainTokens).
        const userHiddenKeys = { ...(entry.userHiddenKeys || {}), [metaKey]: false }
        ReduxService.setAccountTokenList({ ...list, [address]: { ...entry, tokens, userHiddenKeys } })
      }
      syncChainFilter(chainId)
      _this?.closeDrawer && _this.closeDrawer()
      return
    }

    setAddingKey(metaKey)
    try {
      // The keyword path lists 50 tokens at a time, so it can't read `symbol()`
      // for each of them up front the way the address path does — resolve it here
      // instead, for the one token actually being added. `symbolOnchain` from the
      // API short-circuits the RPC, and the resolver caches per chainId:address,
      // so the address path (which already resolved on search) pays nothing.
      const symbolOnchain = await resolveOnchainSymbolFor(chainId, contractAddr, tokenData.symbolOnchain)

      // Best-effort balance for the connected account so the row is meaningful
      // immediately; a later refresh recomputes it from Moralis/multicall.
      const { balance, balanceFormatted } = await _fetchBalance(
        selectedChain?.chainId || selectedChain?.chain,
        contractAddr,
        address,
        tokenData.decimals
      )
      // Priced in the unit `balanceFormatted` is in (per share for a vault).
      const { priceUSD, isYieldConverted } = await _resolvePriceUSD(chainId, contractAddr, tokenData)
      const valueUSD = balanceFormatted * priceUSD

      const newToken = {
        chainId,
        contractAddress: contractAddr,
        metaKey,
        symbol: symbolOnchain || tokenData.symbol || '',
        name: tokenData.name || tokenData.symbol || '',
        iconUrl: tokenData.iconUrl || '',
        decimals: tokenData.decimals,
        isNative: false,
        isVerified: tokenData.isVerified,
        isPossibleSpam: tokenData.isPossibleSpam,
        balance,
        balanceFormatted,
        priceUSD,
        valueUSD,
        priceChange24hPct: tokenData.priceChange24hPct,
        coinGeckoId: tokenData.coinGeckoId,
        marketCapRank: tokenData.marketCapRank,
        categories: tokenData.categories,
        socials: tokenData.socials,
        // Same fields the refresh service writes, so a manually added token is a
        // first-class citizen of the yield path: commitChainTokens keeps them,
        // refreshTokenBalances selects vaults by yieldProtocol, and the detail
        // screen reads yieldAsset to decide the chart can't be drawn.
        yieldProtocol: tokenData.yieldProtocol,
        yieldAsset: tokenData.yieldAsset,
        // A converted price is per-share; flagged so a later refresh doesn't
        // mistake it for the plain API price.
        isYieldConverted,
        isCustom: true,
        isHidden: false,
        // Explicit user action — refreshes must not re-derive this one.
        hiddenByUser: false,
        isManuallyShown: true
      }

      // Re-read in case the list changed while awaiting the balance call.
      const freshList = ReduxService.getAccountTokenList()
      const freshEntry = freshList[address] || { tokens: [], totalUSD: 0, lastSyncedAt: 0 }
      const tokens = [...(freshEntry.tokens || []), newToken]
      // Same account-level mirror as above — the user asked for this token.
      const userHiddenKeys = { ...(freshEntry.userHiddenKeys || {}), [metaKey]: false }
      ReduxService.setAccountTokenList({ ...freshList, [address]: { ...freshEntry, tokens, userHiddenKeys } })
      syncChainFilter(chainId)
    } finally {
      setAddingKey(null)
      _this?.closeDrawer && _this.closeDrawer()
    }
  }

  const handleChangeText = (text) => {
    // Only the LEADING whitespace is stripped: a token name legitimately contains
    // spaces ("Wrapped Ether"), and trimming the whole string on every keystroke
    // would eat the space the moment it's typed. The trailing space is dropped by
    // `trimmedQuery` when the search actually runs.
    setSearchText(text.replace(/^\s+/, '').slice(0, MAX_QUERY_LENGTH))
    setResultState(RESULT_STATE.IDLE)
    setResults([])
  }

  const renderChainIcon = (chain, variantIcon = 'small') => {
    return (
      <MyIcon
        uri={chain.icon}
        uriDefault={images.UIV2.icons.unknowChain}
        variant={variantIcon}
        isBorderIcon />
    )
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.addToken.title')}
          leftIcon={images.UIV2.icons.addToken}
        />

        {/* Select network */}
        <MyText style={{ paddingTop: pixelByHeight(8) }} variant='subTitle' className='text-medium'>{I18n.t('v2.addToken.selectNetwork')}</MyText>

        <MySelectDropdown
          dropdownStyle={{
            paddingHorizontal: pixelByWidth(12)
          }}
          ref={dropdownRef}
          data={chainList}
          dropdownOverlayColor='transparent'
          onSelect={(item) => {
            setSelectedChain(item)
            setResultState(RESULT_STATE.IDLE)
            setResults([])
          }}
          renderItem={(item, index) => {
            const isLast = index === chainList.length - 1
            return (
              <MyActionRow
                isSelectDropdown
                noBorder={isLast}
                title={item.name}
                contentContainerStyle={{ gap: pixelByWidth(22) }}
                leftElement={renderChainIcon(item, 'small')}
              />
            )
          }}
        >
          {(_selectedItem, isVisible) => (
            <View>
              <View style={styles.chainSelector}>
                {renderChainIcon(selectedChain, 'small')}
                <MyText style={styles.chainSelectorText}>{selectedChain?.name || I18n.t('v2.addToken.selectNetwork')}</MyText>
                <MyIcon
                  uri={isVisible ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand}
                  variant='small'
                />
              </View>
            </View>
          )}
        </MySelectDropdown>

        {/* Token name / symbol / contract address input — same MyInput area
          pattern as RegisterAddress. */}
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <MyInput
              noErrorSpace={!addressError}
              isError={!!addressError}
              errMessage={addressError}
              typeInput='area'
              value={searchText}
              onChangeText={handleChangeText}
              maxLength={MAX_QUERY_LENGTH}
              placeholder={I18n.t('v2.addToken.searchPlaceholder')}
              autoCorrect={false}
              // Multiline area, but center the cursor/placeholder vertically (default
              // for a multiline input is top-aligned).
              textAlignVertical='center'
              inputConfig={{ style: styles.inputTextArea }}
              inputWrapperConfig={{ style: styles.inputWrapperArea }}
            />
          </View>
          <View style={styles.searchButtonWrap}>
            <TouchableOpacity
              style={[styles.searchButton, (resultState === RESULT_STATE.LOADING || !canSearch) && { opacity: 0.5 }]}
              onPress={handleSearch}
              activeOpacity={0.8}
              disabled={resultState === RESULT_STATE.LOADING || !canSearch}
            >
              {resultState === RESULT_STATE.LOADING
                ? <LottieView style={styles.searchLoadingDots} source={images.threeDotsWhiteLoading} autoPlay loop />
                : <MyIcon variant='search' uri={images.UIV2.icons.search} style={styles.searchIcon} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Result area */}
        {resultState === RESULT_STATE.ERROR && (
          <StatusMessage
            variant='error'
            message={I18n.t('v2.addToken.noTokenFound')}
            style={styles.statusError}
          />
        )}

        {resultState === RESULT_STATE.NO_MATCH && (
          <StatusMessage
            variant='error'
            message={I18n.t('v2.addToken.noMatching')}
            style={styles.statusError}
          />
        )}

        {resultState === RESULT_STATE.EXISTS && (
          <StatusMessage
            variant='error'
            message={I18n.t('AddCoinScreen.errorExitToken')}
            style={styles.statusError}
          />
        )}

        {/* One row per hit — an address lookup simply produces a list of one, so
          the single-result layout is unchanged. Fills the rest of the drawer and
          scrolls inside it, so a 50-hit keyword search can't run off the screen;
          must come from gesture-handler or the list won't scroll inside a drawer
          on Android. */}
        {resultState === RESULT_STATE.SUCCESS && results.length > 0 && (
          <ScrollView
            style={styles.resultList}
            keyboardShouldPersistTaps='handled'
            showsVerticalScrollIndicator={false}
          >
            {results.map((token) => {
              const metaKey = buildMetaKey(Number(selectedChain?.chainId), lowerCase(token.contractAddress))
              return (
                <View key={metaKey} style={styles.resultRow}>
                  <TokenIconWithChain
                    tokenIconUri={token.iconUrl}
                    chainId={Number(selectedChain?.chainId)}
                  />
                  {/* Content carries the bottom divider so it runs from the text to the
                    page edge, leaving the icon out (matches design). */}
                  <View style={styles.resultContent}>
                    <View style={styles.tokenTextWrap}>
                      {/* subTitle (18px/700) — same weight TokenRow gives a token's
                        name, so the ticker leads the row and the address below
                        reads as secondary. */}
                      <MyText fontWeight='700' style={styles.tokenName}>{token.symbol || token.name || '-'}</MyText>
                      {/* Keyword hits routinely share a ticker (a dozen tokens
                        answer to "usdc"), so the contract address is what tells
                        them apart. */}
                      <MyText className='text-medium'>
                        {convertAddressArrToString([token.contractAddress])}
                      </MyText>
                    </View>
                    <MyButton
                      size='small'
                      label={I18n.t('v2.common.add')}
                      disableLiquidGlass
                      onPress={() => handleAdd(token)}
                      isLoading={addingKey === metaKey}
                      isDisable={!!addingKey}
                    />
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}
      </View>
    </TouchableWithoutFeedback>

  )
}

const _toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const _buildSocials = (k) => ({
  telegram_channel_identifier: k?.telegram_channel_identifier || null,
  subreddit_url: k?.subreddit_url || null,
  facebook_username: k?.facebook_username || null,
  twitter_screen_name: k?.twitter_screen_name || null,
  homepage: k?.homepage || null,
  announcement_url: k?.announcement_url || null,
  chat_url: k?.chat_url || null
})

// Normalized metadata shape consumed by the result row + handleAdd. Both the
// Keyring and on-chain/CoinGecko paths return this exact shape so the rest of
// the component never has to branch on the source.
const _buildMeta = ({ contractAddress, symbol, name, iconUrl, decimals, priceUSD, priceChange24hPct, coinGeckoId, marketCapRank, categories, socials, yieldProtocol, yieldAsset }) => ({
  contractAddress: lowerCase(contractAddress),
  symbol: symbol || '',
  name: name || symbol || '',
  iconUrl: iconUrl || '',
  decimals: Number(decimals ?? 18),
  priceUSD: _toNumber(priceUSD),
  priceChange24hPct: _toNumber(priceChange24hPct),
  coinGeckoId: coinGeckoId || null,
  marketCapRank: marketCapRank || null,
  categories: categories || null,
  socials: socials || null,
  // Yield identity, carried from the Keyring entry. Without it a manually added
  // vault is indistinguishable from a plain token everywhere downstream, and its
  // balance is valued as `shares x underlying price` forever — the on-chain
  // path that fixes that (refreshTokenBalances) selects vaults by yieldProtocol.
  // Passed through RAW: the Keyring caller records a real answer (tag or null),
  // while the on-chain/CoinGecko fallback — where the Keyring API never
  // answered (unlisted token, or the lookup failed) — leaves both `undefined`,
  // so the refresh backfills keep asking instead of treating "no answer yet" as
  // the settled verdict "not a vault".
  yieldProtocol,
  yieldAsset,
  isVerified: false,
  isPossibleSpam: false
})

// Look up the token in the Keyring token API (same endpoint the auto-refresh
// uses) by contract address, via the unified `keyrings/tokens/all/{chainId}`
// endpoint. Returns the raw Keyring entry, or null when the token isn't listed.
const _fetchKeyringToken = async (chainId, contractAddress) => {
  const id = Number(chainId)
  try {
    const res = await BaseAPI.getData(`${KEYRING_TOKENS_ALL_API}/${id}`, { addresses: contractAddress })
    const list = res?.items
    if (!Array.isArray(list)) return null
    const addr = lowerCase(contractAddress)
    return list.find((k) => lowerCase(k?.address) === addr) || null
  } catch {
    return null
  }
}

// Ranks a keyword hit: lower is better. `key` is a plain substring match over
// name, symbol AND address, so the token the user meant is rarely first —
// searching "usdc" on Ethereum answers with 62 rows and the real USDC sitting at
// position 32, behind a wall of vault wrappers (spUSDC, aEthLidoUSDC, steakcusdc…).
// The API exposes no sort, and neither `market_cap` nor `market_cap_rank` can
// break the tie: a wrapper inherits both from its underlying asset, so every
// "usdc" hit reports the same 74.5B cap and rank 6. An exact ticker match does
// separate them, with real trading volume as the tie-breaker below.
const _scoreKeywordMatch = (item, keyword) => {
  const symbol = lowerCase(item?.symbol || '')
  const name = lowerCase(item?.name || '')
  if (symbol === keyword) return 0
  if (name === keyword) return 1
  if (symbol.startsWith(keyword)) return 2
  if (name.startsWith(keyword)) return 3
  return 4
}

// Keyword lookup against the Keyring search endpoint. Returns normalized metadata
// in the same shape as the by-address path, best match first. An empty list means
// the chain lists nothing by that name — NOT that the request failed (a failure
// throws, and the caller shows the generic error instead).
const _fetchTokensByKeyword = async (chainId, keyword) => {
  const res = await BaseAPI.getData(KEYRING_TOKEN_SEARCH_API, {
    chainId: Number(chainId),
    key: keyword,
    limit: SEARCH_RESULT_LIMIT
  })
  // This endpoint answers with `result` as an object KEYED BY ADDRESS, not the
  // `items` array the rest of the token API uses.
  const result = res?.result
  if (!result || typeof result !== 'object') return []

  const query = lowerCase(keyword)
  const unique = new Map()
  Object.values(result).forEach((item) => {
    // The chain's NATIVE entry comes back with an empty address (and can match a
    // keyword — "eth" does on Katana). It is already in every token list and has
    // no contract to add, so drop it.
    if (!item?.address || isNativeToken(item.address, Number(chainId))) return
    const key = lowerCase(item.address)
    if (!unique.has(key)) unique.set(key, item)
  })

  return [...unique.values()]
    .sort((a, b) => (
      _scoreKeywordMatch(a, query) - _scoreKeywordMatch(b, query) ||
      _toNumber(b?.total_volume) - _toNumber(a?.total_volume)
    ))
    .map((item) => ({
      ..._keyringToTokenMeta(item, item.address),
      // Deliberately outside `_buildMeta`: this is an INPUT to the on-chain symbol
      // resolution done at add time, never a field the token list stores.
      symbolOnchain: item?.symbolOnchain
    }))
}

// Map a raw Keyring entry → normalized metadata.
const _keyringToTokenMeta = (keyring, contractAddress) => _buildMeta({
  contractAddress,
  // `symbolOnchain` (when the API provides it) is the contract's own ticker, so
  // it outranks the audit/listing symbols. The on-chain fallback path below
  // already reads `symbol()` directly, so this keeps both paths consistent
  // without spending an extra RPC call here.
  symbol: keyring?.symbolOnchain || keyring?.auditGoplus?.token_symbol || keyring?.symbol,
  name: keyring?.name,
  iconUrl: keyring?.icon_image,
  decimals: keyring?.decimals,
  priceUSD: keyring?.price,
  priceChange24hPct: keyring?.price_change_percentage_24h,
  coinGeckoId: keyring?.coinGeckoId || keyring?.idCoinGecko,
  marketCapRank: keyring?.market_cap_rank,
  categories: keyring?.categories,
  socials: _buildSocials(keyring),
  // This entry came from a BY-ADDRESS Keyring lookup — authoritative on yield
  // identity — so an absent tag is a real answer and is recorded as `null`.
  // Through the two-field resolver, not `keyring.yieldProtocol` directly: a
  // protocol the API serves only in `yieldProtocolV2` (Maple today) would
  // otherwise be added as a plain token — no per-share pricing, no APY card, no
  // protocol logo — for the whole life of the entry.
  yieldProtocol: resolveApiYieldProtocol(keyring) || null,
  yieldAsset: resolveApiYieldAsset(keyring) || null
})

// Fallback path: resolve name/symbol/decimals on-chain, then enrich price +
// metadata via CoinGecko (non-fatal if CoinGecko has nothing). Returns
// normalized metadata, or null when the on-chain read fails.
const _getTokenMeta = async (rpcUrl, address, chain) => {
  try {
    const infoToken = await getTokenName(rpcUrl, address)
    let iconUrl = ''
    let coinGeckoId = null
    let priceUSD = 0
    let priceChange24hPct = 0
    let socials = null
    let marketCapRank = null
    let categories = null

    try {
      const cgInfo = await CoinGeckoAPI.searchCoingeckoId({ chain: chain.chainCoingecko || chain.chain, address, symbol: infoToken.symbol })
      if (cgInfo?.id) {
        const dataToken = await CoinGeckoAPI.getTokenInfoById(cgInfo.id)
        if (dataToken) {
          iconUrl = dataToken?.image?.small || ''
          coinGeckoId = cgInfo.id
          priceUSD = dataToken?.market_data?.current_price?.usd || 0
          priceChange24hPct = dataToken?.market_data?.price_change_percentage_24h || 0
          socials = _buildSocials(dataToken?.links)
          marketCapRank = dataToken?.market_cap_rank || null
          categories = dataToken?.categories || null
        }
      }
    } catch {
      // CoinGecko errors are non-fatal — token still valid
    }

    return _buildMeta({
      contractAddress: address,
      symbol: infoToken?.symbol,
      name: infoToken?.name,
      iconUrl,
      decimals: infoToken?.decimal,
      priceUSD,
      priceChange24hPct,
      coinGeckoId,
      marketCapRank,
      categories,
      socials
    })
  } catch {
    return null
  }
}

// Price in the same unit as `balanceFormatted`, plus whether it is a converted
// per-SHARE price. Yield tokens are priced by resolveKeyringTokenPriceUSD — the
// same rules as the token list (rebasing → underlying's unit price, share vault
// → per-share price read on-chain). Falls back to the API price when that
// fails; the next full refresh corrects it.
const _resolvePriceUSD = async (chainId, contractAddress, tokenData) => {
  const apiPrice = { priceUSD: tokenData.priceUSD, isYieldConverted: false }
  if (!tokenData?.yieldProtocol) return apiPrice
  try {
    const price = await resolveKeyringTokenPriceUSD(chainId, {
      address: contractAddress,
      symbol: tokenData.symbol,
      decimals: tokenData.decimals,
      price: tokenData.priceUSD,
      yieldProtocol: tokenData.yieldProtocol,
      yieldAsset: tokenData.yieldAsset
    })
    return price > 0
      ? { priceUSD: price, isYieldConverted: isShareBasedProtocol(tokenData.yieldProtocol) }
      : apiPrice
  } catch {
    return apiPrice
  }
}

// Best-effort on-chain balance for the connected account. Returns the raw wei
// string plus the formatted number; defaults to zero on any failure.
const _fetchBalance = async (chainTypeOrChainId, contractAddress, accountAddress, decimals) => {
  try {
    const raw = await AllChainServices.getTokenBalanceByChain(
      chainTypeOrChainId,
      contractAddress,
      accountAddress,
      decimals,
      false
    )
    if (raw == null) return { balance: '0', balanceFormatted: 0 }
    const balance = raw.toString()
    const balanceFormatted = Number(formatUnits(BigInt(balance), Number(decimals ?? 18)))
    return { balance, balanceFormatted: Number.isFinite(balanceFormatted) ? balanceFormatted : 0 }
  } catch {
    return { balance: '0', balanceFormatted: 0 }
  }
}

const styles = StyleSheet.create({
  // flex:1 makes the page fill the fixed-height drawer so the result list below
  // can own whatever is left under the input and scroll inside it — without it
  // the list is only as tall as its own cap and leaves dead space at the bottom.
  container: {
    flex: 1,
    paddingHorizontal: pixelByWidth(16),
    paddingBottom: pixelByHeight(24)
  },

  chainSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.BG_INPUT_FIELD,
    borderRadius: pixelByHeight(30),
    paddingHorizontal: pixelByWidth(12),
    gap: pixelByWidth(22),
    height: pixelByHeight(40),
    marginTop: pixelByHeight(12)
  },
  chainSelectorText: {
    flex: 1,
    color: Colors.WHITE
  },

  // Area input row — center both the field and the search button vertically.
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: pixelByHeight(14),
    gap: pixelByWidth(10)
  },
  inputWrap: {
    flex: 1
  },
  // Reserve the 2-line area height, but center the cursor/placeholder vertically
  // (a multiline input top-aligns by default).
  inputWrapperArea: {
    minHeight: FIELD_MIN_HEIGHT,
    alignItems: 'center'
  },
  // Let the multiline TextInput auto-size to its content instead of filling the
  // wrapper (height:'100%'), so the wrapper's alignItems:'center' can vertically
  // center it — the cross-platform way to center a multiline input (iOS ignores
  // textAlignVertical).
  inputTextArea: {
    height: 'auto'
  },
  // Match the area height so the search button lines up centered with the field.
  searchButtonWrap: {
    minHeight: FIELD_MIN_HEIGHT,
    justifyContent: 'center'
  },
  searchButton: {
    width: getSizeImgSquare('large'),
    height: getSizeImgSquare('large'),
    borderRadius: getSizeImgSquare('large') / 2,
    backgroundColor: Colors.BG_INPUT_FIELD,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.BG_BOX_SMALL
  },
  searchIcon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },
  searchLoadingDots: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },
  // Takes all the height left under the input rather than a fixed cap, so the
  // results run to the bottom of the drawer instead of stopping short of it. A
  // single hit (the address path) still renders as one row — the list just no
  // longer reserves a box of its own.
  resultList: {
    flex: 1
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: pixelByHeight(14),
    gap: pixelByWidth(12)
  },
  resultContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12),
    paddingVertical: pixelByHeight(12),
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.BG_BOX_SMALL
  },

  // StatusMessage error row — same spacing as RegisterAddress's inline error.
  statusError: {
    alignItems: 'center',
    marginTop: pixelByHeight(14)
  },
  // Symbol over shortened address — takes the row's free width so the Add button
  // keeps its natural size.
  tokenTextWrap: {
    flex: 1,
    gap: pixelByHeight(2)
  },
  tokenName: {
    color: Colors.WHITE
  }
})

export default AddTokenDrawer
