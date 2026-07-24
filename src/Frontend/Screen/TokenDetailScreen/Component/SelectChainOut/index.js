import { View, TouchableOpacity, TouchableNativeFeedback, Keyboard } from 'react-native'
import React, { useEffect, useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import createStyles from './styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import BtnBack from 'frontend/Components/UI/BtnBack'
import useGetSettingExchange from 'frontend/Hooks/useGetSettingExchange'
import ListActionRow from 'frontend/Components/UI/ListActionRow'
import { ScrollView } from 'react-native-gesture-handler'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import { Colors, getSafeAreaValues, getSizeImgSquare, PADDING_TOP_CONTAINER_DRAWER } from 'common/styles'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import MyInputSearch from 'frontend/Components/UI/MyInputSearch'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import ContainerAnchor from 'frontend/Components/UI/ContainerAnchor'

const SelectChainOut = ({ handleChangeChain, handleBack, _this }) => {
  const [textSearch, setTextSearch] = useState('')
  const [textSearchDebounce, setTextSearchDebounce] = useState('')
  const [heightAnchorHeader, setHeightAnchor] = useState(0)
  const [isShowListChain, setIsShowListChain] = useState(false)

  const { data: setting, isLoading } = useGetSettingExchange()

  const styles = createStyles()

  useEffect(() => {
    setTimeout(() => {
      setIsShowListChain(true)
    }, 400)
  }, [])

  const renderChains = () => {
    const data = []

    setting.chainSupport.forEach((chain, index) => {
      if (textSearchDebounce) {
        const isHasName = chain?.name?.toLowerCase()?.includes(textSearchDebounce.toLowerCase())
        const isHashChainId = chain?.chainId?.toString()?.includes(textSearchDebounce)
        if (!isHasName && !isHashChainId) {
          return
        }
      }
      data.push({
        chainId: Number(chain?.chainId?.toString()),
        onPress: () => handleChangeChain(chain),
        title: chain?.name || chain?.displayName,
        leftElement: (
          <View style={{ width: getSizeImgSquare('large'), height: getSizeImgSquare('large') }} className='items-center justify-center'>
            <MyIcon uri={chain?.iconUrl || chain.icon || images.UIV2.icons.unknowChain} isBorderIcon />
          </View>
        )
      })
    })

    data.sort((a, b) => {
      const indexA = LIST_DEFAULT_CHAIN_ID.indexOf(a.chainId)
      const indexB = LIST_DEFAULT_CHAIN_ID.indexOf(b.chainId)

      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB
      }

      if (indexA !== -1) return -1

      if (indexB !== -1) return 1

      return 0
    })
    return <ListActionRow data={data} />
  }

  return (
    <TouchableNativeFeedback onPress={Keyboard.dismiss}>
      <MyViewPage style={styles.container}>

        <ContainerAnchor fallbackColor={Colors.BG_MAIN_DRAWER} onSetHeightContainer={setHeightAnchor}>
          <View>
            <TitleDrawer
              title={I18n.t('v2.selectChain.title')}
              leftIcon={(<BtnBack onPress={handleBack} />)}
            />
            <MyInputSearch
              value={textSearch}
              onChangeText={e => {
                setTextSearch(e)
                if (!e) {
                  setTextSearchDebounce('')
                }
              }}
              returnKeyType='search'
              onSubmitEditing={() => setTextSearchDebounce(textSearch)}
              placeholder={I18n.t('v2.selectChain.searchPlaceholder')}
              rightIcon={(
                <TouchableOpacity onPress={() => setTextSearchDebounce(textSearch)} activeOpacity={1}>
                  <MyIcon uri={images.UIV2.icons.search} variant='small' />
                </TouchableOpacity>
              )}
            />
          </View>

        </ContainerAnchor>
        <View style={{ height: PADDING_TOP_CONTAINER_DRAWER }} />
        {
          isShowListChain && (

            <ScrollView contentContainerStyle={{ paddingTop: heightAnchorHeader - PADDING_TOP_CONTAINER_DRAWER, paddingBottom: getSafeAreaValues().bottom }} showsVerticalScrollIndicator={false}>
              {
                isLoading && (
                  <View className='flex items-center justify-center'>
                    <MyDotsLoading variant='large' />
                  </View>
                )
              }
              {
                setting?.chainSupport && !isLoading && renderChains()
              }

            </ScrollView>
          )
        }
      </MyViewPage>
    </TouchableNativeFeedback>

  )
}

export default SelectChainOut
