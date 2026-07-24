import { View, TouchableOpacity, Keyboard } from 'react-native'
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyInputSearch from 'frontend/Components/UI/MyInputSearch'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import images from 'assets/Image'
import styles from './styles'
import { chainType, SUPPORTED_BLOCKCHAIN_DATA } from 'common/constants/chain'
import BaseAPI from 'controller/API/BaseAPI'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import ChainRow from '../ChainRow'
import I18n from 'assets/Lang'
import LottieView from 'lottie-react-native'
import { Colors, PADDING_TOP_CONTAINER_DRAWER, sizeImageSquare } from 'common/styles'
import ContainerAnchor from 'frontend/Components/UI/ContainerAnchor'
import { FlatList } from 'react-native-gesture-handler'

const NON_EVM_CHAINS = new Set([chainType.btc, chainType.solana])
const EMPTY_LIST = []

const OtherNetwork = ({ _this }) => {
  const dispatch = useDispatch()
  const activeEvmChainIds = useSelector(s => s.activeEvmChainIdsRedux)
  const blockchainList = useSelector(s => s.blockchainListRedux)

  // What's typed in the input vs. the query actually applied to the list (only on search press).
  const [inputText, setInputText] = useState('')
  const [searchText, setSearchText] = useState('')
  const [chainList, setChainList] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [heightAnchorHeader, setHeightAnchor] = useState(0)
  // The results currently shown, plus a flag for "a search is in flight". On every search press
  // we clear `results` and flip `searching` on so the old list is replaced by the loading
  // indicator until fresh results are ready — even when `chainList` is already cached.
  const [results, setResults] = useState(EMPTY_LIST)
  const [searching, setSearching] = useState(false)
  // Chains the user has picked to add (committed only when pressing "Add").
  const [selectedSet, setSelectedSet] = useState(() => new Set())
  // Once "Add" is pressed we empty the list so the closing FlatList has no cells to recycle.
  const [isClosing, setIsClosing] = useState(false)
  const fetchPromiseRef = useRef(null)

  const ensureChainList = useCallback(() => {
    if (chainList || fetchPromiseRef.current) return
    setIsLoading(true)
    fetchPromiseRef.current = BaseAPI.getBlockChainList()
      .then(res => {
        // Default chains stay in the list and are selectable just like custom chains;
        // only chains already active are disabled (see renderItem).
        const list = Object.values(res || [])
          .filter(c => c && c.chainId && !NON_EVM_CHAINS.has(c.chain))
        setChainList(list)
      })
      .catch(() => setChainList([]))
      .finally(() => setIsLoading(false))
  }, [chainList])

  // Typing only updates the input — the list isn't filtered until the search icon is pressed.
  const onChangeSearch = useCallback((text) => {
    setInputText(text)
  }, [])

  const handleSearch = useCallback(() => {
    const text = inputText.trim()
    setSearchText(text)
    // Drop the old list and show the loading indicator straight away so re-searching gives
    // feedback; the effect below fills `results` once the (possibly cached) list is ready.
    setResults(EMPTY_LIST)
    if (text.length === 0) {
      setSearching(false)
      return
    }
    setSearching(true)
    Keyboard.dismiss()
    ensureChainList()
  }, [inputText, ensureChainList])

  const activeSet = useMemo(
    () => new Set((activeEvmChainIds || []).map(Number)),
    [activeEvmChainIds]
  )

  const filterChains = useCallback((list, query) => {
    const q = query.trim().toLowerCase()
    if (!q || !list) return EMPTY_LIST
    const seen = new Set()
    const out = []
    for (const c of list) {
      const id = Number(c?.chainId)
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue
      const name = String(c.name || '').toLowerCase()
      if (name.includes(q) || String(id).includes(q)) {
        seen.add(id)
        out.push(c)
      }
    }
    return out
  }, [])

  // Compute results once a search is in flight and the chain list has loaded. The compute is
  // deferred with a short timeout so the cleared list + loading indicator actually paint for a
  // frame first — when `chainList` is already cached the filter is instant, so without the defer
  // React coalesces the clear and the new results into one commit and you never see either the
  // old list disappear or the spinner. Re-searching cancels the pending timer (cleanup) so stale
  // results never land.
  useEffect(() => {
    if (!searching || !chainList) return
    const list = filterChains(chainList, searchText)
    const timer = setTimeout(() => {
      setResults(list)
      setSearching(false)
    }, 250)
    return () => clearTimeout(timer)
  }, [searching, chainList, searchText, filterChains])

  // Picking a chain only stages it locally — already-active chains are disabled and can't be toggled.
  const toggleSelect = useCallback((chainItem) => {
    const id = Number(chainItem.chainId)
    if (!Number.isFinite(id) || activeSet.has(id)) return
    setSelectedSet(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [activeSet])

  const handleAdd = useCallback(() => {
    if (selectedSet.size === 0) return
    const nextActive = [...(activeEvmChainIds || []).map(Number)]
    const nextBlockchain = { ...(blockchainList || {}) }
    let blockchainChanged = false

    // Ordering stamp for the "Added networks" list: newest-added shows first. Since
    // blockchainList is an object keyed by chainId, Object.values() loses insertion
    // order (numeric keys sort ascending), so we persist an `addedAt` on each newly
    // added chain and sort by it in the Network screen. Use a shared base + a running
    // increment so chains added together in one batch keep a stable, distinct order.
    let addedAtSeq = Date.now()

    for (const id of selectedSet) {
      if (!nextActive.includes(id)) nextActive.push(id)
      if (!nextBlockchain[id]) {
        // Default chains carry rich, paid-RPC metadata in SUPPORTED_BLOCKCHAIN_DATA —
        // use it as-is (marked supported, not custom) rather than the leaner API item.
        // Spread it so stamping addedAt doesn't mutate the shared constant.
        if (SUPPORTED_BLOCKCHAIN_DATA[id]) {
          nextBlockchain[id] = { ...SUPPORTED_BLOCKCHAIN_DATA[id], addedAt: addedAtSeq++ }
          blockchainChanged = true
          continue
        }
        const chainItem = chainList?.find(c => Number(c?.chainId) === id)
        if (!chainItem) continue
        const chain = String(chainItem.chain || '').toLowerCase()
        nextBlockchain[id] = {
          ...chainItem,
          chain,
          chainId: id,
          keyChain: `${chain}${id}`,
          isCustomChainData: true,
          isSupportedChain: false,
          addedAt: addedAtSeq++
        }
        blockchainChanged = true
      }
    }

    // Empty this list FIRST (isClosing -> data=[]) so the FlatList has no cells for Fabric
    // to recycle while the drawer animates closed — that recycle was the "Attempt to recycle
    // a mounted view" crash. Then commit Redux WHILE the drawer is still mounted: removing the
    // drawer overlay at the end of the close animation gives the revealed Network screen a
    // relayout pass, which is what makes the freshly-mounted "Added networks" gradient rows
    // actually paint. Dispatching after the overlay is gone leaves them laid-out-but-blank.
    setIsClosing(true)
    dispatch(StorageReduxAction.setActiveEvmChainIds(nextActive))
    if (blockchainChanged) dispatch(StorageReduxAction.setBlockChainList(nextBlockchain))
    _this?.closeDrawer && _this.closeDrawer()
  }, [selectedSet, activeEvmChainIds, blockchainList, chainList, dispatch, _this])

  const renderItem = useCallback(({ item, index }) => {
    const id = Number(item.chainId)
    return (
      <ChainRow
        icon={item.icon}
        iconWrapClassName='justify-center'
        title={item.name}
        rightLabel={item.chainId}
        isActive={selectedSet.has(id)}
        disabled={activeSet.has(id)}
        noBorder={index === results.length - 1}
        // Search can surface arbitrary chains whose remote SVG icons use <filter>
        // primitives that crash react-native-svg on the New Arch — strip them here.
        sanitizeIconFilters
        onPress={() => toggleSelect(item)}
      />
    )
  }, [activeSet, selectedSet, results.length, toggleSelect])

  const keyExtractor = useCallback((item) => `other-chain-${item.chainId}`, [])

  const renderEmpty = useCallback(() => {
    if (isClosing || !searchText.trim()) return null
    if (searching || isLoading) {
      return (
        <View style={styles.statusBox}>
          <LottieView
            source={images.threeDotsLoading}
            style={{ width: sizeImageSquare(48), height: sizeImageSquare(48) }}
            autoPlay
            loop
          />
        </View>
      )
    }
    return (
      <View style={styles.statusBox}>
        <MyText className='text-low'>{I18n.t('v2.network.noMatching')}</MyText>
      </View>
    )
  }, [searchText, searching, isLoading, isClosing])

  const renderHeader = useCallback(() => {
    if (results.length === 0) return null
    return (
      <View style={styles.tableHeader}>
        <MyText className='text-low flex-1'>{I18n.t('v2.network.networkName')}</MyText>
        <MyText className='text-low'>ID</MyText>
      </View>
    )
  }, [results.length])

  return (
    <MyViewPage style={styles.container}>
      <ContainerAnchor fallbackColor={Colors.BG_MAIN_DRAWER} onSetHeightContainer={setHeightAnchor}>
        <View>
          <TitleDrawer
            title={I18n.t('v2.network.otherNetworks')}
            leftIcon={images.UIV2.icons.network}
            rightElement={(
              <MyButton
                style={{ opacity: selectedSet.size > 0 ? 1 : 0 }}
                disableLiquidGlass
                variant='secondary'
                size='small'
                label={I18n.t('v2.common.add')}
                onPress={() => {
                  if (selectedSet.size > 0) {
                    handleAdd()
                  }
                }} />
            )}
          />
          <MyInputSearch
            placeholder={I18n.t('v2.selectChain.searchPlaceholder')}
            value={inputText}
            onChangeText={onChangeSearch}
            returnKeyType='search'
            onSubmitEditing={handleSearch}
            rightIcon={(
              <TouchableOpacity onPress={handleSearch} activeOpacity={0.7}>
                <MyIcon uri={images.UIV2.icons.search} variant='small' />
              </TouchableOpacity>
            )}
          />
        </View>

      </ContainerAnchor>
      <View style={{ height: PADDING_TOP_CONTAINER_DRAWER }} />

      <FlatList
        style={[styles.scrollList, { paddingTop: heightAnchorHeader - PADDING_TOP_CONTAINER_DRAWER }]}
        contentContainerStyle={styles.scrollContent}
        data={isClosing ? EMPTY_LIST : results}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      />
    </MyViewPage>
  )
}

export default OtherNetwork
