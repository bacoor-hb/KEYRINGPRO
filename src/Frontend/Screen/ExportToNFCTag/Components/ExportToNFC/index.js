import { View } from 'react-native'
import I18n from 'assets/Lang'
import React from 'react'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyText from 'frontend/Components/UI/MyText'
import LottieView from 'lottie-react-native'
import images from 'assets/Image'
import { pixelByHeight, pixelByWidth, width } from 'common/styles'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
const WIDTH_JSON = width(90) - pixelByWidth(32)
const HEIGHT_JSON = WIDTH_JSON * 1.16363636364 // 320/275

// const WIDTH_JSON = sizeImageSquare(275)
// const HEIGHT_JSON = sizeImageSquare(320)

const ExportToNFC = ({ _this }) => {
  const { handleExportToNFC } = _this
  const styles = createStyles()

  const renderJSON = (nameJson) => {
    return (
      <View className='justify-center mx-auto'>
        <LottieView
          style={[{ width: WIDTH_JSON, height: HEIGHT_JSON }]}
          source={nameJson}
          autoPlay
          loop
        />
      </View>
    )
  }
  return (
    <MyViewPage isUseDrawer style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        leftIcon={images.UIV2.icons.home.exportNFCKeycard}
        title={I18n.t('v2.exportNfc.exportToNfcTag')}
        rightElement={
          <MyButton onPress={handleExportToNFC} size='small' label={I18n.t('Initial.btnNext')} />
        }
      />
      <View style={{ paddingTop: pixelByHeight(8) }} />

      <ScrollViewBlurHeader isUseDrawer showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: pixelByHeight(8) }}>
        <View style={styles.containerRow}>
          <View style={styles.containerIconStep}>
            <MyIcon uri={images.UIV2.ExportToNFC.step1} />
          </View>

          <View style={styles.containerContentStep}>
            <MyText className='text-medium ' fontWeight={700}>{I18n.t('v2.exportNfc.scanYourNfcTag')}</MyText>
            <MyText className='text-medium  '>
              {I18n.t('v2.exportNfc.buyBlankTag')}
            </MyText>
          </View>
        </View>
        {renderJSON(images.scanYourNftTag)}

        <View style={styles.containerRow}>
          <View style={styles.containerIconStep}>
            <MyIcon uri={images.UIV2.ExportToNFC.step2} />
          </View>

          <View style={styles.containerContentStep}>
            <MyText className='text-medium ' fontWeight={700}>{I18n.t('v2.exportNfc.addPinCode')}</MyText>
            <MyText className='text-medium  '>
              {I18n.t('v2.exportNfc.pinCodeDesc')}
            </MyText>
          </View>
        </View>
        {renderJSON(images.addAPinCode)}

        <View style={styles.containerRow}>
          <View style={styles.containerIconStep}>
            <MyIcon uri={images.UIV2.ExportToNFC.step3} />
          </View>

          <View style={styles.containerContentStep}>
            <MyText className='text-medium ' fontWeight={700}>{I18n.t('v2.exportNfc.saveJsonFile')}</MyText>
            <MyText className='text-medium  '>
              {I18n.t('v2.exportNfc.jsonFileDesc')}
            </MyText>
          </View>
        </View>
        {renderJSON(images.saveTheFileJson)}
      </ScrollViewBlurHeader>
    </MyViewPage>
  )
}

export default ExportToNFC
