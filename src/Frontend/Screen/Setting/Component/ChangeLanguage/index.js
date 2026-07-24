import React from 'react'
import I18n from 'assets/Lang'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import { LOCALE_DATA } from 'common/constants/app'
import createStyles from './styles'
import images from 'assets/Image'
import { useSelector } from 'react-redux'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { View } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import { pixelByHeight } from 'common/styles'

const ChangeLanguage = ({ _this }) => {
  const { handleChooseLanguage } = _this
  const { localeRedux } = useSelector((state) => state)
  const styles = createStyles()

  const data = LOCALE_DATA.map((item, index) => {
    const isCurrentLocale = item.name === localeRedux
    return (
      <MyRowItem
        noBorder={index === LOCALE_DATA.length - 1}
        lefIcon={(
          <View style={styles.containerIcon}>
            <MyIcon uri={images[item.name]} />
          </View>
        )}
        key={index}
        MyActionRow
        style={{ opacity: isCurrentLocale ? 1 : 0.7 }}
        onPress={() => isCurrentLocale ? null : handleChooseLanguage(item.name)}
        activeOpacity={0.7}>
        <MyText className={isCurrentLocale ? '' : 'text-medium'}>
          {item.title}
        </MyText>
      </MyRowItem>
    )
  })

  return (
    <MyViewPage isUseDrawer style={[styles.container]}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('MenuScreen.ChangeLanguageScreen.titleHeader')}
        leftAction={() => { }}
        leftIcon={images.UIV2.icons.settings.language}
      />
      <View style={{ height: pixelByHeight(8) }} />
      <ScrollViewBlurHeader isUseDrawer contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {data}
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default ChangeLanguage
