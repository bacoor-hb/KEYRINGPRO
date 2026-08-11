import React, { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { connect } from 'react-redux'
import { hexToString, isHex } from 'viem'
import { formatJsonRpcErrorForWalletConnectV2, lowerCase } from 'common/function'
import { getSizeImgSquare, pixelByHeight } from 'common/styles'
import ReduxService from 'common/redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import { getConnectorV2, redirectBackToDapp } from 'common/walletconnect'
import { getAccountInfoByRequest, removeCallRequest } from 'common/chain'
import { getPrivateKeyByAddress, isAccountFromKeyCard, remove0xFromPrivateKey } from 'common/wallet'
// No re-auth before signing for now: the user already authenticated at app
// unlock this session, so an extra prompt here is redundant. Whether to require
// re-auth per signature is still TBD — re-enable with the gate in onHandleApproveRequest.
// import { requestReauth } from 'common/secureVault'
import AllChainServices from 'controller/AllChainServices'
import { formatJsonRpcResult } from '@json-rpc-tools/utils'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import InfoAccountHeader from 'frontend/Components/UI/InfoAccountHeader'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'
import createStyles from './styles'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import { ScrollView } from 'react-native-gesture-handler'

// Sign-request UI (personal_sign / eth_signTypedData*). The approve/reject LOGIC
// is copied verbatim from manageRequestScreenV2 (approveSignPersionalMessageEVM /
// approveSignTypedDataEVM / onHandleApproveRequest); only the UI is rebuilt to the
// new design. Rendered by WalletConnectRequestsModal instead of a RequestCard when
// the pending request is a signature.
const SignatureRequestCard = (props) => {
  const styles = createStyles()
  const {
    item,
    accountIndex,
    walletConnectRedux,
    callRequestRedux,
    accountListRedux,
    showAlert,
    _this
  } = props

  const [isPressingSign, setIsPressingSign] = useState(false)
  const [isPressingReject, setIsPressingReject] = useState(false)

  // The signing account is the one the dApp addressed the request to — not
  // necessarily the active account — so resolve it from the account list to get
  // its name. Falls back to a bare address when it isn't one of ours (which
  // would already have been rejected upstream), so the header still renders.
  const signingAccount = useMemo(() => {
    const addr = lowerCase(item?.addressAccount || '')
    if (!addr) return null
    return (accountListRedux || []).find((a) => lowerCase(a?.address) === addr) || { address: addr }
  }, [accountListRedux, item?.addressAccount])

  // Auto-close the drawer once this sign request is no longer pending.
  useEffect(() => {
    const requests = callRequestRedux?.[accountIndex] || []
    const stillPending = requests.some((r) => r?.id === item?.id)
    if (!stillPending) {
      _this.closeDrawer()
    }
  }, [callRequestRedux])

  const walletConnectInfo = walletConnectRedux?.[accountIndex] || {}
  const meta = walletConnectInfo?.session?.peer?.metadata || {}

  const isTypedData = ['eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4'].includes(item?.method)

  const getMessageContent = () => {
    try {
      if (isTypedData) {
        return JSON.stringify(JSON.parse(item.params.request.params[1]), null, 2)
      }
      const raw = item.params.request.params[0]
      return isHex(raw) ? hexToString(raw) : raw
    } catch (_e) {
      return ''
    }
  }

  const approveSignTypedDataEVM = async (payload) => {
    const dataToSign = payload.params.request.params[1]
    const handleRedirectBackToDapp = () => {
      if (walletConnectRedux[accountIndex].isFromDeepLink) {
        redirectBackToDapp(showAlert)
      }
    }

    const addressRequested = payload.params.request.params[0].toLowerCase()
    const addressEip155FromRequest = (payload.params.chainId || `eip155:${payload.params.chainId}`) + ':' + addressRequested

    let privateKey
    const accountInfo = getAccountInfoByRequest(accountIndex, addressEip155FromRequest)

    // This account from the request is not selected for walletconnect
    // => Need to select account for connect first
    if (!accountInfo) {
      return
    }

    const address = accountInfo?.address || ''
    privateKey = getPrivateKeyByAddress(address)

    if (isAccountFromKeyCard(address)) {
      privateKey = await _this.nfcProxy.getPrivateKeyFromNFC(address)
    }

    try {
      if (privateKey) {
        const result = await AllChainServices.signTypedData(remove0xFromPrivateKey(privateKey), dataToSign)

        if (result) {
          const response = formatJsonRpcResult(payload.id, result)
          const connectorV2 = await getConnectorV2()
          await connectorV2.respondSessionRequest({ topic: payload.topic, response })
          handleRedirectBackToDapp()
        }

        removeCallRequest(accountIndex, payload, false)
        setTimeout(() => {
          ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
        }, 2000)
      } else {
        const response = formatJsonRpcErrorForWalletConnectV2(payload)
        const connectorV2 = await getConnectorV2()

        await connectorV2.respondSessionRequest({ topic: payload.topic, response })
        showAlert(I18n.t('NFC.userCancel'), '', { type: true, callback: handleRedirectBackToDapp, timeout: 4000 })

        removeCallRequest(accountIndex, payload)
      }
    } catch (error) {
      setIsPressingSign(false)
      showAlert(I18n.t('NFC.userCancel'), '', { type: true, callback: handleRedirectBackToDapp, timeout: 4000 })

      if (walletConnectRedux?.[accountIndex]) {
        const response = formatJsonRpcErrorForWalletConnectV2(payload, error?.message)
        const connectorV2 = await getConnectorV2()

        await connectorV2.respondSessionRequest({ topic: payload.topic, response })
      }
      removeCallRequest(accountIndex, payload)
    }
  }

  const approveSignPersionalMessageEVM = async (payload) => {
    const dataToSign = payload.params.request.params[0]

    const addressRequested = payload.params.request.params[1].toLowerCase()
    const addressEip155FromRequest = (payload.params.chainId || `eip155:${payload.params.chainId}`) + ':' + addressRequested

    let privateKey
    const accountInfo = getAccountInfoByRequest(accountIndex, addressEip155FromRequest)

    // This account from the request is not selected for walletconnect
    // => Need to select account for connect first
    if (!accountInfo) {
      return
    }

    const address = accountInfo?.address || ''
    privateKey = getPrivateKeyByAddress(address)

    if (isAccountFromKeyCard(address)) {
      privateKey = await _this.nfcProxy.getPrivateKeyFromNFC(address)
    }

    try {
      if (privateKey) {
        const result = await AllChainServices.signPersionalMessage(remove0xFromPrivateKey(privateKey), dataToSign)

        if (result) {
          const response = formatJsonRpcResult(payload.id, result)
          const connectorV2 = await getConnectorV2()

          await connectorV2.respondSessionRequest({ topic: payload.topic, response })

          if (walletConnectRedux[accountIndex].isFromDeepLink) {
            redirectBackToDapp(showAlert)
          }
        }

        removeCallRequest(accountIndex, payload, false)
        setTimeout(() => {
          ReduxService.callDispatchAction(StorageReduxAction.setCurrentCallRequest(false))
        }, 2000)
      } else {
        const response = formatJsonRpcErrorForWalletConnectV2(payload)
        const connectorV2 = await getConnectorV2()

        await connectorV2.respondSessionRequest({ topic: payload.topic, response })
        showAlert(I18n.t('NFC.userCancel'), '', { type: true, timeout: 4000 })

        removeCallRequest(accountIndex, payload)
      }
    } catch (error) {
      setIsPressingSign(false)
      showAlert(I18n.t('NFC.userCancel'), '', { type: true, timeout: 4000 })

      if (walletConnectRedux?.[accountIndex]) {
        const response = formatJsonRpcErrorForWalletConnectV2(payload, error?.message)
        const connectorV2 = await getConnectorV2()
        await connectorV2.respondSessionRequest({ topic: payload.topic, response })
      }
      removeCallRequest(accountIndex, payload)
    }
  }

  const onHandleApproveRequest = async () => {
    // Sign without re-auth for now — app unlock already authenticated the user
    // this session. If we later decide to require re-auth before each signature,
    // uncomment the two lines below and the requestReauth import.
    // const ok = await requestReauth()
    // if (!ok) return
    setIsPressingSign(true)
    switch (item.method) {
      case 'personal_sign':
        approveSignPersionalMessageEVM(item)
        break
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4':
        approveSignTypedDataEVM(item)
        break
      default:
        ReduxService.rejectRequestWalletConnect(item, accountIndex, null, showAlert)
        break
    }
  }

  const onHandleRejectRequest = () => {
    setIsPressingReject(true)
    ReduxService.rejectRequestWalletConnect(item, accountIndex, null, showAlert)
  }

  return (
    <MyViewPage style={styles.container}>
      {/* Header: dApp avatar + "Signature request" */}
      {/* <View style={styles.header}>
        <ImageRender
          uri={meta.icons?.[0]}
          uriDefault={images.walletConnectIcon}
          style={styles.avatar}
          resizeMode='cover'
        />
        <MyText variant='subTitle' fontWeight={700}>{I18n.t('WalletConnect.signatureRequestTitle')}</MyText>
      </View> */}
      <TitleDrawer
        title={I18n.t('WalletConnect.signatureRequestTitle')}
        leftIcon={meta.icons?.[0] || images.walletConnectIcon}
      />

      <View style={styles.body}>
        {/* Signing account — avatar + name/address. InfoAccountHeader carries its
          own left padding (it's built as a header middleView), which doubles as
          the gap after the avatar. */}
        {signingAccount && (
          <View style={styles.accountRow}>
            <AvatarAccount
              noShowAccountType
              chainId={item?.chainId}
              size={getSizeImgSquare('large')}
              account={signingAccount}
            />
            {/* InfoAccountHeader is width:'100%' (it's built as a header
              middleView) — box it in a flex child so it shrinks to the space
              left of the avatar instead of overflowing the row. */}
            <View style={styles.accountInfo}>
              <InfoAccountHeader
                infoAccount={signingAccount}
                showContractBadge={false}
              />
            </View>
          </View>
        )}

        {/* Safety note — no transaction is executed */}
        <MyText className='text-medium'>{I18n.t('WalletConnect.signatureRequestDesc')}</MyText>

        {/* Message preview */}
        <View style={styles.messageSection}>
          <MyText>{`${I18n.t('WalletConnect.requestMessageFrom')} ${meta.name || ''}`}</MyText>
          <ScrollView
            contentContainerStyle={{ paddingBottom: pixelByHeight(8) }}
            style={styles.messageBox}
            className='bg-input-field'
            showsVerticalScrollIndicator={false}
          >
            <MyText variant='small' className='text-medium'>{getMessageContent()}</MyText>
          </ScrollView>
        </View>

        {/* Reject / Sign */}
        <View style={styles.buttons}>
          <MyButton
            size='small'
            variant='default'
            className='flex-1'
            label={I18n.t('Initial.reject')}
            onPress={onHandleRejectRequest}
            isLoading={isPressingReject}
            isDisable={isPressingSign || isPressingReject}
          />
          <MyButton
            size='small'
            variant='primary'
            className='flex-1'
            label={I18n.t('WalletConnect.sign')}
            onPress={onHandleApproveRequest}
            isLoading={isPressingSign}
            isDisable={isPressingSign || isPressingReject}
          />
        </View>
      </View>
    </MyViewPage>
  )
}

const mapStateToProps = (state) => ({
  walletConnectRedux: state.walletConnectRedux,
  callRequestRedux: state.callRequestRedux,
  accountListRedux: state.accountListRedux
})

export default connect(mapStateToProps)(SignatureRequestCard)
