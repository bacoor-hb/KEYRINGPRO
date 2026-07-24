import React, { useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import LottieView from 'lottie-react-native'
import { NFT_TYPE_MAP } from 'common/constants/app'
import {
  convertAddressArrToString,
  debugInfo,
  formatDate,
  formatJsonRpcErrorForWalletConnectV2,
  isObject,
  lowerCase,
  removeSensitiveKeysFromString
} from 'common/function'
import ReduxService from 'common/redux'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import I18n from 'assets/Lang'
import AllChainServices from 'controller/AllChainServices'
import { formatJsonRpcResult } from '@json-rpc-tools/utils'
import { getConnectorV2, redirectBackToDapp } from 'common/walletconnect'
import useGetNameFunctionDecoded from 'frontend/Hooks/useGetNameFunctionDecoded'
import { getPrivateKeyByAddress, isAccountFromKeyCard, remove0xFromPrivateKey } from 'common/wallet'
// No re-auth before signing for now: the user already authenticated at app
// unlock this session, so an extra prompt here is redundant. Whether to require
// re-auth per signature is still TBD — re-enable with the gate in approveMethod.
// import { requestReauth } from 'common/secureVault'
import { encodeFunctionData, parseUnits, decodeFunctionData } from 'viem'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import ChainIcon from 'frontend/Components/UI/ChainIcon'
import EditSpendingCapDrawer from '../EditSpendingCapDrawer'
import createStyles from './styles'
import { getHeightHeader, getHeightScreen } from 'common/styles'

// New-design WalletConnect request card. The approve/reject/confirm-tx LOGIC is
// copied verbatim from manageRequestScreenV2's CallRequestBox (kept intact);
// only the UI is rebuilt to the new design. Used by WalletConnectRequestsModal.
const RequestCard = (props) => {
  const styles = createStyles()
  const [isPressingConfirm, setIsPressingConfirm] = useState(false)
  const [isPressingReject, setIsPressingReject] = useState(false)
  const {
    item,
    setCurrentCallRequest,
    currentCallRequestRedux,
    percentGasPrice = 1,
    accountIndex,
    isWalletConnectV2,
    callRequestRedux,
    walletConnectRedux,
    showAlert,
    closeModalProps,
    _this
  } = props

  const [customApproveAmount, setCustomApproveAmount] = useState('')

  const chainIdFromChain = Number(item.chainId)

  const { decodedTxData, isLoading: isLoadingDecodeDataData, isApproveLikely, isLoadingApproveTokenInfo, requestMethodName, requestMethodNameWithLabel, approveTokenInfo } = useGetNameFunctionDecoded(item)

  const isConfirmApprove = item?.params?.[0]?.information?.type === 'CONFIRM_APPROVE' || requestMethodName === 'APPROVE'

  const isDisableConfirmButton = isPressingConfirm || isPressingReject || currentCallRequestRedux

  const onHandleShowInfoReqest = () => {
    _this.onHandleShowInfoReqest({ ...item, ...(decodedTxData ?? {}), contractMethodName: decodedTxData?.method })
  }

  const onHandleRejectRequest = () => {
    setIsPressingReject(true)
    ReduxService.rejectRequestWalletConnect(item, accountIndex, null, showAlert)
  }

  const approveEip155RequestWCv2 = async (payload, accountIndex, isNeedSignTxOnly = false) => {
    const callRequestReduxTemp = callRequestRedux.slice()
    const walletConnectReduxTemp = walletConnectRedux.slice()

    const handleRedirectBackToDapp = () => {
      if (walletConnectRedux[accountIndex].isFromDeepLink) {
        redirectBackToDapp(showAlert)
      }
    }

    const txParams = payload?.params?.[0] || {}

    // Modify data if custom approve amount is provided
    let modifiedData = txParams?.data || '0x'
    if (isConfirmApprove && customApproveAmount && approveTokenInfo?.decimals) {
      try {
        // Decode data to get spender address and original amount
        const decoded = decodeFunctionData({
          abi: [{
            name: 'approve',
            type: 'function',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ]
          }],
          data: txParams?.data
        })

        const spenderAddress = decoded.args[0] // Spender address
        const customAmountInWei = parseUnits(customApproveAmount, approveTokenInfo.decimals)

        // Encode again with custom amount
        modifiedData = encodeFunctionData({
          abi: [{
            name: 'approve',
            type: 'function',
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ]
          }],
          functionName: 'approve',
          args: [spenderAddress, customAmountInWei]
        })
      } catch (error) {
        debugInfo('Error encoding custom approve amount:', error)
      }
    }

    const payloadFinal = {
      to: txParams.to,
      nonce: txParams.nonce,
      gasLimit: txParams.gasLimit,
      gasPrice: txParams.gasPrice,
      data: modifiedData
    }
    if (payload.chainId) {
      payloadFinal.chainId = payload.chainId
    }

    if (percentGasPrice && percentGasPrice[0]) {
      payloadFinal.percent = percentGasPrice[0]
    }

    if (txParams && txParams.value) {
      payloadFinal.value = txParams.value
    }

    const nameSpaceNetworkWithAddress = `eip155:${payload.chainId}:${txParams.from}`

    let accountInfo
    const accountArrInfo = walletConnectRedux?.[accountIndex]?.accountArrInfo
    const accountArr = walletConnectRedux?.[accountIndex]?.accountArr
    if (accountArrInfo && accountArr) {
      let accountIndex = accountArr.indexOf(nameSpaceNetworkWithAddress)
      if (accountIndex === -1) {
        accountIndex = accountArr.indexOf(lowerCase(nameSpaceNetworkWithAddress))
      }
      accountInfo = accountArrInfo?.[accountIndex]
    }

    // This account from the request is not selected for walletconnect
    // => Need to select account for connect first
    if (!accountInfo) {
      setIsPressingConfirm(false)
      return
    }

    try {
      if (walletConnectRedux?.[accountIndex]?.connector) {
        let privateKey = getPrivateKeyByAddress(accountInfo?.address)
        const address = accountInfo?.address || ''
        if (isAccountFromKeyCard(address)) {
          privateKey = await _this.nfcProxy.getPrivateKeyFromNFC(address)
        }

        if (!privateKey) {
          setIsPressingConfirm(false)
          return
        }
        setIsPressingConfirm(true)
        const result = await AllChainServices.signTransaction(remove0xFromPrivateKey(privateKey), payloadFinal, false, chainIdFromChain, isNeedSignTxOnly)
        if (result) {
          const response = formatJsonRpcResult(payload.id, result)
          const connectorV2 = await getConnectorV2()

          await connectorV2.respondSessionRequest({ topic: payload.topic, response })

          walletConnectReduxTemp[accountIndex].historyCallRequest = [
            {
              time: new Date(),
              hash: result,
              chainId: chainIdFromChain,
              methodName: requestMethodName,
              isPinned: false,
              approver: address,
              payload: item
            },
            ...(walletConnectReduxTemp[accountIndex]?.historyCallRequest || [])
          ].slice(0, 5)
          ReduxService.callDispatchAction(StorageReduxAction.setWalletConnect(walletConnectReduxTemp))
        }

        callRequestReduxTemp[accountIndex] = callRequestRedux[accountIndex].filter(item => { return item.id !== payload.id })
        ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestReduxTemp))
        ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
        handleRedirectBackToDapp()
      }
    } catch (_error) {
      debugInfo('approveRequestWalletConnectV2 - error', _error?.message)

      setIsPressingConfirm(false)
      if ((_error?.message || '').includes('insufficient funds')) {
        showAlert(I18n.t('Content.notEnoughBalance'), '', { type: 'toast', callback: handleRedirectBackToDapp, timeout: 4000 })
      } else {
        showAlert(_error?.message ? removeSensitiveKeysFromString(_error?.message) : I18n.t('v2.walletConnect.failedOrRejected'), '', { type: 'toast', callback: handleRedirectBackToDapp, timeout: 4000 })
      }

      try {
        if (walletConnectRedux?.[accountIndex]?.connector) {
          const response = formatJsonRpcErrorForWalletConnectV2(payload, _error?.message)
          const connectorV2 = await getConnectorV2()
          await connectorV2.respondSessionRequest({ topic: payload.topic, response })
          callRequestReduxTemp[accountIndex] = callRequestRedux[accountIndex].filter(item => { return item.id !== payload.id })
          ReduxService.callDispatchAction(StorageReduxAction.setCallRequest(callRequestReduxTemp))
          ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
        }
      } catch (error) {
        // case can't send response error to dapp
        // => do nothing
      }
    }
  }

  const approveMethod = async () => {
    // Approve without re-auth for now — app unlock already authenticated the
    // user this session. If we later decide to require re-auth before each
    // approval, uncomment the two lines below and the requestReauth import.
    // const ok = await requestReauth()
    // if (!ok) return
    setIsPressingConfirm(true)
    if (isWalletConnectV2) {
      switch (item.method) {
        case 'eth_sendTransaction':
        case 'eth_signTransaction':
          if (NFT_TYPE_MAP?.[item.params[0]?.type]) {
            ReduxService.processCustomRequestWalletConnect(item, accountIndex, showAlert, closeModalProps)
          } else {
            const isNeedSignTxOnly = item.method === 'eth_signTransaction'
            approveEip155RequestWCv2(item, accountIndex, isNeedSignTxOnly)
          }
          break
        default:
          ReduxService.rejectRequestWalletConnect(item, accountIndex, null, showAlert)
          setCurrentCallRequest(true)
          break
      }
    }

    setCurrentCallRequest(false)
  }

  const handleOpenModalEditApproveAmount = () => {
    // Stacks ON TOP of the open request/dApp-info drawer (addDrawer:true) so it
    // doesn't replace it and RequestCard stays mounted underneath (its
    // customApproveAmount state persists when this drawer pops via closeDrawer).
    _this.openDrawer({
      heightDrawer: getHeightScreen() - getHeightHeader(true),
      addDrawer: true,
      children: (
        <EditSpendingCapDrawer
          chainTypeOrChainId={item?.chainId}
          tokenAddress={item?.params[0]?.to}
          tokenDecimals={approveTokenInfo?.decimals}
          tokenSymbol={approveTokenInfo?.symbol}
          userAddress={item?.params[0]?.from}
          onChangeApproveAmount={(newApproveAmount) => { setCustomApproveAmount(newApproveAmount) }}
          onClose={() => { _this.closeDrawer() }}
        />
      )
    })
  }

  const showSpendingCap = isConfirmApprove && isObject(approveTokenInfo, true) && approveTokenInfo?.symbol

  return (
    <View style={styles.wrapper} className='border-b border-box-small'>
      <View style={styles.card} className='bg-box-secondary'>
        {/* Header: timestamp + info (?) then the connected chain + account address */}
        <View style={styles.header}>
          <View style={styles.rowBetween}>
            <MyText variant='small' className='text-low'>{formatDate(item?.params?.[0]?.createAt || item?.createAt)}</MyText>
            <TouchableOpacity disabled={isLoadingDecodeDataData} onPress={onHandleShowInfoReqest}>
              <MyIcon uri={images.UIV2.icons.information} style={styles.icon18} resizeMode='contain' />
            </TouchableOpacity>
          </View>
          <View style={styles.accountRow}>
            <ChainIcon chainId={item?.chainId} />
            <MyText numberOfLines={1}>{convertAddressArrToString([item?.addressAccount], 6, 6)}</MyText>
          </View>
        </View>

        {/* Body: method name (+ spending cap & editable amount for approve) */}
        <View style={styles.body}>
          {
            // For an approve, keep the loading row until the spending-cap token
            // info is ready, so the method name and the spending cap appear in the
            // same frame instead of the name popping in first.
            (isLoadingDecodeDataData || isLoadingApproveTokenInfo) ? (
              <View style={styles.methodLoadingRow}>
                <LottieView style={styles.loadingDots} source={images.threeDotsLoading} autoPlay loop />
              </View>
            ) : (
              <MyTextTicker fontWeight={700}>{requestMethodNameWithLabel}</MyTextTicker>
            )
          }

          {/* Reserve the spending-cap space from the very first render for approves
              only (detected synchronously from the calldata selector), so the rows
              fill the reserved area without pushing the buttons down. Non-approve
              txs (e.g. transfer) never reserve it -> no empty gap that collapses. */}
          {isApproveLikely ? (
            <View style={styles.spendingCapReserved}>
              {showSpendingCap ? (
                <>
                  <View style={styles.rowBetween}>
                    <MyText variant='small' className='text-medium'>{I18n.t('WalletConnect.spendingCap')}</MyText>
                    <TouchableOpacity onPress={handleOpenModalEditApproveAmount}>
                      <MyIcon uri={images.UIV2.icons.editBrand} style={styles.icon18} resizeMode='contain' />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.amountRow}>
                    <ImageRender uri={approveTokenInfo.icon} style={styles.tokenIcon} resizeMode='contain' />
                    <MyTextTicker style={styles.amountText}>
                      {customApproveAmount || (approveTokenInfo.isUnlimited ? I18n.t('WalletConnect.approveUnlimited') : approveTokenInfo.amount)}
                    </MyTextTicker>
                    <MyText className='text-medium'>{approveTokenInfo.symbol}</MyText>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Reject / Confirm */}
        <View style={styles.buttons}>
          <MyButton
            size='small'
            variant='default'
            className='flex-1'
            label={I18n.t('Initial.reject')}
            onPress={onHandleRejectRequest}
            isLoading={isPressingReject}
            isDisable={isPressingConfirm || isPressingReject}
          />
          <MyButton
            size='small'
            variant='primary'
            className='flex-1'
            label={I18n.t('Initial.confirm')}
            onPress={approveMethod}
            isLoading={isPressingConfirm}
            isDisable={isDisableConfirmButton}
          />
        </View>
      </View>
    </View>
  )
}

const mapStateToProps = (state) => ({
  callRequestRedux: state.callRequestRedux,
  currentCallRequestRedux: state.currentCallRequestRedux,
  walletConnectRedux: state.walletConnectRedux
})

const mapDispatchToProps = (dispatch) => {
  return {
    setCallRequest: bindActionCreators(StorageReduxAction.setCallRequest, dispatch),
    setCurrentCallRequest: bindActionCreators(StorageReduxAction.setCurrentCallRequest, dispatch)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(RequestCard)
