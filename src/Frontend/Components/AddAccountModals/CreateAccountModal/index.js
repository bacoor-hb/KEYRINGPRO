import React, { useEffect, useState } from 'react'
import I18n from 'assets/Lang'
import { ActivityIndicator, View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import ListActionRow from 'frontend/Components/UI/ListActionRow'
import images from 'assets/Image'
import { Colors, pixelByHeight } from 'common/styles'
import CreatedAccountSummary from '../CreatedAccountSummary'
import useDefaultAccountName from '../useDefaultAccountName'
import styles from './styles'

const MODE = { PICK: 'pick', SUCCESS: 'success' }

// `autoStart`: skip the PICK screen, immediately call onGenerateAuto on mount,
// and render a loading spinner until SUCCESS. Used when the caller has already
// committed to auto-generation (e.g., AddAccount screen's "Automatic" item).
const CreateAccountModal = ({ onGenerateAuto, onPickManual, onSuccess, autoStart = false }) => {
  const [mode, setMode] = useState(MODE.PICK)
  const [isLoading, setIsLoading] = useState(false)
  const [account, setAccount] = useState(null)
  const [accountName, setAccountName] = useState(useDefaultAccountName())

  const onAuto = async () => {
    if (isLoading) return
    setIsLoading(true)
    const evmAccount = await onGenerateAuto?.(accountName)
    setIsLoading(false)
    if (evmAccount) {
      setAccount(evmAccount)
      setMode(MODE.SUCCESS)
      onSuccess?.()
    }
  }

  const onManual = () => {
    onPickManual?.()
  }

  // Fire auto-generation once on mount when caller passed autoStart.
  useEffect(() => {
    if (autoStart) onAuto()
  }, [autoStart])

  // In autoStart mode while still generating, show a spinner instead of PICK.
  if (autoStart && mode === MODE.PICK) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('Content.createWallet')}
          leftIcon={images.UIV2.icons.accountAdd}
        />
        <View style={{ paddingVertical: pixelByHeight(48), alignItems: 'center' }}>
          <ActivityIndicator color={Colors.WHITE} />
        </View>
      </MyViewPage>
    )
  }

  if (mode === MODE.SUCCESS) {
    return (
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('Content.createWallet')}
          leftIcon={images.UIV2.icons.accountAdd}
        />
        <CreatedAccountSummary
          address={account?.address}
          accountName={accountName}
          onChangeAccountName={(name) => {
            setAccountName(name)
          }}
        />
      </MyViewPage>
    )
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('Content.createWallet')}
        leftIcon={images.UIV2.icons.accountAdd}
      />
      <ListActionRow
        style={styles.optionList}
        data={[
          {
            icon: images.UIV2.icons.autoGenerateKey,
            title: I18n.t('v2.addAccount.autoKeyGen'),
            description: I18n.t('v2.accountModal.autoKeyGenDesc'),
            onPress: onAuto,
            rightElement: <MyIcon uri={images.UIV2.icons.arrowRightLow} style={styles.arrowRight} />
          },
          {
            icon: images.UIV2.icons.enterPrivateKey,
            title: I18n.t('v2.addAccount.manualKeyGen'),
            description: I18n.t('v2.accountModal.manualKeyGenDesc'),
            onPress: onManual,
            rightElement: <MyIcon uri={images.UIV2.icons.arrowRightLow} style={styles.arrowRight} />
          }
        ]}
      />
      <View style={styles.infoBox}>
        <MyText className='text-medium' style={styles.infoHeading}>
          {I18n.t('v2.accountModal.howKeyStored')}
        </MyText>
        <MyText className='text-medium' style={styles.infoText}>
          {I18n.t('v2.accountModal.keyEncryptedAes')}
        </MyText>
      </View>
    </MyViewPage>
  )
}

export default CreateAccountModal
