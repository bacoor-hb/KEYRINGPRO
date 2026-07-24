import React from 'react'
import I18n from 'assets/Lang'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import { CURRENCY_DATA } from 'common/constants/app'
import createStyles from './styles'
import images from 'assets/Image'
import { useSelector } from 'react-redux'
import MyIcon from 'frontend/Components/UI/MyIcon'
import { View } from 'react-native'
import ReduxService from 'common/redux'
import MyText from 'frontend/Components/UI/MyText'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'
import { pixelByHeight } from 'common/styles'

// `handleBack` / `onChanged` are opt-in: when this modal is opened on top of
// another drawer (e.g. from the Send flow), the header shows a round back button
// (instead of the settings icon) and selecting a currency just lowers this drawer
// to return to the flow, instead of resetting navigation to Home (Settings usage).
// `onSelect` / `selectedCode` are opt-in too: when provided, selection is reported
// back to the caller (used as local state) and the app-wide currency is NOT changed,
// and the highlighted row follows `selectedCode` instead of the global currency.
const ChangeRegionalCurrency = ({ _this, handleBack, onChanged, onSelect, selectedCode }) => {
  const { currencyRedux } = useSelector((state) => state)
  const activeCode = selectedCode || currencyRedux
  const styles = createStyles()

  const onChangeSelectedFlag = async (newCode) => {
    if (onSelect) {
      // Local-only usage (e.g. Send modal): report the choice, leave redux untouched.
      onSelect(newCode)
    } else {
      ReduxService.changeCurrency(newCode)
    }
    if (onChanged) {
      // Opened from another flow (e.g. Send): just lower this drawer.
      onChanged(newCode)
    }
  }
  const data = Object.values(CURRENCY_DATA).map((item, index) => {
    const isCurrentLocale = item.code === activeCode

    return (
      <MyRowItem
        noBorder={index === Object.values(CURRENCY_DATA).length - 1}
        lefIcon={(
          <View style={styles.containerIcon}>
            <MyIcon uri={images[item.code]} />
          </View>
        )}
        key={index}
        MyActionRow
        style={{ opacity: isCurrentLocale ? 1 : 0.7 }}
        onPress={() => isCurrentLocale ? null : onChangeSelectedFlag(item.code)}
        activeOpacity={0.7}>
        <MyText className={isCurrentLocale ? '' : 'text-medium'}>
          {`${item.code} ${I18n.t('Initial.' + item.code)}`}
        </MyText>
      </MyRowItem>
    )
  })

  return (
    <MyViewPage isUseDrawer style={[styles.container]}>
      <TitleDrawer
        absolute
        hasBlur
        title={I18n.t('v2.setting.regionalCurrency')}
        leftIcon={images.UIV2.icons.settings.currency}
      />
      <View style={{ height: pixelByHeight(8) }} />
      <ScrollViewBlurHeader isUseDrawer contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {data}
      </ScrollViewBlurHeader>

    </MyViewPage>
  )
}

export default ChangeRegionalCurrency
