import { View } from 'react-native'
import I18n from 'assets/Lang'
import React, { useState } from 'react'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyText from 'frontend/Components/UI/MyText'
import images from 'assets/Image'
import { getSafeAreaValues, pixelByHeight, pixelByWidth, width } from 'common/styles'
import { ScrollView } from 'react-native-gesture-handler'
import { DotLottie } from '@lottiefiles/dotlottie-react-native'
import {
  IOScrollView,
  InView
} from 'react-native-intersection-observer'
const WIDTH_JSON = width(90) - pixelByWidth(32)
const HEIGHT_JSON = WIDTH_JSON * 1.16363636364 // 320/275

// const WIDTH_JSON = sizeImageSquare(275)
// const HEIGHT_JSON = sizeImageSquare(320)

const HowDoUse = ({ _this }) => {
  const [step1Show, setStep1Show] = useState(true)
  const [step2Show, setStep2Show] = useState(true)
  const [step3Show, setStep3Show] = useState(false)
  const [step4Show, setStep4Show] = useState(false)

  const styles = createStyles()
  const Container = ISIOS ? IOScrollView : ScrollView

  const handleScroll = (event) => {
    if (!ISIOS) {
      // Get Y coordinate when scrolling vertically
      const positionY = event.nativeEvent.contentOffset.y

      if (positionY > HEIGHT_JSON) {
        setStep1Show(false)
        setStep3Show(true)
      } else {
        setStep1Show(true)
        setStep3Show(false)
      }

      if (positionY > HEIGHT_JSON * 2) {
        setStep2Show(false)
        setStep4Show(true)
      } else {
        setStep2Show(true)
        setStep4Show(false)
      }
    }
  }

  const renderJSON = (nameJson, stepInView = false) => {
    return (
      <View className='justify-center mx-auto'>
        {
          stepInView ? (
            <DotLottie
              style={[{ width: WIDTH_JSON, height: HEIGHT_JSON }]}
              source={nameJson}
              autoplay
              loop
              useFrameInterpolation
            />
          ) : (
            <View style={{ width: WIDTH_JSON, height: HEIGHT_JSON }} />
          )
        }

      </View>
    )
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        absolute
        hasBlur
        leftIcon={images.UIV2.icons.instruction}
        title={I18n.t('NFC.howDoYouUseIt')}

      />

      <Container onScroll={handleScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: pixelByHeight(0), paddingBottom: getSafeAreaValues().bottom }} style={{ paddingBottom: getSafeAreaValues().bottom }}>

        <InView onChange={setStep1Show}>
          {renderJSON(images.lottie.howDoUse.howDoUseStep1, step1Show)}

        </InView>
        <MyText className='text-medium text-center '>
          {I18n.t('v2.exportNfc.howUse1')}
        </MyText>
        <InView onChange={setStep2Show}>
          {renderJSON(images.lottie.howDoUse.howDoUseStep2, step2Show)}
        </InView>

        <MyText className='text-medium text-center '>
          {I18n.t('v2.exportNfc.howUse2')}
        </MyText>
        <InView onChange={setStep3Show}>
          {renderJSON(images.lottie.howDoUse.howDoUseStep3, step3Show)}
        </InView>
        <MyText className='text-medium text-center '>
          {I18n.t('v2.exportNfc.howUse3')}
        </MyText>
        <InView onChange={setStep4Show}>
          {renderJSON(images.lottie.howDoUse.howDoUseStep4, step4Show)}
        </InView>
        <MyText className='text-medium text-center '>
          {I18n.t('v2.exportNfc.howUse4')}
        </MyText>
      </Container>

    </MyViewPage>
  )
}

export default HowDoUse
