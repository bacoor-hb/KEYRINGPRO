import React, { useContext } from 'react'
import I18n from 'assets/Lang'
import { View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import images from 'assets/Image'
import createStyles from './styles'
import { MODE_THEME } from 'common/constants/app'
import { pixelByHeight, pixelByWidth } from 'common/styles'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
const ContentRow = ({
  title,
  icon
}) => {
  return (
    <View
      style={{ gap: pixelByWidth(8) }}
      className='flex flex-row items-center justify-between'>
      <View
        style={{
          flex: 1
        }}>
        <MyTextTicker className='text-medium'>
          {title}
        </MyTextTicker>
      </View>

      <MyIcon variant='small' uri={icon} />
    </View>
  )
}

const NFCTagOperationPage = ({ _this }) => {
  const { handleEnterPassShowPrivateKey, handleReadNFCTag, handleEraserNFC } = _this

  const { modeTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode)

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <ScrollViewBlurHeader contentContainerStyle={{ gap: pixelByHeight(8) }}>
        <TitleScreen
          title={I18n.t('v2.home.nfcTagOperation')}
        />
        <View style={{ gap: pixelByHeight(14) }} className='flex-1' showsVerticalScrollIndicator={false}>
          {/* <ListActionRow data={items} /> */}
          <MyRowItem
            onPress={handleEnterPassShowPrivateKey}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.viewPrivateKey} />
              </View>
            )}
            bottomContent={(
              <MyText className='text-low'>
                {I18n.t('v2.nfcOperation.viewPrivateKeyDeviceWarning')}
              </MyText>
            )}
          >
            <ContentRow
              title={I18n.t('v2.nfcOperation.showPrivateKey')}
              icon={images.UIV2.icons.icNFCTagOperation}
            />
          </MyRowItem>

          <MyRowItem
            onPress={handleReadNFCTag}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.copyBlue} />
              </View>
            )}
            bottomContent={(
              <MyText className='text-low'>
                {I18n.t('v2.nfcOperation.copyDesc')}
              </MyText>
            )}
          >
            <ContentRow
              title={I18n.t('NFC.copyCard')}
              icon={images.UIV2.icons.icNFCTagOperation}
            />
          </MyRowItem>

          <MyRowItem
            onPress={handleEraserNFC}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.resetRed} />
              </View>
            )}
            bottomContent={(
              <MyText className='text-low'>
                {I18n.t('v2.nfcOperation.resetDesc')}
              </MyText>
            )}
          >
            <ContentRow
              title={I18n.t('v2.nfcOperation.eraserNfcTag')}
              icon={images.UIV2.icons.icNFCTagOperation}
            />
          </MyRowItem>

        </View>
      </ScrollViewBlurHeader>

    </MyViewPage>

  )
}

export default NFCTagOperationPage
