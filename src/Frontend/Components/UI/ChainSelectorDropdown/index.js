import React, { useMemo } from 'react'
import { View, StyleSheet, Dimensions } from 'react-native'
import MyIcon from 'frontend/Components/UI/MyIcon'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import GlassView from 'frontend/Components/UI/GlassView'
import { getSizeStyle } from 'frontend/Components/UI/GlassView/sizeStyle'
import MySelectDropdown from 'frontend/Components/UI/MySelectDropdown'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import ListChain from 'frontend/Screen/HomeScreen/Component/ListChain'
import images from 'assets/Image'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import { Colors, getSizeImgSquare, pixelByWidth, width } from 'common/styles'
import { useSelector } from 'react-redux'

// Sentinel for the "All chains" row. Selecting it reports `null` to the parent.
export const ALL_CHAIN = 'ALL'

const DEFAULT_CHAIN_ID_SET = new Set(LIST_DEFAULT_CHAIN_ID.map(Number))

// Build the dropdown's item list from the active EVM chain ids: default chains
// first (in LIST_DEFAULT_CHAIN_ID priority order), then custom chains. Pass
// `allowSet` to restrict to a subset (e.g. the chains the AI agent supports).
export const buildChainItems = (activeEvmChainIds, blockchainList, allowSet = null) => {
  const active = (activeEvmChainIds || [])
    .map(Number)
    .filter((id) => !allowSet || allowSet.has(id))
  const activeSet = new Set(active)
  const defaults = LIST_DEFAULT_CHAIN_ID.map(Number).filter((id) => activeSet.has(id))
  const others = active.filter((id) => !DEFAULT_CHAIN_ID_SET.has(id))
  return [...defaults, ...others].map((id) => {
    const info = blockchainList?.[id] || {}
    return { chainId: id, name: info?.name || `Chain ${id}`, icon: info?.icon }
  })
}

// Right-align the dropdown under a header button (the library anchors at button.x
// with button width otherwise, so it overflows off the right edge).
const SCREEN_W = Dimensions.get('window').width
const DROPDOWN_WIDTH = width(100) - pixelByWidth(32) // full screen minus horizontal padding
const DROPDOWN_STYLE = { width: DROPDOWN_WIDTH, left: SCREEN_W - DROPDOWN_WIDTH - pixelByWidth(16) }

const styles = StyleSheet.create({
  // Liquid-glass pill — <GlassView variant='default'> owns the color (glass tint
  // on iOS 26+, fallback bg/border otherwise); size comes from getSizeStyle. Same
  // pattern as Security's "Auto-lock" pill.
  pill: {
    width: 'auto',
    // Center the trigger content within the glass surface (style, not className —
    // native LiquidGlassView doesn't apply Tailwind classNames).
    alignItems: 'center',
    justifyContent: 'center'
    // height: pixelByHeight(44)
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(12)
  },
  chevron: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },
  // White-ringed round icon for the selected single chain (no overflow:hidden —
  // clipping a native FastImage/SvgUri crashes Fabric on unmount; chain icons are
  // already round so no clip needed). 18px OUTER diameter (ring included) to match
  // ListChain's "All"-state icons — width:18 + borderWidth:1 is border-box in RN,
  // so the content area is 16px and the inner image must be 16 (see triggerIconImage).
  // Negative marginRight matches this single-icon gap to the "All" state's:
  // ListChain's last icon is position:absolute and overflows its layout box to the
  // right (overlap effect — its container is `sizeImageSquare(18)/1.3 - 2` wide but
  // the icon renders sizeImageSquare(18) wide), so its 12px row gap lands tighter.
  // This icon has no overflow, so pull the chevron in by the same overshoot
  // (visible - step = sizeImageSquare(18) - (sizeImageSquare(18)/1.3 - 2)) so both
  // states show the same visible gap. Keep this in sync with ListChain's step.
  triggerIcon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small'),
    borderRadius: getSizeImgSquare('small') / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -(getSizeImgSquare('small') - (getSizeImgSquare('small') / 1.3 - 2))
  },

  // First row "All" — white circular box with black "All" label, sized to match
  // a regular chain icon (24).
  allIcon: {
    width: getSizeImgSquare('medium'),
    height: getSizeImgSquare('medium'),
    borderRadius: getSizeImgSquare('medium') / 2,
    backgroundColor: Colors.WHITE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  allIconText: {
    color: Colors.BLACK
  }
})

/**
 * Shared chain-picker dropdown used by the TokenList header and the AI Search
 * header. Owns the trigger pill, the dropdown rows and all styling so both
 * screens stay in sync. Screen-specific concerns (which chains to list,
 * persistence) live in the wrapping components.
 *
 * @param {Array<{chainId:number,name:string,icon:?string}>} data chain rows
 * @param {?number} selectedChainId currently-selected chain (null = "All")
 * @param {(chainId:?number) => void} onSelectChain called with the picked chain
 *        id, or `null` when the "All" row is chosen
 * @param {boolean} [showAll] prepend an "All" row + show a multi-chain preview
 *        in the trigger when nothing is selected
 * @param {number} [maxPreview] icons shown in the "All" trigger preview
 */
const ChainSelectorDropdown = ({ data, selectedChainId, onSelectChain, showAll = false, maxPreview = 3, isUseHeader = false }) => {
  const { activeEvmChainIdsRedux, blockchainListRedux } = useSelector((s) => s)

  const dataChain = useMemo(() => {
    const dataFinal = (data || activeEvmChainIdsRedux).map(chain => {
      if (typeof chain === 'string' || typeof chain === 'number') {
        return blockchainListRedux[chain]
      }
      return chain
    })
    return dataFinal
  }, [blockchainListRedux, activeEvmChainIdsRedux, data])

  const rows = useMemo(
    () => (showAll ? [{ chainId: ALL_CHAIN, name: I18n.t('Content.all'), icon: null }, ...dataChain] : dataChain),
    [showAll, dataChain]
  )
  const selectedIcon = useMemo(
    () => dataChain.find((d) => d?.chainId?.toString() === selectedChainId?.toString())?.icon || null,
    [dataChain, selectedChainId]
  )

  return (
    <MySelectDropdown
      data={rows}
      dropdownStyle={DROPDOWN_STYLE}
      dropdownOverlayColor='transparent'
      onSelect={(item) => onSelectChain(item.chainId === ALL_CHAIN ? null : item.chainId)}
      renderItem={(item, index) => {
        const isLast = index === rows.length - 1
        const isAll = item.chainId === ALL_CHAIN
        return (
          <MyActionRow
            isSelectDropdown
            noBorder={isLast}
            title={item.name}
            leftElement={(
              isAll
                ? (
                  <View style={styles.allIcon}>
                    <MyText fontSize={12} style={styles.allIconText}>All</MyText>
                  </View>
                ) : (
                  <MyIcon
                    uri={item.icon}
                    uriDefault={images.UIV2.icons.unknowChain}
                    variant='medium'
                    isBorderIcon
                  />
                )
            )}
          />
        )
      }}
    >
      {/* The outer <View> is critical: react-native-select-dropdown extracts
        clonedElement.props from the children we pass and spreads them onto its
        own TouchableOpacity — the top-level element is NEVER rendered, only its
        `children` are. Wrapping GlassView in a View makes GlassView a grandchild,
        so it renders with full LiquidGlassView. (Same trick the Security screen
        uses around its Auto-lock pill.) */}
      {(_selectedItem, isVisible) => (
        <View>
          <GlassView
            variant='default'
            style={[getSizeStyle({ isUseHeader, noMinWidth: true }), styles.pill]}
          >
            <View style={styles.trigger}>
              {selectedChainId != null
                ? (
                  <View style={styles.triggerIcon}>
                    <MyIcon
                      uri={selectedIcon}
                      uriDefault={images.UIV2.icons.unknowChain}
                      variant='small'
                      isBorderIcon
                    />
                  </View>
                )
                : showAll
                  ? <ListChain maxShow={maxPreview} />
                  : <View style={styles.triggerIcon} />}
              <MyIcon
                uri={isVisible ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand}
                style={styles.chevron}
              />
            </View>
          </GlassView>
        </View>
      )}
    </MySelectDropdown>
  )
}

export default ChainSelectorDropdown
