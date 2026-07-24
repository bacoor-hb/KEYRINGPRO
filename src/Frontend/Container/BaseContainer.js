import React, { createRef, PureComponent } from 'react'
import { View, StatusBar, Keyboard, ScrollView } from 'react-native'
import styles from './styles'
import Modal from 'react-native-modalbox'
import CoreHeader from './CoreHeader'
import ToastNotification from 'frontend/Components/Alert/Alert'
import ActionSheet from 'frontend/Components/Common/ActionSheet'
import { ThemeContext, defaultContext } from 'frontend/Contexts/ThemeContext'
import { MODE_THEME } from 'common/constants/app'
import NfcProxyV2 from 'common/NfcProxyV2'
import { sleep } from 'common/function'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import { getHeightHeader, getHeightScreen, pixelByHeight, width } from 'common/styles'
import ReduxService from 'common/redux'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import MyDrawerUI from 'frontend/Components/UI/MyDrawer/ui'
import { ANIMATION_DRAWER } from 'common/constants/drawer'

const DEFAULT_DRAWER = {
  addDrawer: false,
  enablePanDownToClose: true,
  children: null,
  onClose: () => { },
  scrollView: false,
  style: {},
  heightDrawer: null,
  backdrop: false,
  animation: ANIMATION_DRAWER.SLIDE_FROM_BOTTOM,
  position: 'bottom'
}
export default class BaseContainer extends PureComponent {
  constructor (props, context) {
    super(props, context)
    this.navigation = props.navigation
    this.entryPopup = 'bottom'
    this.isTouchDisable = false
    this.page = null
    this.popup = null
    this.onPopupClosed = null
    this.popupSheet = null
    this.backdropPressToClose = false
    this.backdropPressToCloseBottomSheet = true
    this.showSwpipeIconBottomSheet = true
    this.swipeToClose = true
    this.disableModalKeyboardHandling = false
    this.popsitionPopup = 'center'
    this.popsitionPopupSheet = null
    this.swipeArea = null
    this.utilBalance = null
    this.configLinearGradient = null
    this.heightPopup = 0
    this.heightPopupDefault = 0
    this.drawer = createRef(null)
    this.popupIsOpenRef = createRef(false)
    this.popupSheetIsOpenRef = createRef(false)
    this._nfcProxy = null
    ReduxService.refLayoutContainer.current = null
    ReduxService.refLayoutHeaderAnchor.current = null

    this.view = (props) => {
      return this.renderContent(props)
    }
  }

  componentWillUnmount () {
    this._nfcProxy = null
  }

  get nfcProxy () {
    if (!this._nfcProxy) {
      this._nfcProxy = new NfcProxyV2(this)
    }
    return this._nfcProxy
  }

  showAlert = (message, title = '', options = {}) => {
    this.pushAlert && this.pushAlert.alertWithType(message, title, options)
  }

  closeAlert = () => {
    this.pushAlert && this.pushAlert.onCancelAction()
  }

  showIndicator = (message, isError, moreAction) => {
    this.pushAlert && this.pushAlert.alertWithType(message, '', { type: isError, callback: moreAction })
    this.pushIndicator && this.pushIndicator.alertWithType(message, '', { type: isError, callback: moreAction })
  }

  getHeightLayoutModal = () => {
    // default use this when we dont use header or scollView
    let heightContainer = getHeightScreen() - getHeightHeader(true)

    let heightHeaderAnchor = pixelByHeight(68)

    if (ReduxService.refLayoutContainer?.current?.height) {
      heightContainer = ReduxService.refLayoutContainer.current.height
    }

    if (ReduxService.refLayoutHeaderAnchor?.current?.height) {
      heightHeaderAnchor = ReduxService.refLayoutHeaderAnchor.current.height
    } else {
      if (ReduxService.refLayoutHeaderAnchorDefault.current?.height) {
        heightHeaderAnchor = ReduxService.refLayoutHeaderAnchorDefault.current.height
      }
    }

    this.heightPopupDefault = heightContainer - heightHeaderAnchor
  }

  openModal = async () => {
    this.getHeightLayoutModal()
    if (this.popupIsOpenRef.current) {
      await sleep(500) // why? 500 here because modal close animation time is 400ms
    }

    Keyboard.dismiss()
    this.forceUpdate()
    if (this.popsitionPopup === 'bottom') {
      this.configLinearGradient = {
        style: {
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0
        }
      }
    }
    this.refPopup && this.refPopup.open()
    this.popupIsOpenRef.current = true
  }

  closeModal = () => {
    this.refPopup && this.refPopup.close()
    this.setStatusBarBackgroundColor()
  }

  openDrawer (drawer = DEFAULT_DRAWER) {
    // keyChildren is the remount key for the drawer content (BottomSheetView).
    // A fresh value on every call force-remounts the children — desired for one-shot
    // drawers, but fatal for drawers that re-push themselves to refresh controlled
    // inputs (the TextInput would remount and lose focus after each keystroke).
    // Such callers pass a STABLE keyChildren to keep the subtree mounted.
    const keyChildren = drawer.keyChildren || Date.now()
    // Dismiss the keyboard before showing a drawer (same as openModal/openSheet),
    // so opening e.g. the address book / currency picker from a focused input
    // doesn't leave the keyboard covering the new drawer.
    // Keyboard.dismiss()
    this.getHeightLayoutModal()
    const drawerConfig = { ...DEFAULT_DRAWER, ...drawer, keyChildren }
    this.drawer.current.openDrawer(drawerConfig, this.heightPopup || this.heightPopupDefault)
  }

  closeDrawer = async () => {
    await this.drawer.current?.closeDrawer?.()
  }

  closeAllDrawer = async () => {
    await this.drawer.current?.closeAllDrawer?.()
  }

  openSheet = async (sheetData, sheetTitle = null, options = {}) => {
    if (this.popupSheetIsOpenRef.current) {
      await sleep(500) // why? 500 here because modal close animation time is 400ms
    }

    Keyboard.dismiss()
    this.sheetData = sheetData
    this.sheetTitle = sheetTitle
    this.sheetOptions = options
    this.forceUpdate()
    this.refSheet && this.refSheet.open()
    this.popupSheetIsOpenRef.current = true
  }

  closeSheet = () => {
    this.sheetData = null
    this.popupSheet = null
    this.refSheet && this.refSheet.close()
    this.setStatusBarBackgroundColor()
  }

  setStatusBarColor = (theme) => {
    switch (theme) {
      case MODE_THEME.LIGHT_MODE:
        StatusBar.setBarStyle('dark-content', true)
        break
      case MODE_THEME.DARK_MODE:
        StatusBar.setBarStyle('light-content', true)
        break
      default:
        StatusBar.setBarStyle('dark-content', true)
    }
  }

  calculateStatusBarBackgroundColor = (theme) => {
    switch (theme) {
      case MODE_THEME.LIGHT_MODE:
        return '#7a7a7d'
      case MODE_THEME.DARK_MODE:
        return '#080d0b'
      default:
        return 'transparent'
    }
  }

  setStatusBarBackgroundColor = (theme) => {
    !ISIOS && StatusBar.setBackgroundColor(this.calculateStatusBarBackgroundColor(theme), true)
  }

  dismissKeyboard = () => Keyboard.dismiss()
  setRefsPopup = (ref) => { this.refPopup = ref }
  setRefsAlert = (ref) => { this.pushAlert = ref }
  setRefsSheet = (ref) => { this.refSheet = ref }
  setRefsIndicator = (ref) => { this.pushIndicator = ref }

  renderContent = (props) => {
    const { page, popup, popupSheet } = this
    const { noHeader = false, scrollPage = false, paddingTop = getHeightHeader(true) } = props
    const Template = page

    const ContainerView = scrollPage ? ScrollView : View

    return (
      <ThemeContext.Consumer>{(context = defaultContext) => {
        return (
          <GestureHandlerRootView
            style={{
              flex: 1
              // height: height(100)
            }}>
            <View
              style={[styles.container, context.styleTheme]}>
              {!noHeader && <CoreHeader {...props} />}
              <StatusBar translucent backgroundColor='transparent' barStyle={this.setStatusBarColor(context.modeTheme)} />

              <ContainerView showsVerticalScrollIndicator={false} style={[styles.container, scrollPage && { paddingTop }]}>
                {
                  Template
                    ? <Template {...props} />
                    : props.children
                }
              </ContainerView>

              <ToastNotification ref={this.setRefsAlert} />
              <Modal
                keyboardTopOffset={0}
                disableKeyboardHandling={this.disableModalKeyboardHandling}
                style={[styles.modalFormStyle, this.popsitionPopup === 'bottom' && styles.flexEnd, (this.heightPopupDefault || this.heightPopup) && { height: (this.heightPopup || this.heightPopupDefault) }]}
                swipeToClose={this.swipeToClose}
                backdropPressToClose={this.backdropPressToClose}
                entry={this.entryPopup}
                position={this.popsitionPopup}
                ref={this.setRefsPopup}
                swipeArea={this.swipeArea}
                onOpened={() => {
                  this.setStatusBarBackgroundColor(context.modeTheme)
                }}
                onClosed={() => {
                  this.popupIsOpenRef.current = false
                  this.setStatusBarBackgroundColor()
                  this.onPopupClosed && this.onPopupClosed()
                  this.onPopupClosed = null
                  this.configLinearGradient = null
                  this.disableModalKeyboardHandling = false
                }}
                onClosingState={(isClosing) => {
                  if (isClosing) {
                    this.setStatusBarBackgroundColor()
                  } else {
                    this.setStatusBarBackgroundColor(context.modeTheme)
                  }
                }}
              >
                {
                  popup && (
                    <StatusBar
                      translucent
                      backgroundColor={this.calculateStatusBarBackgroundColor(context.modeTheme)}
                      barStyle={this.setStatusBarColor(context.modeTheme)} />
                  )
                }
                <MyLinearGradient variant='modal' {... this.configLinearGradient}>
                  <View style={[{ width: width(100) }, (this.heightPopupDefault || this.heightPopup) && { height: (this.heightPopup || this.heightPopupDefault) }]}>
                    {popup}
                  </View>
                </MyLinearGradient>
              </Modal>
              <Modal
                keyboardTopOffset={0}
                style={[styles.modalFormStyle, (this.popsitionPopupSheet || this.popsitionPopup) === 'bottom' && styles.flexEnd]}
                swipeToClose={this.swipeToClose}
                backdropPressToClose={this.backdropPressToClose}
                entry='bottom'
                position='bottom'
                ref={this.setRefsSheet}
                onOpened={() => {
                  this.setStatusBarBackgroundColor(context.modeTheme)
                }}
                onClosed={() => {
                  this.popupSheetIsOpenRef.current = false
                  this.setStatusBarBackgroundColor()
                }}
                onClosingState={(isClosing) => {
                  if (isClosing) {
                    this.setStatusBarBackgroundColor()
                  } else {
                    this.setStatusBarBackgroundColor(context.modeTheme)
                  }
                }}
              >
                <>
                  <StatusBar
                    translucent
                    backgroundColor={this.calculateStatusBarBackgroundColor(context.modeTheme)}
                    barStyle={this.setStatusBarColor(context.modeTheme)} />
                  {
                    popupSheet ? (
                      <>
                        {popupSheet}
                      </>
                    ) : (
                      <ActionSheet
                        backdropPressToClose={this.backdropPressToClose}
                        showSwpipeIconBottomSheet={this.backdropPressToCloseBottomSheet}
                        sheetData={this.sheetData}
                        sheetTitle={this.sheetTitle}
                        options={this.sheetOptions}
                        closeSheet={this.closeSheet} />
                    )
                  }

                </>

              </Modal>

              <MyDrawerUI ref={this.drawer} />
            </View>
          </GestureHandlerRootView>

        )
      }}
      </ThemeContext.Consumer>
    )
  }
}
