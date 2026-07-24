/* eslint-disable eqeqeq */
import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import {
  convertAddressArrToString,
  keyExtractor,
  getDotColorFromAddress,
  importPrivateKey,
  sleep
} from 'common/function'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { connect } from 'react-redux'
import Emptydata from 'frontend/Components/Common/EmptyData'
import { Colors, height } from 'common/styles'
import { MODE_THEME } from 'common/constants/app'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { FlatList } from 'react-native-gesture-handler'
import { Icon } from 'frontend/Components/Common/Icon'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { bindActionCreators } from 'redux'
import BaseAPI from 'controller/API/BaseAPI'
import { chainType } from 'common/constants/chain'
import { Spinner } from 'frontend/Components/Common'
import ModalImport from './ModalImport'
import AvatarWithChain from 'frontend/Components/Common/AddressBook/AvatarWithChain'
import { NavigationActions } from 'src/navigation/NavigationService'
import { getPrivateKeyByAddress } from 'common/wallet'

const defaultContext = {
  modeTheme: MODE_THEME.LIGHT_MODE,
  styleTheme: {
    backgroundColor: Colors.WHITE,
    color: Colors.TEXT
  }
}

const AddChainPopup = props => {
  const {
    dataNewChain,
    blockchainListRedux,
    accountListRedux,
    closeModal,
    setBlockChainList,
    showAlert,
    onReject,
    _this
  } = props

  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingListAccount, setIsLoadingListAccount] = useState(true)
  const [accountList, setAccountList] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [existAddressWithChainId, setExistAddressWithChainId] = useState('')

  useEffect(() => {
    try {
      setIsLoadingListAccount(true)
      let accountListTemp = []
      let existAddressWithChainIdString = ''

      accountListTemp = accountListRedux.filter((accountItem, accountItemIndex) => {
        if (Number(accountItem.chainId) === Number(dataNewChain.chainid)) {
          existAddressWithChainIdString = existAddressWithChainIdString + '-' + accountItem.address + '-'
        }
        return (
          accountItem.status &&
          accountItem.keyChain !== 'btc98' &&
          accountItem.keyChain !== 'btc99' &&
          accountItem.chain !== chainType.btc &&
          accountItem.chain !== chainType.solana
        )
      })

      setExistAddressWithChainId(existAddressWithChainIdString)
      setAccountList(accountListTemp)
      setSelectedAccount(accountListTemp[0])
    } catch (e) {
      rejectSession()
    } finally {
      setIsLoadingListAccount(false)
    }
  }, [])

  const onHandleRouteCreateScreenWithChain = async () => {
    const isExistBlockChain = blockchainListRedux[dataNewChain.chainid]
    const chainInfo = await BaseAPI.getBlockChainWithChainId(dataNewChain.chainid)
    let blockchainListReduxFinal = {}
    if (!chainInfo?.chainId && !isExistBlockChain) {
      const explorerUrl = dataNewChain?.explorer?.toLowerCase()?.trim() ?? ''

      const chainInfoInit = {
        nativeCurrency: {
          name: dataNewChain.symbol,
          symbol: dataNewChain.symbol,
          decimals: Number(dataNewChain.decimal),
          coinGeckoId: ''
        },
        isCustomChainData: true,
        chain: `${dataNewChain.chainid}`.toLowerCase().trim(),
        keyChain: `${dataNewChain.chainid + dataNewChain.chainid}`.toLowerCase().trim(),
        isSupportedChain: false,
        status: false,
        chainId: dataNewChain.chainid,
        name: dataNewChain.name,
        explorer: explorerUrl,
        icon: '',
        linkProvider: dataNewChain.rpc.toLowerCase().trim(),
        linkScanTokenHolding: explorerUrl !== '' ? `${explorerUrl}/address/` : '',
        linkScan: explorerUrl !== '' ? `${explorerUrl}/address/` : '',
        linkScanHash: explorerUrl !== '' ? `${explorerUrl}/tx/` : ''
      }

      blockchainListReduxFinal = { ...blockchainListRedux, [dataNewChain.chainid]: chainInfoInit }
      setBlockChainList(blockchainListReduxFinal)
    } else if (chainInfo?.chainId && !isExistBlockChain) {
      const chainInfoInit = {
        nativeCurrency: {
          name: dataNewChain.symbol,
          symbol: dataNewChain.symbol,
          decimals: Number(dataNewChain.decimal),
          coinGeckoId: '',
          ...chainInfo.nativeCurrency
        },
        isCustomChainData: false,
        chain: `${chainInfo.chain}`.toLowerCase().trim(),
        keyChain: `${chainInfo.chain + chainInfo.chainId}`.toLowerCase().trim(),
        isSupportedChain: false,
        status: false,
        chainId: chainInfo.chainId || dataNewChain.chainid,
        name: chainInfo.name || dataNewChain.name || 'Keyring',
        explorer: chainInfo.explorer || dataNewChain.explorer.toLowerCase().trim() || '',
        icon: chainInfo.icon,
        linkProvider: chainInfo.linkProvider,
        linkScanTokenHolding: chainInfo.linkScanTokenHolding || '',
        linkScan: chainInfo.linkScan || '',
        linkScanHash: chainInfo.linkScanHash || ''
      }

      blockchainListReduxFinal = { ...blockchainListRedux, [dataNewChain.chainid]: chainInfoInit }
      setBlockChainList(blockchainListReduxFinal)
    }

    NavigationActions.navigate('addAccount')
  }

  const onHandleCreateAccountWithChain = async () => {
    const isDisable = existAddressWithChainId ? existAddressWithChainId.includes(selectedAccount.address) : false

    const isExistBlockChain = blockchainListRedux[`${dataNewChain.chainid}`]

    let isShouldAddNewNetwork = false
    let blockchainListReduxFinal = {}

    if (selectedAccount && !isDisable) {
      setIsLoading(true)
      await sleep(300)
      const chainInfo = await BaseAPI.getBlockChainWithChainId(dataNewChain.chainid)
      const icon = ''

      if (isExistBlockChain) {
        // Chain already known — nothing to add.
      } else if (!chainInfo?.chainId) {
        isShouldAddNewNetwork = true

        const chainInfoInit = {
          nativeCurrency: {
            name: dataNewChain.symbol,
            symbol: dataNewChain.symbol,
            decimals: Number(dataNewChain.decimal),
            coinGeckoId: ''
          },
          isCustomChainData: true, // now, we dont have any this network's information, it must be custom chain.
          chain: `${dataNewChain.chainid}`.toLowerCase(),
          keyChain: `${dataNewChain.chainid + dataNewChain.chainid}`.toLowerCase().trim(),
          isSupportedChain: false,
          status: false,
          chainId: dataNewChain.chainid,
          name: dataNewChain.name,
          explorer: dataNewChain.explorer.toLowerCase().trim(),
          icon: icon,
          linkProvider: dataNewChain.rpc.toLowerCase().trim(),
          linkScanTokenHolding: '',
          linkScan: '',
          linkScanHash: ''
        }

        blockchainListReduxFinal = { ...blockchainListRedux, [dataNewChain.chainid]: chainInfoInit }
      } else {
        isShouldAddNewNetwork = true

        const chainInfoInit = {
          nativeCurrency: {
            name: dataNewChain.symbol,
            symbol: dataNewChain.symbol,
            decimals: Number(dataNewChain.decimal),
            coinGeckoId: '',
            ...chainInfo.nativeCurrency // we can get real coinGeckoId here
          },
          isCustomChainData: false, // because we have already network's information, this is not custom chain data.
          chain: `${chainInfo.chain}`.toLowerCase().trim(), // we have network's information, so we have exactly name of chain, dont use chainId here anymore
          keyChain: `${chainInfo.chain + chainInfo.chainId}`.toLowerCase().trim(), // chain + chainId please
          isSupportedChain: false,
          status: false,
          chainId: chainInfo.chainId || dataNewChain.chainid,
          name: chainInfo.name || dataNewChain.name || 'Keyring',
          explorer: chainInfo.explorer || dataNewChain.explorer.toLowerCase().trim() || '',
          icon: chainInfo.icon,
          linkProvider: chainInfo.linkProvider,
          linkScanTokenHolding: chainInfo.linkScanTokenHolding || '',
          linkScan: chainInfo.linkScan || '',
          linkScanHash: chainInfo.linkScanHash || ''
        }

        blockchainListReduxFinal = { ...blockchainListRedux, [dataNewChain.chainid]: chainInfoInit }
      }

      let newWalletData
      let privateKey

      if (selectedAccount && selectedAccount.isFromKeyCard) {
        privateKey = await _this.nfcProxy.getPrivateKeyFromNFC(selectedAccount.address, selectedAccount.passwordFile)

        newWalletData = await importPrivateKey(
          privateKey,
          '',
          true,
          selectedAccount.passwordFile,
          selectedAccount.passwordFileEncode,
          selectedAccount.address
        )
      } else {
        const privateKey = getPrivateKeyByAddress(selectedAccount.address)
        newWalletData = await importPrivateKey(
          privateKey,
          '',
          false
        )
      }

      if (newWalletData) {
        if (isShouldAddNewNetwork) {
          setBlockChainList(blockchainListReduxFinal)
        }

        if (_this.setResetData) {
          _this.setResetData()
        } else {
          _this.popup = (
            <ModalImport
              closeModal={_this.closeModal}
            />
          )
          _this.popsitionPopup = 'center'
          _this.swipeToClose = false
          _this.openModal()
        }
      } else {
        setIsLoading(false)
        showAlert(I18n.t('Error.errPrivateKey'), '', { type: true })
      }
    }
  }

  const rejectSession = () => {
    closeModal()
    setTimeout(() => {
      if (onReject) {
        onReject()
      } else {
        NavigationActions.navigate('home')
      }
    }, 100)
  }

  const onHandleChooseAccount = (selectedAccountData, chainItemPosition) => () => {
    if (selectedAccountData === selectedAccount) {
      // setSelectedAccount(null)
    } else {
      setSelectedAccount(selectedAccountData)
    }
  }

  const renderAccountList = ({ item, index }) => {
    const isLastItem = index === accountList.length - 1
    const isChecked = (selectedAccount && selectedAccount?.address.length > 0 && item.address === selectedAccount.address) || (!selectedAccount && index === 0)
    const isDisable = existAddressWithChainId.includes(item.address)
    const addressDotColor = getDotColorFromAddress(item?.address)

    return (
      <ThemeContext.Consumer>{(context = defaultContext) => {
        return (
          <TouchableOpacity disabled={isDisable} activeOpacity={1} onPress={onHandleChooseAccount(item, index)} style={[styles[`userBox${context.modeTheme}`], isLastItem && { marginBottom: height(0.5) }, isDisable && { opacity: 0.4 }]}>
            {
              isChecked && !isDisable
                ? <Icon name='checkmark-circle' style={styles.checkedStyle} /> : null
            }
            <View style={styles.leftUserBox}>
              {/* <ImageRender resizeMode='contain' uriDefault={images.ethereum} uri={imgToken} style={styles.tokenIcon} /> */}
              <AvatarWithChain
                key={`${item.chainId || item.chain}-${item.address}`}
                chainId={item.chainId}
                chainType={item.chain}
                address={item.address} />
            </View>

            <View style={styles.rightUserBox}>
              <Text numberOfLines={1} style={[styles.rightUserName, { color: context.styleTheme.color }]}>{item?.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.addressDotColor, { backgroundColor: addressDotColor }]} />
                <Text style={styles[`rightUserAddress${context.modeTheme}`]}>{item && item.address ? convertAddressArrToString([item?.address]) : ''}</Text>
              </View>
            </View>
            {
              item && item.isFromKeyCard && (
                <View style={styles.nfcIconBox}>
                  <ImageRender resizeMode='contain' uriDefault={images.nfcIcon} uri={images.nfcIcon} style={styles.nfcIcon} />
                </View>
              )
            }
          </TouchableOpacity>
        )
      }}
      </ThemeContext.Consumer>
    )
  }

  return (
    <ThemeContext.Consumer>{({ modeTheme, styleTheme }) => {
      const isDisableCreate = !selectedAccount || isLoading
      return (
        <View style={[styles.container, styles[`container${modeTheme}`]]}>
          <Text style={styles[`titleConnect${modeTheme}`]}>{I18n.t('v2.common.add')} {dataNewChain.name}</Text>
          <Text style={styles[`chainIdTxt${modeTheme}`]}>ChainID: {dataNewChain.chainid}</Text>
          <Text style={styles[`subTitleConnectWithThisSite${modeTheme}`]}>{I18n.t('Initial.selectAddress')}</Text>
          <ScrollView
            keyboardShouldPersistTaps='always'
            showsVerticalScrollIndicator={false}
            style={styles.listCoinContainer}
          >
            <FlatList
              ListEmptyComponent={(
                <Emptydata
                  isLoading={isLoadingListAccount}
                  label={I18n.t('WalletConnect.noChainPleaseCreate')}
                  styleLabel={styles[`label${modeTheme}`]}
                  image={(
                    <ImageRender
                      uri={images[`informationIcon${modeTheme}`]}
                      style={styles.informationIcon}
                      resizeMode='contain' />
                  )}
                  style={[styles.listCoinContainer]}
                />
              )}
              scrollEnabled={false}
              data={accountList}
              keyExtractor={keyExtractor}
              renderItem={renderAccountList}
            />
          </ScrollView>

          <TouchableOpacity style={styles.newAddressBox} onPress={onHandleRouteCreateScreenWithChain}>
            <Text style={styles.newAddressTxt}>{I18n.t('Initial.newAddress')}</Text>
          </TouchableOpacity>
          <View style={styles.bottomBox}>
            <TouchableOpacity activeOpacity={0.8} disabled={isLoading} onPress={rejectSession} style={[styles.buttonRejectBox, { opacity: isLoading ? 0.7 : 1 }]}>
              <Text style={[styles.textReject, { color: styleTheme.color }]}>{I18n.t('Initial.reject')}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={1} disabled={isDisableCreate || isLoading} style={[styles.buttonConnectBox, { opacity: (isDisableCreate || isLoading) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }]} onPress={onHandleCreateAccountWithChain}>
              <Spinner style={{ position: 'absolute', opacity: isLoading ? 1 : 0 }} size={height(2.7)} type='Wave' color={Colors.TEXT} />
              <Text style={[styles.textConnect, { opacity: isLoading ? 0 : 1 }]}>{I18n.t('Initial.create')}</Text>
            </TouchableOpacity>
          </View>
        </View>

      )
    }}
    </ThemeContext.Consumer>
  )
}

const mapStateToProps = (state) => ({
  accountListRedux: state.accountListRedux,
  blockchainListRedux: state.blockchainListRedux
})

const mapDispatchToProps = (dispatch) => {
  return {
    setAccountList: bindActionCreators(StorageReduxAction.setAccountList, dispatch),
    setBlockChainList: bindActionCreators(StorageReduxAction.setBlockChainList, dispatch)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(AddChainPopup)
