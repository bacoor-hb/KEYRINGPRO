import { View } from 'react-native'
import I18n from 'assets/Lang'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import images from 'assets/Image'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import MyText from 'frontend/Components/UI/MyText'
import { Colors, getSizeImgSquare, pixelByHeight, pixelByWidth } from 'common/styles'
import MyIcon from 'frontend/Components/UI/MyIcon'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import { ACCOUNT_TYPE } from 'common/constants/account'

const DeleteAccount = ({ _this }) => {
  const { handleDeleteAccount } = _this
  const { activeAccount } = useSelector(state => state)
  const { account: accountActive, indexAccount } = activeAccount

  const styles = createStyles()
  const [account] = useState(accountActive)
  const isAccountOnlyView = account.accountType === ACCOUNT_TYPE.VIEW_ONLY
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = () => {
    setIsLoading(true)
    handleDeleteAccount(isDelete => {
      if (isDelete) {
        setStep(3)
      } else {
        setIsLoading(false)
      }
    })
  }

  const renderAccountDetail = () => {
    return (
      <View style={{ gap: pixelByHeight(14) }}>
        <View>
          <MyText className='text-low'>{I18n.t('v2.accountDetail.accountToDelete')}</MyText>
          <MyActionRow title={account.address} titleClassName='text-medium' />
        </View>
        <View>
          <MyText className='text-low'>{I18n.t('v2.accountDetail.accountName')}</MyText>
          <MyActionRow title={account.name || `Account ${indexAccount + 1}`} titleClassName='text-medium' />
        </View>
        <MyButton
          variant='dangerous'
          className='w-full'
          label={I18n.t('Initial.deleteThisAddress')}
          onPress={handleDelete}
          isLoading={isLoading} />
      </View>
    )
  }

  const renderWarningDelete = () => {
    return (
      <StatusMessage
        variant='warning'
        message={I18n.t('v2.accountDetail.savePrivateKeyWarning')}
        iconConfig={{
          className: 'm-auto'
        }}
      />
    )
  }

  const renderSuccessDelete = () => {
    return (
      <View style={{ paddingTop: pixelByHeight(8) }}>
        <StatusMessage
          style={{ alignItems: 'center' }}
          variant='success'
          title={I18n.t('v2.accountDetail.accountDeleted')}
          titleConfig={{
            className: 'text-green ',
            variant: 'subTitle',
            fontWeight: 700
          }}
          iconConfig={{
            className: 'm-auto'
          }}
        />
      </View>
    )
  }

  return (
    <MyViewPage isUseDrawer style={styles.container}>
      <TitleDrawer
        titleColor={Colors.RED_TEXT}
        absolute
        hasBlur
        title={I18n.t('v2.accountDetail.deleteAccount')}
        leftIcon={(
          <View
            style={[
              { width: getSizeImgSquare('large'), height: getSizeImgSquare('large') }
            ]}
            className='bg-red items-center justify-center rounded-full overflow-hidden'
          >
            <MyIcon variant='title' uri={images.UIV2.icons.deleteWhite} />
          </View>
        )}
        rightElement={(
          step === 1 && (
            <MyButton variant='dangerous' onPress={() => setStep(2)} label={I18n.t('Initial.Delete')} size='small' />
          )
        )}
      />

      <ScrollViewBlurHeader
        contentContainerStyle={{
          flex: 1,
          paddingHorizontal: pixelByWidth(16)
        }}
        isUseDrawer
        style={{ gap: pixelByHeight(14), paddingTop: pixelByHeight(8) }}>
        {(step === 1 && !isAccountOnlyView) && renderWarningDelete()}
        {step === 2 && renderAccountDetail()}
        {step === 3 && renderSuccessDelete()}
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default DeleteAccount
