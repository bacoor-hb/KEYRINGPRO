import React, { useState } from 'react'
import I18n from 'assets/Lang'
import { View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import ListActionRow from 'frontend/Components/UI/ListActionRow'
import images from 'assets/Image'
import createStyles from './styles'
import { getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import * as Animatable from 'react-native-animatable'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

// Hard cap on how many accounts a user can have. When reached, every
// add-account action is disabled (dimmed, non-tappable) regardless of type.
const MAX_ACCOUNTS = 20

const AddAccountPage = (_this) => {
  const { func = {}, props = {} } = _this
  const {
    handleManualPrivateKey = () => { },
    handleImportAccount = () => { },
    handleGeneratePrivateKey = () => { },
    handleRegisterAddress = () => { }
  } = func
  const { accountListRedux = [] } = props
  const [showOptionCreate, setShowOptionCreate] = useState(false)
  const styles = createStyles()

  // Count every account type — once at the cap, no new account can be added.
  const isLimitReached = (accountListRedux?.length || 0) >= MAX_ACCOUNTS

  // Disabled rows lose their press handler and dim to 0.5 opacity.
  const disabledRowProps = isLimitReached
    ? { onPress: undefined, containerStyle: { opacity: 0.5 } }
    : {}

  const renderOptionCreate = () => {
    const dataActions = [
      {
        icon: images.UIV2.icons.autoKey,
        title: I18n.t('v2.addAccount.autoKeyGen'),
        description: I18n.t('v2.accountModal.autoKeyGenDesc'),
        onPress: handleGeneratePrivateKey,
        iconConfig: {
          style: {
            width: getSizeImgSquare('large')
          }
        },
        rightElement: (
          <MyIcon
            variant='small'
            uri={images.UIV2.icons.arrowRightLow}
          />
        )
      },
      {
        icon: images.UIV2.icons.enterPrivateKey,
        title: I18n.t('v2.addAccount.manualKeyGen'),
        onPress: handleManualPrivateKey,
        description: I18n.t('v2.accountModal.manualKeyGenDesc'),
        iconConfig: {
          style: {
            width: getSizeImgSquare('large')
          }
        },
        rightElement: (
          <MyIcon
            variant='small'
            uri={images.UIV2.icons.arrowRightLow}
          />
        )
      }
    ]

    return (
      <Animatable.View easing='linear' duration={200} animation='fadeIn'>
        <View className='w-full' style={{ paddingLeft: pixelByWidth(8) }}>
          <ListActionRow data={dataActions} />
        </View>
      </Animatable.View>
    )
  }

  const dataActions = [
    {
      icon: images.UIV2.icons.plusMedium,
      title: I18n.t('v2.addAccount.importAccount'),
      onPress: handleImportAccount,
      iconConfig: {
        style: {
          width: getSizeImgSquare('large')
        }
      },
      rightElement: (
        <MyIcon
          variant='small'
          uri={images.UIV2.icons.arrowRightLow}
        />
      ),
      ...disabledRowProps
    },
    {
      icon: images.UIV2.icons.plusMedium,
      iconConfig: {
        style: {
          width: getSizeImgSquare('large')
        }
      },
      title: I18n.t('Content.createWallet'),
      onPress: () => setShowOptionCreate(!showOptionCreate),
      rightElement: (
        <MyIcon
          uri={showOptionCreate ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand}
          variant='small'
        />
      ),
      ...disabledRowProps
    }
  ]

  // "Register 0x address" lives at the bottom of the page (below the private-key
  // note). Its explanation renders as a standalone paragraph — like the
  // private-key text — rather than as an inline action-row description.
  const registerAction = [
    {
      icon: images.UIV2.icons.plusMedium,
      title: I18n.t('v2.addAccount.register0xAddress'),
      iconConfig: {
        style: {
          width: getSizeImgSquare('large')
        }
      },
      onPress: handleRegisterAddress,
      rightElement: (
        <MyIcon
          uri={images.UIV2.icons.arrowRightLow}
          variant='small'
        />
      ),
      ...disabledRowProps
    }
  ]

  // Limit-reached hint (failed icon + message), shown above the actions when
  // the account cap is hit. Mirrors the Figma `input_hint` row layout.
  const renderLimitHint = () => (
    <View
      className='w-full flex-row items-center'
      style={{ gap: pixelByWidth(12), marginBottom: pixelByHeight(8) }}
    >
      <MyIcon
        uri={images.UIV2.icons.failed}
        style={{ width: getSizeImgSquare('large'), height: getSizeImgSquare('large') }}
      />
      <MyText className='text-medium flex-1'>
        {I18n.t('v2.addAccount.accountLimitReached', { count: MAX_ACCOUNTS })}
      </MyText>
    </View>
  )

  return (
    <ScrollViewBlurHeader contentContainerStyle={{ flexGrow: 1 }}>
      <MyViewPage isSetHeightLayout style={styles.container} className='flex '>
        <TitleScreen
          title={I18n.t('v2.addAccount.title')}
        />

        {isLimitReached && renderLimitHint()}

        <View className='w-full'>
          <ListActionRow data={dataActions} />
          {!isLimitReached && showOptionCreate && renderOptionCreate()}
        </View>
        <MyText style={{ marginVertical: pixelByHeight(14) }} className='text-medium'>
          {I18n.t('v2.accountModal.howKeyStored')}
        </MyText>

        <MyText className='text-medium'>
          {I18n.t('v2.accountModal.keyEncryptedAes')}
        </MyText>

        <View className='w-full' style={{ marginTop: pixelByHeight(14) }}>
          <MyText className='text-white' variant='subTitle' style={{ marginBottom: pixelByHeight(8) }}>
            {I18n.t('v2.accountModal.viewOnlyAccount')}
          </MyText>
          <ListActionRow data={registerAction} />
        </View>
        <MyText style={{ marginTop: pixelByHeight(14) }} className='text-medium'>
          {I18n.t('v2.accountModal.viewOnlyDesc')}
        </MyText>

      </MyViewPage>
    </ScrollViewBlurHeader>
  )
}

export default AddAccountPage
