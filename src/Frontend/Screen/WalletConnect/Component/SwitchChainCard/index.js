import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'
import { formatDate } from 'common/function'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { switchToNewChainV2, removeCallRequest, getChainNameByChain } from 'common/chain'
import { getConnectorV2, redirectBackToDapp } from 'common/walletconnect'
import BaseAPI from 'controller/API/BaseAPI'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import ChainIcon from 'frontend/Components/UI/ChainIcon'
import { getSizeImgSquare } from 'common/styles'
import createStyles from './styles'

const DEFAULT_CHAIN_ID_SET = new Set(LIST_DEFAULT_CHAIN_ID.map(Number))

// wallet_switchEthereumChain / wallet_addEthereumChain request card. "Add" directly
// adds the requested chain to the current account's session (+ the app's active list
// & blockchainListRedux), then responds to the dApp — no account/chain picker. Only
// supportable chains (default ∪ Keyring API) can be added.
const SwitchChainCard = (props) => {
  const styles = createStyles()
  const { item, accountIndex, showAlert, _this } = props

  const walletConnectRedux = useSelector((s) => s.walletConnectRedux)
  const blockchainList = useSelector((s) => s.blockchainListRedux)
  const activeEvmChainIds = useSelector((s) => s.activeEvmChainIdsRedux)

  const [apiChains, setApiChains] = useState(null)
  const [isPressingAdd, setIsPressingAdd] = useState(false)
  const [isPressingReject, setIsPressingReject] = useState(false)

  const targetChainId = Number(item?.chainId)
  const walletConnectInfo = walletConnectRedux?.[accountIndex] || {}
  const address = walletConnectInfo?.accountArrInfo?.[0]?.address || walletConnectInfo?.accountAddress

  // Only fetch the Keyring chain API when the target isn't already known locally.
  const knownInfo = blockchainList?.[targetChainId]
  const isKnownLocally = DEFAULT_CHAIN_ID_SET.has(targetChainId) || !!knownInfo

  useEffect(() => {
    if (isKnownLocally) return
    let alive = true
    BaseAPI.getBlockChainList()
      .then((res) => {
        if (!alive) return
        const map = {}
        Object.values(res || {}).forEach((c) => { if (c?.chainId) map[Number(c.chainId)] = c })
        setApiChains(map)
      })
      .catch(() => { if (alive) setApiChains({}) })
    return () => { alive = false }
  }, [isKnownLocally, targetChainId])

  const apiChainItem = apiChains?.[targetChainId]
  const chainInfo = knownInfo || apiChainItem
  // null while the API is still resolving an unknown chain.
  const isSupportable = useMemo(() => {
    if (isKnownLocally) return true
    if (apiChains === null) return null
    return !!apiChainItem
  }, [isKnownLocally, apiChains, apiChainItem])

  const chainName = chainInfo?.name || getChainNameByChain(targetChainId) || `Chain ${targetChainId}`

  const onReject = async () => {
    setIsPressingReject(true)
    await ReduxService.rejectRequestWalletConnect(item, accountIndex, null, showAlert)
    _this?.closeDrawer()
  }

  const onAdd = () => {
    if (isPressingAdd || !isSupportable || !address) return
    setIsPressingAdd(true)

    // Add the network to the wallet: active list + blockchain info (if missing).
    const nextActive = [...(activeEvmChainIds || []).map(Number)]
    if (!nextActive.includes(targetChainId)) {
      nextActive.push(targetChainId)
      ReduxService.callDispatchAction(StorageReduxAction.setActiveEvmChainIds(nextActive))
    }
    if (!blockchainList?.[targetChainId] && apiChainItem) {
      const chain = String(apiChainItem.chain || '').toLowerCase()
      const nextBlockchain = {
        ...(blockchainList || {}),
        [targetChainId]: {
          ...apiChainItem,
          chain,
          chainId: targetChainId,
          keyChain: `${chain}${targetChainId}`,
          isCustomChainData: true,
          isSupportedChain: false
        }
      }
      ReduxService.callDispatchAction(StorageReduxAction.setBlockChainList(nextBlockchain))
    }

    // Add the chain to the WC session for the current account, then respond.
    const selectedAccountArrEip155 = [`eip155:${targetChainId}:${address}`]
    const selectedAccountInfoArr = [{ address }]
    const selectedNetworkObj = { [targetChainId]: 1 }

    const callbackOnDone = async () => {
      const wcWeb3Wallet = await getConnectorV2()
      const response = { id: item.id, result: '', jsonrpc: '2.0' }
      await wcWeb3Wallet.respondSessionRequest({ topic: walletConnectInfo.topic, response })
      removeCallRequest(accountIndex, item)
      _this?.closeDrawer()
      if (walletConnectInfo.isFromDeepLink) {
        setTimeout(() => redirectBackToDapp(showAlert), 700)
      }
    }
    const callbackOnError = () => {
      setIsPressingAdd(false)
      showAlert('', '', { type: true })
    }

    switchToNewChainV2(
      accountIndex,
      selectedAccountArrEip155,
      selectedNetworkObj,
      selectedAccountInfoArr,
      [targetChainId],
      callbackOnDone,
      callbackOnError
    )
  }

  const isAddDisabled = isPressingAdd || isPressingReject || isSupportable !== true || !address

  return (
    <View style={styles.wrapper} className='border-b border-box-small'>
      <View style={styles.card} className='bg-box-secondary'>
        {/* Timestamp */}
        <MyText variant='small' className='text-low'>{formatDate(item?.params?.[0]?.createAt || item?.createAt)}</MyText>

        {/* Target chain avatar + name */}
        <View style={styles.chainRow}>
          <ChainIcon chainId={targetChainId} size={getSizeImgSquare('small')} />
          <MyText fontWeight={700}>{chainName}</MyText>
        </View>

        {/* Prompt */}
        <MyText className='text-medium'>
          {I18n.t('v2.wcConnect.addChainToWallet', { chain: chainName })}
        </MyText>

        {/* Reject / Add */}
        <View style={styles.buttons}>
          <MyButton
            size='small'
            variant='default'
            className='flex-1'
            label={I18n.t('Initial.reject')}
            onPress={onReject}
            isLoading={isPressingReject}
            isDisable={isPressingAdd || isPressingReject}
          />
          <MyButton
            size='small'
            variant='primary'
            className='flex-1'
            label={I18n.t('v2.common.add')}
            onPress={onAdd}
            isLoading={isPressingAdd}
            isDisable={isAddDisabled}
          />
        </View>
      </View>
    </View>
  )
}

export default SwitchChainCard
