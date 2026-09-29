import React, { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import MyInputSearch from 'frontend/Components/UI/MyInputSearch'
import ContainerAnchor from 'frontend/Components/UI/ContainerAnchor'
import TokenRow from '../TokenRow'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { lowerCase } from 'common/function'
import { Colors, PADDING_TOP_CONTAINER_DRAWER } from 'common/styles'
import { toggleTokenHidden } from 'src/Services/TokenListV2'
import styles from './styles'
import { FlatList } from 'react-native-gesture-handler'

const HiddenTokenList = ({ address, selectedChainId, onClose }) => {
  const addr = lowerCase(address || '')
  const allTokens = useSelector((s) => s.accountTokenListRedux?.[addr]?.tokens || [])
  // Mirror the main list's chain filter — when a chain is selected in the
  // header, only that chain's hidden tokens are shown here.
  const hiddenTokens = useMemo(() => allTokens.filter((t) => (
    t.isHidden && (selectedChainId == null || Number(t.chainId) === Number(selectedChainId))
  )), [allTokens, selectedChainId])

  // Local filter over the hidden tokens shown above — matches token name
  // (or symbol) and contract address, case-insensitive.
  const [searchText, setSearchText] = useState('')
  const query = searchText.trim().toLowerCase()
  const filteredTokens = useMemo(() => {
    if (!query) return hiddenTokens
    return hiddenTokens.filter((t) => (
      String(t.name || '').toLowerCase().includes(query) ||
      String(t.symbol || '').toLowerCase().includes(query) ||
      lowerCase(t.contractAddress || '').includes(query)
    ))
  }, [hiddenTokens, query])

  const [heightAnchorHeader, setHeightAnchor] = useState(0)
  const [selected, setSelected] = useState(() => new Set())

  const toggleSelect = (metaKey) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(metaKey)) next.delete(metaKey)
      else next.add(metaKey)
      return next
    })
  }

  const handleShow = () => {
    selected.forEach((metaKey) => toggleTokenHidden(addr, metaKey, false))
    setSelected(new Set())
    onClose && onClose()
  }

  // Same header layout as the Other networks drawer: title + search input share
  // one blurred anchor pinned to the top, the list scrolls underneath it.
  const renderHeader = () => (
    <ContainerAnchor
      fallbackColor={Colors.BG_MAIN_DRAWER}
      onSetHeightContainer={setHeightAnchor}
    >
      <View>
        <TitleDrawer
          leftIcon={images.UIV2.icons.unHide}
          title={I18n.t('v2.hiddenTokens.title')}
          rightElement={
            selected.size > 0
              ? (
                <MyButton
                  size='small'
                  label={I18n.t('Initial.show')}
                  disableLiquidGlass
                  onPress={handleShow}
                />
              )
              : null
          }
        />
        <MyInputSearch
          placeholder={I18n.t('ExchangeScreen.selectToken')}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType='search'
          rightIcon={images.UIV2.icons.search}
        />
      </View>
    </ContainerAnchor>
  )

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <MyIcon
        uri={images.UIV2.icons.noData}
        style={styles.emptyIcon}
        variant='extraLarge'
        resizeMode='contain'
      />
      <MyText variant='small' className='text-low'>
        {I18n.t(query ? 'v2.addToken.noMatching' : 'v2.hiddenTokens.empty')}
      </MyText>
    </View>
  )

  const renderFooter = () => (
    <View style={styles.footerWrap}>
      <MyText variant='small' className='text-center text-low'>
        {I18n.t('v2.hiddenTokens.footer')}
      </MyText>
    </View>
  )

  return (
    <MyViewPage style={styles.container}>
      {/* Title + search stay fixed at the top — only the list below scrolls. */}
      {renderHeader()}
      <View style={{ height: PADDING_TOP_CONTAINER_DRAWER }} />
      <FlatList
        style={[styles.list, { paddingTop: heightAnchorHeader - PADDING_TOP_CONTAINER_DRAWER }]}
        data={filteredTokens}
        keyExtractor={(t) => t.metaKey}
        renderItem={({ item }) => (
          <TokenRow
            token={item}
            noChevron
            isSelected={selected.has(item.metaKey)}
            onPress={() => toggleSelect(item.metaKey)}
          />
        )}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
      />
    </MyViewPage>
  )
}

export default HiddenTokenList
