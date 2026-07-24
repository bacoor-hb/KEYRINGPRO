import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import styles from './styles'
import { Icon } from 'frontend/Components/Common/Icon'
import { handleOpenUrl, isHideMenuForAppleReview } from 'common/function'
import images from 'assets/Image'
import { ThemeContext, defaultContext } from 'frontend/Contexts/ThemeContext'
import { connect } from 'react-redux'
import ReduxService from 'common/redux'
import TextTicker from 'react-native-text-ticker'
import useAppNavigation from 'frontend/Hooks/useAppNavigation'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyBgBlur from 'frontend/Components/UI/MyBlur'
import NotificationBell from 'frontend/Components/Notification/NotificationBell'
const CoreHeader = (props) => {
  const {
    title,
    rightIcon,
    leftIcon,
    middleView,
    headerStyle,
    leftAction,
    rightAction,
    rightView,
    disabledCustomRightIcon = false,
    customTitleStyle,
    leftStyle,
    rightViewCustom,
    mainHeader = false,
    scrollPage,
    headerBlur = false
  } = props

  const isHideReview = isHideMenuForAppleReview()

  const { goBack } = useAppNavigation()

  const onOpenOfficalSite = () => {
    const url = ReduxService.getSettingOther('keyring_offical_site')
    handleOpenUrl(!isHideReview && url)
  }

  return (
    <ThemeContext.Consumer>{(context = defaultContext) => {
      return context ? (
        mainHeader ? (
          // Main header
          <View style={[styles.headerContainer, styles[`headerContainer${context.modeTheme}`]]}>
            <TouchableOpacity disabled onPress={onOpenOfficalSite} style={styles.boxLogo}>
              <MyIcon style={{ width: 157, height: 28 }} variant='title' resizeMode='contain' uri={images.UIV2.logoAppHasText} />
              {/* <MyText variant='title' style={[styles.txtAppName, context.styleTheme.txtStyle]}>KEYRING PRO</MyText> */}
            </TouchableOpacity>
            <NotificationBell func={props.func} />
          </View>
        ) : (
          // Page detail header: showing in a detail page with a back button
          <>
            {
              (scrollPage || headerBlur) && (
                <MyBgBlur />
              )
            }
            <View style={[(scrollPage || headerBlur) && styles.headerContainerScroll, styles.headerContainer, headerStyle]}>

              <View style={[styles.leftViewContainer]}>

                <MyButton
                  noMinWidth
                  onPress={(leftAction || goBack)}
                  activeOpacity={0.7}
                  size='small'
                  isCircleBtn
                  style={[{ paddingHorizontal: 0 }, styles.leftView, leftStyle]}
                >
                  {leftIcon === false
                    ? null
                    : (leftIcon || (
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        <MyIcon variant='title' uri={images.UIV2.icons.arrowLeftWhite} />
                      </View>
                    ))}
                </MyButton>

              </View>
              {
                middleView ? (
                  <View style={[styles.middleView, rightView && styles.middleSmall]}>
                    {middleView}
                  </View>
                ) : (
                  <View style={[styles.middleView, rightView && styles.middleSmall]}>
                    <TextTicker
                      style={[styles.txtTitle, context.styleTheme.txtStyle, customTitleStyle]}
                      animationType='auto'
                      loop
                      bounce={false}
                      marqueeDelay={1000}
                      duration={3000}
                    >
                      {title}
                    </TextTicker>
                  </View>
                )
              }
              <View style={[styles.rightViewContainer, rightViewCustom]}>
                {
                  rightView || (
                    rightAction ? (
                      <TouchableOpacity
                        onPress={rightAction}
                        disabled={disabledCustomRightIcon}
                        activeOpacity={0.7}
                        style={[styles.rightView]}>
                        {rightIcon || <Icon name='md-checkmark' />}
                      </TouchableOpacity>
                    ) : null
                  )
                }
              </View>
            </View>
          </>
        )
      ) : null
    }}
    </ThemeContext.Consumer>
  )
}

const mapStateToProps = (state) => ({
  settingsRedux: state.settingsRedux
})

export default connect(mapStateToProps, null)(CoreHeader)
