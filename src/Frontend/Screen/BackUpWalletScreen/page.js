import React from 'react'
import { Keyboard, ScrollView, TouchableWithoutFeedback, View } from 'react-native'
import I18n from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import images from 'assets/Image'
import createStyles from './styles'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { getSizeImgSquare, pixelByHeight, sizeImageSquare } from 'common/styles'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import InputCustom from 'frontend/Components/UI/InputCustom'

const BackUpWalletPage = (_this) => {
  const { func, state } = _this
  const { onChangeText } = func
  const {
    newPassword = '',
    confirmPassword = '',
    isPassNotMatch = false,
    listBackupFiles = []
  } = state

  const styles = createStyles()

  const infoParagraphs = [
    ...(ISIOS
      ? [
        I18n.t('v2.backup.saveToExternal'),
        I18n.t('v2.backup.fileNamedKeyring')
      ]
      : [
        I18n.t('v2.backup.saveToExternal') + '\n' + I18n.t('v2.backup.chooseFolder'),
        I18n.t('v2.backup.fileNamedKeyring')
      ]),
    I18n.t('v2.backup.onlyYouKnowPassword'),
    I18n.t('v2.backup.dontForgetPassword')
  ]

  const renderHistory = () => {
    if (listBackupFiles.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <View style={styles.emptySpacer} className='items-center'>
            <MyIcon uri={images.UIV2.icons.noData} style={styles.emptyIcon} variant='extraLarge' resizeMode='contain' />
            <MyText variant='small' className='text-low'>{I18n.t('v2.backup.noBackupFile')}</MyText>
          </View>

        </View>
      )
    }
    return (
      <View>
        {
          listBackupFiles.map((item, index) => {
            if (index > 2) {
              return null
            }
            return (
              <MyRowItem
                key={index}
                onPress={() => { }}
                lefIcon={(
                  <View style={{ width: getSizeImgSquare('large') }} className='justify-center items-center'>
                    <View style={styles.containerIconBackup}>
                      <MyIcon style={{ width: sizeImageSquare(16), height: sizeImageSquare(16) }} uri={images.UIV2.icons.backupFileWhite} />
                    </View>
                  </View>
                )}
              >
                <MyText className='text-medium'>
                  {item.time}
                </MyText>
              </MyRowItem>
            )
          })
        }
      </View>

    )
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps='handled'
        showsVerticalScrollIndicator={false}
      >
        <MyViewPage style={styles.container}>
          <View style={styles.formSection}>
            <TitleScreen
              title={I18n.t('MenuScreen.BackUpWalletScreen.titleHeader')}
            />

            <View style={styles.inputGroup}>
              <InputCustom
                value={newPassword}
                onChangeText={onChangeText('newPassword')}
                typeInput='password'
                leftIcon={images.UIV2.icons.password}
                placeholder={I18n.t('v2.password.setPassword')}
                inputWrapperConfig={{
                  style: {
                    minHeight: pixelByHeight(66)
                  }
                }}
              />
              <InputCustom
                value={confirmPassword}
                onChangeText={onChangeText('confirmPassword')}
                typeInput='password'
                leftIcon={images.UIV2.icons.password}
                placeholder={I18n.t('v2.password.confirmPassword')}
                isError
                errMessage={isPassNotMatch ? I18n.t('v2.password.passwordsNotMatch') : ''}
                inputWrapperConfig={{
                  style: {
                    minHeight: pixelByHeight(66)
                  }
                }}
              />

            </View>

          </View>
          <View style={{ gap: pixelByHeight(14) }}>
            {infoParagraphs.map((item) => (
              <MyText className='text-medium' key={item} style={styles.infoText}>
                {item}
              </MyText>
            ))}
            <View style={{ gap: pixelByHeight(8) }}>
              <MyText variant='subTitle' fontWeight={700}>
                {I18n.t('v2.backup.backupHistory')}
              </MyText>
              {renderHistory()}
            </View>
          </View>

        </MyViewPage>
      </ScrollView>
    </TouchableWithoutFeedback>
  )
}

export default BackUpWalletPage
