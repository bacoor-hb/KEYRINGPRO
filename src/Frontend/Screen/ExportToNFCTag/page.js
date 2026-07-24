import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import MyText from 'frontend/Components/UI/MyText'
import images from 'assets/Image'
import createStyles from './styles'
import { getHeightHeader, getHeightScreen, height, pixelByHeight, sizeImageSquare } from 'common/styles'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { AI_SEARCH_SESSION, getAiMessages, isQuestionAnswered } from 'common/aiSearchHistory'
import ReduxService from 'common/redux'
import { REDUX_KEY } from 'common/constants/redux'
import I18n, { currentLanguageBcp47 } from 'assets/Lang'
import LottieView from 'lottie-react-native'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

const ExportNFCToTagPage = (_this) => {
  const { func } = _this
  const { handleHowDoUse } = func
  const [heightLottie, setHeightLottie] = useState(0)

  const styles = createStyles()
  const containerContentRef = useRef(null)

  useEffect(() => {
    setTimeout(() => {
      if (containerContentRef.current) {
        containerContentRef.current.measure((fx, fy, width, height, px, py) => {
          setHeightLottie(height)
        })
      }
    }, 300)
  }, [])

  const sizeLottie = useMemo(() => {
    const size = getHeightScreen() - getHeightHeader(true) - heightLottie - pixelByHeight(20)
    if (size < 0 || heightLottie < 1) {
      return 0
    }
    if (size < height(40)) {
      return height(40)
    }
    return size
  }

  , [heightLottie])

  // Open AI Search for the NFC-tag session. Only auto-send `message` as the
  // first turn if the user hasn't already asked it in this session — otherwise
  // just navigate to the existing conversation so we don't ask twice.
  //
  // For conceptual NFC questions (`useNfcInfo`) we also hand AISearch a DIRECT
  // `nfc-info` call so the first turn skips the router/LLM arg-parsing and runs
  // the tool straight away. `message` stays the visible question (and the
  // fallback on cores that predate runTool — AISearch then sends it via the
  // normal chat() pipeline). We pass the user's current language (BCP-47) as the
  // tool's only arg so its closing "where to buy" link points at the user's
  // local storefront; AISearch still pins the reply language separately.
  const askAi = (message, useNfcInfo) => {
    const address = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)?.account?.address
    const history = getAiMessages(ReduxService.getReduxDataByKey('aiSearchHistoryRedux'), address, AI_SEARCH_SESSION.nfcTag)
    // Skip auto-send only if this question was already ANSWERED — not merely asked.
    // A question the user asked but then stopped / left before a reply landed is
    // still unanswered, so we re-send it instead of opening a dead-end thread.
    const alreadyAnswered = isQuestionAnswered(history, message)
    const directTool = useNfcInfo
      ? { name: 'nfc-info', args: { language: currentLanguageBcp47() } }
      : undefined
    NavigationActions.navigate(NAME_SCREEN.aiSearch, {
      initialMessage: alreadyAnswered ? undefined : message,
      sessionKey: AI_SEARCH_SESSION.nfcTag,
      // Only forward the direct tool when we're actually auto-sending this turn.
      directTool: alreadyAnswered ? undefined : directTool
    })
  }

  return (

    <MyViewPage style={styles.container}>
      <ScrollViewBlurHeader
        showsVerticalScrollIndicator={false}
        className='flex-1'

      >
        <View ref={containerContentRef}>
          <TitleScreen
            title={I18n.t('NFC.exportToNFCTag')}
          />

          <MyRowItem
            noBorder
            noPadding
            style={{
              paddingBottom: pixelByHeight(14),
              paddingTop: pixelByHeight(8),
              alignItems: 'start'
            }}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.idea} />
              </View>
            )}
          >
            <MyText className='text-medium'>
              {I18n.t('NFC.whyColdWalletNfcTag')}
            </MyText>
          </MyRowItem>

          {/* what is nfc tag */}
          <MyRowItem
            onPress={() => askAi(I18n.t('NFC.whatIsNfcTag'), true)}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.question} />
              </View>
            )}
          >
            <View className='flex flex-row justify-between items-center'>
              <MyText className='text-medium'>
                {I18n.t('NFC.whatIsNfcTag')}
              </MyText>

              <MyButton
                onPress={() => askAi(I18n.t('NFC.whatIsNfcTag'), true)}
                noMinWidth
                style={{ height: pixelByHeight(28) }}
                size='small'
              >
                <View className='flex-row items-center justify-center py-1 '>
                  <MyIcon style={{ width: sizeImageSquare(35), height: sizeImageSquare(17) }} uri={images.UIV2.icons.btnAiChat} />
                </View>
              </MyButton>
            </View>
          </MyRowItem>

          {/* how do use */}
          <MyRowItem
            onPress={handleHowDoUse}
            lefIcon={(
              <View style={styles.containerLeftIcon}>
                <MyIcon uri={images.UIV2.icons.instruction} />
              </View>
            )}
          >
            <View className='flex flex-row justify-between items-center'>
              <MyText className='text-medium' style={{ flex: 1 }}>
                {I18n.t('NFC.howDoYouUseIt')}
              </MyText>
              <MyIcon uri={images.UIV2.icons.arrowRightLow} variant='small' />

            </View>
          </MyRowItem>
        </View>
      </ScrollViewBlurHeader>
      <LottieView
        style={[{
          width: sizeLottie,
          height: sizeLottie,
          alignSelf: 'center'
        }]}
        source={images.coldNFCWallet}
        autoPlay
        loop />
    </MyViewPage>

  )
}

export default ExportNFCToTagPage
