import React, { useMemo, useState } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import TokenRow from '../TokenRow'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { lowerCase } from 'common/function'
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

  const renderHeader = () => (
    <TitleDrawer
      absolute
      hasBlur
      leftIcon={images.UIV2.icons.unHide}
      title={I18n.t('v2.hiddenTokens.title')}
      containerConfig={{ style: styles.headerContainer }}
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
  )

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <MyIcon
        uri={images.UIV2.icons.noData}
        style={styles.emptyIcon}
        variant='extraLarge'
        resizeMode='contain'
      />
      <MyText variant='small' className='text-low'>{I18n.t('v2.hiddenTokens.empty')}</MyText>
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
    <MyViewPage isUseDrawer style={styles.container}>
      {/* Title stays fixed at the top — only the list below scrolls. */}
      {renderHeader()}
      <FlatList
        isUseDrawer
        style={styles.list}
        data={hiddenTokens}
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
