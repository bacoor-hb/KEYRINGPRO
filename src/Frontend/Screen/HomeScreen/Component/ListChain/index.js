import MyIcon from 'frontend/Components/UI/MyIcon'
import React, { useMemo } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'
import createStyles from './styles'
import images from 'assets/Image'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
const DEFAULT_MAX_SHOW = 6

const ListChain = ({ maxShow = DEFAULT_MAX_SHOW, chainIdListCustom }) => {
  const { activeEvmChainIdsRedux, blockchainListRedux } = useSelector(state => state)
  const styles = createStyles()

  // Default chains first (in LIST_DEFAULT_CHAIN_ID priority order), then custom chains.
  const orderedChainIds = useMemo(() => {
    if (chainIdListCustom) {
      const active = chainIdListCustom.map(Number)
      const activeSet = new Set(active)
      const defaults = LIST_DEFAULT_CHAIN_ID.map(Number).filter(id => activeSet.has(id))
      const defaultSet = new Set(defaults)
      const others = active.filter(id => !defaultSet.has(id))
      return [...defaults, ...others]
    }
    const active = (activeEvmChainIdsRedux || []).map(Number)
    const activeSet = new Set(active)
    const defaults = LIST_DEFAULT_CHAIN_ID.map(Number).filter(id => activeSet.has(id))
    const defaultSet = new Set(defaults)
    const others = active.filter(id => !defaultSet.has(id))
    return [...defaults, ...others]
  }, [activeEvmChainIdsRedux, chainIdListCustom])

  return (
    <View className='flex flex-row flex-wrap relative'>
      {orderedChainIds.map((chainId, index) => {
        if (index < maxShow) {
          const iconChain = blockchainListRedux[chainId]?.icon
          return (
            <View key={`chain-active-${index}`} style={styles.containerIconChain}>
              <View style={styles.containerContentIconChain}>
                <MyIcon
                  uri={iconChain}
                  uriDefault={images.UIV2.icons.unknowChain}
                  variant='small'
                  style={styles.iconImage}
                  isBorderIcon
                />
              </View>
            </View>
          )
        }
        return null
      })}
      {
        orderedChainIds.length > maxShow ? (
          <View style={styles.containerIconChain}>
            <View style={styles.containerContentIconChain}>
              <MyIcon
                uri={images.UIV2.icons.moreDataCircle}
                variant='small'
                style={styles.iconImage} />
            </View>
          </View>
        ) : null
      }
    </View>
  )
}

export default ListChain
