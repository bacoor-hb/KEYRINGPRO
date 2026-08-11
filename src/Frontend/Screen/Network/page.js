import React, { useMemo } from 'react'
import { View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import styles from './styles'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import { getSafeAreaValues, pixelByHeight } from 'common/styles'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import { useSelector, useDispatch } from 'react-redux'
import { chainType, LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import images from 'assets/Image'
import ChainRow from './Component/ChainRow'
import ReduxService from 'common/redux'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import I18n from 'assets/Lang'

const NON_EVM_CHAINS = new Set([chainType.btc, chainType.solana])
const DEFAULT_CHAIN_ID_SET = new Set(LIST_DEFAULT_CHAIN_ID.map(Number))
const SCROLL_CONTENT_STYLE = { paddingBottom: getSafeAreaValues().bottom }

const NetworkPage = ({ func }) => {
  const activeEvmChainIdsRedux = useSelector(state => state.activeEvmChainIdsRedux)
  const blockchainListRedux = useSelector(state => state.blockchainListRedux)
  const dispatch = useDispatch()

  // Common = chains in LIST_DEFAULT_CHAIN_ID; everything else (added via Other networks) = custom.
  const { commonChains, addedChains } = useMemo(() => {
    const list = blockchainListRedux || {}
    // Common chains follow LIST_DEFAULT_CHAIN_ID order exactly (not redux key order).
    const common = []
    for (const id of LIST_DEFAULT_CHAIN_ID) {
      const item = list[id]
      if (item && !NON_EVM_CHAINS.has(item.chain)) common.push(item)
    }
    const added = []
    for (const item of Object.values(list)) {
      if (!item || NON_EVM_CHAINS.has(item.chain)) continue
      if (!DEFAULT_CHAIN_ID_SET.has(Number(item.chainId))) added.push(item)
    }
    // Added networks order: chains added later show first. `addedAt` is stamped when a
    // chain is added (see OtherNetwork), so newer = larger. Chains added before this
    // feature existed have no addedAt — they sort AFTER the stamped ones, by chainId
    // ascending. Net order: [newly added, newest first] → [legacy, by chainId].
    added.sort((a, b) => {
      const aAt = a.addedAt
      const bAt = b.addedAt
      if (aAt != null && bAt != null) return bAt - aAt // both stamped → newest first
      if (aAt != null) return -1 // stamped ones go before legacy ones
      if (bAt != null) return 1
      return Number(a.chainId) - Number(b.chainId) // legacy → by chainId ascending
    })
    return { commonChains: common, addedChains: added }
  }, [blockchainListRedux])

  const activeSet = useMemo(
    () => new Set((activeEvmChainIdsRedux || []).map(Number)),
    [activeEvmChainIdsRedux]
  )

  const toggleChain = (chainId) => {
    const id = Number(chainId)
    if (!Number.isFinite(id)) return
    const current = (activeEvmChainIdsRedux || []).map(Number)
    if (current.includes(id)) {
      if (current.length <= 1) {
        func && func.showAlert(I18n.t('v2.network.atLeastOneActive'), '', { type: true })
        return
      }
      dispatch(StorageReduxAction.setActiveEvmChainIds(current.filter(c => c !== id)))
      ReduxService.resetChainIdByAddressScreen(id)
    } else {
      dispatch(StorageReduxAction.setActiveEvmChainIds([...current, id]))
    }
  }

  const deleteChain = (chainId) => {
    const id = Number(chainId)
    if (!Number.isFinite(id)) return
    const current = (activeEvmChainIdsRedux || []).map(Number)
    if (current.includes(id) && current.length <= 1) {
      func && func.showAlert(I18n.t('v2.network.atLeastOneActive'), '', { type: true })
      return
    }
    const next = { ...(blockchainListRedux || {}) }
    delete next[id]
    dispatch(StorageReduxAction.setBlockChainList(next))
    if (current.includes(id)) {
      dispatch(StorageReduxAction.setActiveEvmChainIds(current.filter(c => c !== id)))
    }
    ReduxService.resetChainIdByAddressScreen(chainId)
  }

  // Common chains toggle on/off; custom (added) chains don't toggle — they only have a delete action.
  const renderRows = (list, withDelete) => list.map((item, index) => (
    <ChainRow
      key={`chain-${item.chainId}`}
      icon={item.icon}
      title={item.name}
      gasSymbol={item.nativeCurrency?.symbol}
      isActive={withDelete ? true : activeSet.has(Number(item.chainId))}
      noBorder={index === list.length - 1}
      onPress={withDelete ? undefined : () => toggleChain(item.chainId)}
      rightAction={withDelete ? { icon: images.UIV2.icons.delete, onPress: () => deleteChain(item.chainId) } : undefined}
    />
  ))

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <ScrollViewBlurHeader contentContainerStyle={SCROLL_CONTENT_STYLE} showsVerticalScrollIndicator={false}>
        <TitleScreen title={I18n.t('v2.network.title')} />
        <MyText variant='subTitle' style={[styles.sectionTitle, { paddingTop: pixelByHeight(4) }]}>
          {I18n.t('v2.network.commonNetworks')}
        </MyText>
        <MyLinearGradient disableClip>
          <View style={styles.listContainer}>
            {renderRows(commonChains, false)}
          </View>
        </MyLinearGradient>

        {addedChains.length > 0 && (
          <>
            <MyText variant='subTitle' style={[styles.sectionTitle, { paddingTop: pixelByHeight(16) }]}>
              {I18n.t('v2.network.addedNetworks')}
            </MyText>
            <MyLinearGradient disableClip>
              <View style={styles.listContainer}>
                {renderRows(addedChains, true)}
              </View>
            </MyLinearGradient>
          </>
        )}
      </ScrollViewBlurHeader>
    </MyViewPage>
  )
}

export default NetworkPage
