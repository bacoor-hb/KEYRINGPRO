import { View, KeyboardAvoidingView } from 'react-native'
import I18n from 'assets/Lang'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import MyButton from 'frontend/Components/UI/MyButton'
import MyText from 'frontend/Components/UI/MyText'
import MySelectDropdown from 'frontend/Components/UI/MySelectDropdown'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyInput from 'frontend/Components/UI/MyInput'
import createStyles from './styles'
import { useDispatch, useSelector } from 'react-redux'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import { cloneData, handleOpenUrl } from 'common/function'
import { Colors, getSizeImgSquare, pixelByHeight } from 'common/styles'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { KeyboardAwareScrollView } from '@codler/react-native-keyboard-aware-scroll-view'

const CHAINLIST_URL = 'https://chainlist.org'

const CustomRpc = ({ _this }) => {
  const styles = createStyles()
  const dispatch = useDispatch()
  const scrollRef = useRef(null)
  const { blockchainListRedux, activeEvmChainIdsRedux } = useSelector(s => s)
  const [chainSelected, setChainSelected] = useState(null)
  const [rpcCustom, setRpcCustom] = useState('')
  const [rpcCustomHistory, setRpcCustomHistory] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isChangeText, setIsChangeText] = useState(false)

  // Active EVM chains, ordered by LIST_DEFAULT_CHAIN_ID (defaults first, custom last).
  const chainData = useMemo(() => {
    const data = Object.values(blockchainListRedux || {})
      .filter(item => activeEvmChainIdsRedux.find(e => e === item.chainId))

    return data.sort((a, b) => {
      const indexA = LIST_DEFAULT_CHAIN_ID.indexOf(a.chainId)
      const indexB = LIST_DEFAULT_CHAIN_ID.indexOf(b.chainId)

      if (indexA !== -1 && indexB !== -1) return indexA - indexB
      if (indexA !== -1) return -1
      if (indexB !== -1) return 1
      return 0
    })
  }, [activeEvmChainIdsRedux, blockchainListRedux])

  // Default the selection to the first chain once the list is ready.
  useEffect(() => {
    if (!chainSelected && chainData[0]) {
      setChainSelected(chainData[0])
    }
  }, [chainData, chainSelected])

  // Pull the custom RPC field from the filtered chainData entry of the selected chain.
  useEffect(() => {
    setRpcCustomHistory(chainSelected?.rpcCustom || '')
    setRpcCustom(chainSelected?.rpcCustom || '')
  }, [chainSelected])

  const errorRpc = useMemo(() => {
    if (!rpcCustom) {
      return I18n.t('v2.customRpc.requiredUrl')
    }
    const isHttp = rpcCustom?.startsWith('http')
    if (!isHttp) {
      return I18n.t('v2.customRpc.invalidUrl')
    }

    if (rpcCustomHistory && rpcCustom === rpcCustomHistory) {
      return I18n.t('v2.customRpc.alreadyUsing')
    }

    return ''
  }, [rpcCustom, rpcCustomHistory])

  const disableSave = useMemo(() => {
    if (errorRpc) {
      return true
    }
    if (rpcCustomHistory && rpcCustom === rpcCustomHistory) {
      return true
    }
    if (!rpcCustom) {
      return true
    }
    return false
  }, [rpcCustomHistory, rpcCustom, errorRpc])

  const checkIsValidRpc = async () => {
    const payload = {
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1
    }

    try {
      const response = await fetch(rpcCustom, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      const chainIdHex = data.result
      let chainIdDecimal

      if (chainIdHex?.startsWith('0x')) {
        chainIdDecimal = parseInt(chainIdHex, 16)
      } else {
        chainIdDecimal = chainIdHex
      }

      if (chainIdDecimal?.toString() === chainSelected?.chainId?.toString()) {
        return true
      }
      return false
    } catch (error) {
      return false
    }
  }

  // Submit handlers — intentionally left empty (wired up later).
  const handleSave = async () => {
    try {
      setIsLoading(true)
      const isValid = await checkIsValidRpc()
      if (isValid) {
        await _this.closeDrawer()
        const blockchainClone = cloneData(blockchainListRedux)
        blockchainClone[chainSelected?.chainId].rpcCustom = rpcCustom.trim()
        dispatch(StorageReduxAction.setBlockChainList(blockchainClone))
        _this.showAlert(I18n.t('v2.customRpc.savedSuccess'))
      } else {
        _this.showAlert(I18n.t('v2.customRpc.rpcNoMatchChain'), '', { type: 'error' })
      }
    } catch (error) {
      _this.showAlert(I18n.t('v2.customRpc.rpcNoMatchChain'), '', { type: 'error' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestoreDefault = () => {
    _this.closeDrawer()
    setTimeout(() => {
      const blockchainClone = cloneData(blockchainListRedux)
      delete blockchainClone[chainSelected?.chainId].rpcCustom
      dispatch(StorageReduxAction.setBlockChainList(blockchainClone))
      _this.showAlert(I18n.t('v2.customRpc.restoredSuccess'))
    }, 300)
  }

  const onChangeTex = (value) => {
    if (!isChangeText) {
      setIsChangeText(true)
    }
    value = value.trim()
    value = value.replaceAll('\n', '')
    setRpcCustom(value)
  }

  const renderItemChain = (chain, index) => {
    const isLastItem = index === chainData.length - 1
    return (
      <MyRowItem
        noPadding
        noBorder={isLastItem}
        lefIcon={(
          <View style={{ alignItems: 'center', width: getSizeImgSquare('large') }}>
            <MyIcon uriDefault={images.UIV2.icons.unknowChain} variant='small' isBorderIcon uri={chain?.icon || chain?.iconUrl} />
          </View>

        )}
      >
        <MyTextTicker>{chain?.name || chain?.displayName}</MyTextTicker>
      </MyRowItem>
    )
  }

  return (
    <MyViewPage isUseDrawer style={[styles.container]}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('v2.customRpc.title')}
        leftIcon={images.UIV2.icons.settings.customRPC}
        rightElement={(
          <MyButton isLoading={isLoading} isDisable={disableSave} disableLiquidGlass size='small' label={I18n.t('Initial.save')} onPress={handleSave} />
        )}
      />
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={50}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={styles.containerContent}
      >

        <View style={{ gap: pixelByHeight(14) }}>
          <MyText variant='subTitle' fontWeight={700}>
            {I18n.t('WalletConnect.selectNetwork')}
          </MyText>

          <MySelectDropdown
            dropdownStyle={{
              paddingHorizontal: 0
            }}
            data={chainData}
            renderItem={renderItemChain}
            onSelect={(item) => setChainSelected(item)}
          >
            {(_selectedItem, isVisible) => (

              <View style={styles.containerNetworkCurrent}>
                <View style={{ alignItems: 'center', width: getSizeImgSquare('large') }}>
                  <MyIcon variant='small' isBorderIcon uri={chainSelected?.icon} />
                </View>

                <View style={{ flex: 1 }}>
                  <MyTextTicker>{chainSelected?.name || chainSelected?.displayName}</MyTextTicker>
                </View>
                <MyIcon variant='small' uri={isVisible ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand} />
              </View>
            )}
          </MySelectDropdown>

          <MyText className='text-medium'>
            {I18n.t('v2.customRpc.enterUrlsDesc')}{' '}
            <MyText
              className=' text-medium underline'
              onPress={() => handleOpenUrl(CHAINLIST_URL)}
            >
              Chainlist
            </MyText>{' '}
            {I18n.t('v2.customRpc.orProvider')}
          </MyText>

          <KeyboardAvoidingView
            behavior={ISIOS ? 'padding' : 'height'}
          >
            <MyInput
              ref={scrollRef}
              isDisable={isLoading}
              variant='base'
              multiline
              numberOfLines={6}
              typeInput='area'
              value={rpcCustom}
              onChangeText={onChangeTex}
              onFocus={(event) => {
                if (scrollRef.current) {
                  try {
                    setTimeout(() => {
                      if (scrollRef.current) {
                        try {
                          // Approach 1: Scroll straight to the end of ScrollView (input is at the bottom)
                          // Fallback: if scrollToEnd is unavailable, use scrollTo from the root ScrollView
                          if (typeof scrollRef.current.scrollToEnd === 'function') {
                            scrollRef.current.scrollToEnd({ animated: true })
                          } else if (scrollRef.current.getScrollResponder) {
                            scrollRef.current.getScrollResponder().scrollToEnd({ animated: true })
                          }
                        } catch (error) {
                          // console.log('Scroll error:', error)
                        }
                      }
                    }, 100)
                  } catch (error) {
                    // console.log({ error })
                  }
                }
              }}
              noBorder
              noErrorSpace
              placeholder={I18n.t('v2.customRpc.example')}
              containerConfig={{ style: styles.rpcBox }}
              inputWrapperConfig={{ style: styles.rpcInputWrapper }}
              inputConfig={{ style: styles.rpcInput }}
            />
            <MyText variant='small' className={errorRpc && isChangeText ? 'text-red' : 'opacity-0'}>
              {errorRpc || I18n.t('v2.customRpc.noError')}
            </MyText>
          </KeyboardAvoidingView>

          <MyButton
            style={{
              backgroundColor: Colors.BG_INPUT_FIELD
            }}
            isDisable={isLoading || !rpcCustomHistory}
            disableLiquidGlass
            className='w-full'
            onPress={handleRestoreDefault}>
            <MyText>
              {I18n.t('v2.customRpc.restoreDefault')}
            </MyText>
          </MyButton>
        </View>
      </KeyboardAwareScrollView>
    </MyViewPage>
  )
}

export default CustomRpc
