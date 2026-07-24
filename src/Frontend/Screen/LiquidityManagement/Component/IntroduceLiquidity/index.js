import React, { useEffect, useState } from 'react'
import { View, ScrollView, Image } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import I18n from 'assets/Lang'
import styles from './styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import images from 'assets/Image'

// Interval (ms) between the two tutorial images — recreates the old GIF's motion
// by swapping between the two static PNGs every 2 seconds (hard cut, no transition).
const SLIDE_INTERVAL = 2000

// Swaps through a list of images every SLIDE_INTERVAL ms with no transition. Uses
// RN Image (not FastImage/ImageRender) to match the rest of the tutorial's timing.
const AnimatedTutorialImages = ({ sources }) => {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!sources || sources.length < 2) return
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % sources.length)
    }, SLIDE_INTERVAL)
    return () => clearInterval(timer)
  }, [sources])

  return (
    <Image
      source={sources[index]}
      resizeMode='contain'
      style={styles.imgTutorial}
    />
  )
}

const Step = ({ number, title, children }) => (
  <View style={styles.containerStep}>
    <View style={styles.stepHeader}>
      {!!number && (
        <View style={styles.boxNumber}>
          <MyText fontWeight={700} style={styles.textNumber}>
            {number}
          </MyText>
        </View>
      )}
      <View style={styles.stepTitle}>
        <MyText className='text-medium' fontWeight={700}>{title}</MyText>
      </View>
    </View>
    {children}
  </View>
)

const IntroduceLiquidity = ({ title }) => {
  return (
    <ScrollView
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {/* Title rides inside the scroll so it passes UNDER the floating blur header,
          like the registered PoolList. It still measures itself as the drawer anchor. */}
      {!!title && <TitleScreen title={title} />}
      <MyText className='text-medium'>
        {I18n.t('v2.liquidity.intro')}
      </MyText>
      {/* Replaces the old animated GIF: cross-fade between the two static PNGs
          every 2s so it "moves" like the GIF did, without FastImage/Glide playing
          a real GIF too fast on high-refresh phones. */}
      <AnimatedTutorialImages
        sources={[images.liquidityGif_1, images.liquidityGif_2]}
      />

      <View>
        <MyText className='text-white' fontWeight={700} style={styles.title}>
          {I18n.t('liquidityManagementScreen.toturial.whatIsThis')}
        </MyText>
        <MyText className='text-medium'>
          {I18n.t('liquidityManagementScreen.toturial.whatIsThisDes')}
        </MyText>
        <View style={styles.imgWrapper}>
          <ImageRender
            uri={images.whatIsThisLiquidity}
            style={styles.imgTutorialStep}
            resizeMode='contain'
          />
        </View>
      </View>

      <View>
        <MyText className='text-white' fontWeight={700} style={styles.title}>
          {I18n.t('liquidityManagementScreen.toturial.whyDoYouNeedThisFeature')}
        </MyText>
        <MyText className='text-medium'>
          {I18n.t('liquidityManagementScreen.toturial.whyDoYouNeedThisFeatureDes')}
        </MyText>
      </View>

      <View>
        <MyText className='text-white' fontWeight={700} style={styles.title}>
          {I18n.t('liquidityManagementScreen.toturial.howToUse')}
        </MyText>

        <Step number={1} title={I18n.t('v2.liquidity.step1')}>
          <ImageRender uri={images.liquidity_step_1} style={styles.imgTutorialStep} resizeMode='contain' />
        </Step>

        <Step number={2} title={I18n.t('v2.liquidity.step2')}>
          <ImageRender uri={images.liquidity_step_2} style={styles.imgTutorialStep} resizeMode='contain' />
        </Step>

        <Step number={3} title={I18n.t('v2.liquidity.step3')}>
          <ImageRender
            uri={images.liquidity_step_3}
            style={styles.imgTutorialStep}
            resizeMode='contain'
          />
        </Step>

        <Step number={4} title={I18n.t('v2.liquidity.step4')}>
          <ImageRender uri={images.liquidity_step_4} style={styles.imgTutorialStep} resizeMode='contain' />
        </Step>

        <Step number={5} title={I18n.t('v2.liquidity.step5')}>
          <ImageRender uri={images.liquidity_step_5} style={styles.imgTutorialStep} resizeMode='contain' />
        </Step>
        <Step number={6} title={I18n.t('v2.liquidity.step6')}>
          <ImageRender uri={images.liquidity_step_6} style={styles.imgTutorialStep} resizeMode='contain' />
        </Step>
      </View>
    </ScrollView>
  )
}

export default IntroduceLiquidity
