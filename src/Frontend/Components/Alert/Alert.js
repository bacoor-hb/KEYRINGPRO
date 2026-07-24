import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import styles from './styles'
import BaseAlert from './BaseAlert'
import * as Animatable from 'react-native-animatable'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { commonSize, width } from 'common/styles'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from '../UI/MyIcon'
import { isLiquidGlassSupported } from '@callstack/liquid-glass'
import DelayedDotLottie from 'frontend/Components/UI/DelayedDotLottie'
import { SettleGate } from 'frontend/Components/UI/MyDrawer/GlassSettleContext'

class Alert extends BaseAlert {
  render () {
    const { isOpen, type, message, isOut, title, moreView, closable, noAnimation = false, overClickClose = true, alertSettled } = this.state

    // The card zooms in (300ms); glass surfaces inside must wait for that to end
    // or they materialize mid-zoom and render broken. When the zoom animation is
    // skipped (noAnimation path) there's nothing to wait for → settled at once.
    const zoomDisabled = noAnimation && isLiquidGlassSupported
    const cardSettled = zoomDisabled || alertSettled

    const easingAlert = isOut ? 'ease-in-back' : 'ease-out-back'
    const isToast = type === 'toast'
    const isToastSuccess = type === 'toastSuccess'
    const theme = this.context

    return (
      isToastSuccess
        ? (
          <Animatable.View
            ref={this.viewAlertRef}
            duration={300}
            easing={easingAlert}
            animation='zoomIn'
            style={[
              styles.toastSuccessCtn,
              {
                flexDirection: 'row'
              }
            ]}
          >
            <ImageRender
              resizeMode='contain'
              uri={images.icChecked2}
              style={{ width: commonSize._20px, height: commonSize._20px, marginRight: width(1) }}
            />
            <MyText style={[styles.messageStyleToast]}>{message}</MyText>
          </Animatable.View>
        ) : isToast
          ? (
            <Animatable.View
              ref={this.viewAlertRef}
              duration={300}
              easing={easingAlert}
              animation='zoomIn'
              style={styles.toastCtn}>
              <MyText style={styles.messageStyleToast}>{message}</MyText>
            </Animatable.View>
          ) : (
            isOpen ? (
              <View style={styles.alertCusContainer}>
                <Animatable.View
                  duration={300}
                  // animation={isOut ? 'fadeOut' : 'fadeIn'}
                  animation='fadeIn'
                  style={styles[`backDropContainer${theme.modeTheme}`]}
                />
                <TouchableOpacity disabled={isOut} activeOpacity={1} onPress={overClickClose ? this.onCancelAction : null} style={styles.backDropContainerInSide} />
                <Animatable.View
                  ref={this.viewAlertRef}
                  duration={300}
                  easing={easingAlert}
                  // LiquidGlass not work when animation is enabled
                  animation={zoomDisabled ? undefined : 'zoomIn'}
                  // Once the zoom-in finishes, let inner glass surfaces promote
                  // to real glass (they stayed on the flat fallback during zoom).
                  onAnimationEnd={() => {
                    if (!isOut && !this.state.alertSettled) this.setState({ alertSettled: true })
                  }}
                  style={styles.alertCusContainer}
                  pointerEvents='box-none'
                >
                  <SettleGate settled={cardSettled}>
                    <MyLinearGradient variant='default' disableClip style={styles.newAlertCard}>
                      <View style={styles.newAlertCardContent}>
                        <View className='flex w-full flex-row justify-between'>
                          <View className='opacity-0'>
                            {closable && (
                              <TouchableOpacity activeOpacity={1} onPress={this.onCancelAction}>
                                <MyIcon variant='small' uri={images.UIV2.icons.closeNoBorder} />
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.newAlertIcon}>
                            <DelayedDotLottie
                              delay={150}
                              style={styles.newAlertIcon}
                              layout={{ fit: 'contain', align: [0.5, 0.5] }}
                              loop={false}
                              autoplay
                              source={type ? images.txFailAnimLottie : images.txSuccessAnimLottie}
                            />
                          </View>

                          <View>
                            {closable && (
                              <TouchableOpacity activeOpacity={1} onPress={this.onCancelAction}>
                                <MyIcon variant='small' uri={images.UIV2.icons.closeNoBorder} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        <MyText variant='subTitle' className='text-center' style={styles.newAlertTitle}>
                          {
                            title && title.length > 0
                              ? title
                              : (type ? I18n.t('Initial.error') : I18n.t('Initial.success'))
                          }
                        </MyText>
                        {
                          message
                            ? <MyText className='text-medium text-center'>{message}</MyText>
                            : null
                        }
                        {moreView && moreView}
                      </View>
                    </MyLinearGradient>
                  </SettleGate>
                </Animatable.View>
              </View>
            ) : null
          )
    )
  }
}

Alert.contextType = ThemeContext

export default Alert
