import BottomSheet, { BottomSheetView, useBottomSheetInternal, useBottomSheetTimingConfigs } from '@gorhom/bottom-sheet'
import { Colors, height, pixelByWidth, width } from 'common/styles'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Keyboard, View, Modal as RNModal, StyleSheet } from 'react-native'
import { Extrapolation, interpolate, ReduceMotion, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import MyLinearGradient from '../MyLinearGradient'
import { mergeStyle } from 'common/tailwind'
import { sleep } from 'common/function'
import { ANIMATION_DRAWER } from 'common/constants/drawer'
import { GlassSettleProvider } from './GlassSettleContext'
import * as Animated from 'react-native-animatable'

export const BORDER_RADIUS_TOP_DRAWER = {
  borderTopLeftRadius: 32,
  borderTopRightRadius: 32
}

// --- COMPONENT NỘI DUNG CÓ ANIMATION ---
const AnimatedContent = ({ children, animation }) => {
  const zoomAnim = useSharedValue(0)

  useEffect(() => {
    zoomAnim.value = withSpring(1, { damping: 15, stiffness: 100 })
  }, [])

  const animatedStyle = useAnimatedStyle(() => {
    let transformOrigin = 'bottom right'
    if (animation === ANIMATION_DRAWER.ZOOM_FORM_BOTTOM_RIGHT) {
      transformOrigin = 'bottom right'
    }

    if (animation === ANIMATION_DRAWER.ZOOM_FORM_BOTTOM_LEFT) {
      transformOrigin = 'bottom left'
    }

    // Interpolate value: zoomAnim 0 -> 1 maps to scale 0.8 -> 1
    const scale = interpolate(
      zoomAnim.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    )

    const opacity = interpolate(
      zoomAnim.value,
      [0, 0.5, 1],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    )

    return {
      transform: [{ scale }],
      opacity,
      // KEY: Set the zoom origin to bottom-right corner
      // Note: transformOrigin requires Reanimated v3.x or higher
      transformOrigin
    }
  })

  return (
    // Publish spring progress (0 -> 1) so inner glass waits for settle before
    // materializing; spring ends after the sheet anim, glass breaks mid-transform.
    <GlassSettleProvider value={zoomAnim}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        {children}
      </Animated.View>
    </GlassSettleProvider>
  )
}

// Non-zoom branch (SLIDE_FROM_BOTTOM): settle signal is the sheet's own slide.
// Track animatedIndex, publish 1 once it rests on a snap index. Renders inside
// <BottomSheet> so the internal context is available.
const SettledContent = ({ children }) => {
  // true = don't throw if no sheet host; nothing slides, so report settled.
  const sheet = useBottomSheetInternal(true)
  const animatedIndex = sheet?.animatedIndex
  const progress = useSharedValue(animatedIndex == null ? 1 : 0)

  useAnimatedReaction(
    () => {
      if (animatedIndex == null) return 1
      const v = animatedIndex.value
      // Fractional only while sliding; snaps to an integer index when settled.
      return Math.abs(v - Math.round(v)) < 0.001 ? 1 : 0
    },
    (settled) => {
      progress.value = settled
    },
    [animatedIndex]
  )

  return <GlassSettleProvider value={progress}>{children}</GlassSettleProvider>
}

const Content = ({ children, animation }) => {
  if (animation === ANIMATION_DRAWER.SLIDE_FROM_BOTTOM) {
    return <SettledContent>{children}</SettledContent>
  } else {
    return <AnimatedContent animation={animation}>{children}</AnimatedContent>
  }
}

const BackDrop = ({ isHasBackdrop, index }) => {
  // Fade backdrop opacity 0 -> 1 on mount for a smooth appearance
  // instead of rendering dark color immediately (causes flickering).
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 })
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }))

  return (
    // NOTE: this view must keep swallowing touches. BottomSheet's own container is
    // pointerEvents="box-none", so the area beside the sheet blocks nothing — this
    // backdrop is the only thing stopping taps from reaching the screen behind an open
    // drawer. Making it pointerEvents="none" would let users press straight through it.
    <Animated.View
      style={[
        {
          position: 'absolute',
          backgroundColor: isHasBackdrop ? 'rgba(1,1,1,0.2)' : 'transparent',
          width: width(100),
          height: height(100),
          zIndex: 10 + (index + 1) * 2 - 1
        },
        animatedStyle
      ]} />
  )
}

const ModalCenter = ({ ...props }) => {
  return (
    <RNModal
      ref={props?.ref}
      visible
      transparent
      animationType='fade'
      statusBarTranslucent
      onBlur={props?.onPress}
      onDismiss={props?.onPress}
    >
      <Animated.View
        animation='zoomIn'
        duration={300}
        style={[
          {
            width: width(100),
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center'
          }, props.style]}
      >

        <View style={{ width: width(100), paddingHorizontal: pixelByWidth(16) }}>
          <View style={{ position: 'relative', width: '100%' }}>
            <View
              style={{
                zIndex: 10,
                pointerEvents: 'none',
                borderColor: Colors.BG_BOX_SMALL,
                borderWidth: 1,
                backgroundColor: 'transparent',
                borderRadius: 32,
                ...StyleSheet.absoluteFill
              }} />
            <MyLinearGradient disableClip variant='modal'>

              {props.children}

            </MyLinearGradient>
          </View>
        </View>
      </Animated.View>

    </RNModal>
  )
}

const MyDrawerUI = forwardRef((props, ref) => {
  const [drawers, setDrawers] = useState([])
  const drawersRef = useRef(new Map())

  const animationConfigs = useBottomSheetTimingConfigs({
    duration: 400
  })

  const drawersStateRef = useRef([])

  useEffect(() => {
    drawersStateRef.current = drawers
  }, [drawers])

  useImperativeHandle(ref, () => ({
    openDrawer: (drawer, heightDrawerDefault) => {
      const drawerConfig = { ...drawer }
      // Resolve & store the height PER drawer (stacked drawers can have different
      // heights). null → content-fit (BottomSheetView measures its content).
      drawerConfig.heightDrawer = drawer.heightDrawer || heightDrawerDefault || null

      if (drawerConfig?.addDrawer === true) {
        setDrawers(prev => [...prev, drawerConfig])
      } else {
        setDrawers([drawerConfig])
      }
    },
    // Popping the stack happens in exactly ONE place: the BottomSheet's onClose, which
    // fires both for a swipe-down and for a programmatic close() below. Doing it here
    // too would pop twice for a programmatic close — close() animates, onClose lands
    // mid-`sleep(400)` and pops, then this call pops again — which with a stacked
    // drawer (e.g. the NFC scan drawer over the Send form) tore down the drawer
    // underneath as well.
    closeDrawer: async (idDrawerDefault = null) => {
      const currentDrawers = drawersStateRef.current

      const indexDrawer = currentDrawers.length - 1
      const idDrawer = idDrawerDefault || `drawer-${indexDrawer}`

      const sheet = drawersRef.current.get(idDrawer)
      if (!sheet) {
        return
      }

      drawersRef.current.set(idDrawer, null)

      const isModalCenter = currentDrawers[indexDrawer]?.position === 'center'

      if (isModalCenter) {
        sheet?.dismiss?.()
        currentDrawers[indexDrawer]?.onClose?.()
        setDrawers(pre => pre.slice(0, -1))
      } else {
        sheet?.close()
      }

      await sleep(400)
    },
    closeAllDrawer: async () => {
      const currentDrawers = drawersStateRef.current
      currentDrawers.forEach((drawer, indexDrawer) => {
        const idDrawer = `drawer-${indexDrawer}`
        const sheet = drawersRef.current.get(idDrawer)

        if (sheet) {
          if (drawer?.position === 'center') {
            sheet?.dismiss?.()
          } else {
            sheet?.close()
          }
          drawersRef.current.set(idDrawer, null)
        }
      })
      await sleep(400)
      setDrawers([])
    }

  }), [drawers])

  return (
    <>
      {
        drawers.map((drawer, index) => {
          const idDrawer = `drawer-${index}`

          if (drawer?.position === 'center') {
            return (
              <ModalCenter
                ref={ref => drawersRef.current.set(idDrawer, ref)}
                key={idDrawer}
                style={{ zIndex: 10 + (index + 1) * 2 + 1 }}
                onPress={() => {
                  Keyboard.dismiss()
                  drawersRef.current.set(idDrawer, null)
                  drawer?.onClose?.()
                  setDrawers(pre => pre.slice(0, -1))
                }}
              >
                {drawer.children}
              </ModalCenter>
            )
          }

          return (
            <BottomSheet
              animationConfigs={animationConfigs}
              key={idDrawer}
              enablePanDownToClose
              enableOverDrag={false}
              backdropComponent={() => null}
              // top line hidden
              handleStyle={{
                display: 'none',
                height: 0
              }}
              // Always has animation when do disable animation in systems
              overrideReduceMotion={ReduceMotion.Never}
              backgroundComponent={() => null}
              ref={ref => drawersRef.current.set(idDrawer, ref)}
              {...drawer}
              onClose={() => {
                Keyboard.dismiss()
                // Release the ref BEFORE the callback: several screens pass an onClose
                // that itself calls closeDrawer() (WalletConnect, RequestCard). With the
                // ref already cleared that re-entrant call finds no sheet and returns,
                // instead of closing a second one.
                drawersRef.current.set(idDrawer, null)
                drawer?.onClose?.()
                // The single place the stack shrinks — reached by a swipe-down and by
                // closeDrawer()'s programmatic close() alike. Pops ONE entry, so closing
                // a stacked drawer leaves the one underneath mounted. Popping the tail
                // (rather than splicing out `index`) keeps every surviving drawer's
                // index — and therefore its `drawer-${index}` ref key — stable.
                setDrawers(pre => pre.slice(0, -1))
              }}
              style={{ zIndex: 10 + index + 1 }}
              containerStyle={{ zIndex: 10 + (index + 1) * 2 + 1 }}

            >
              <Content animation={drawer?.animation}>
                <BottomSheetView>
                  <MyLinearGradient
                    disableClip
                    configLinear={{
                      style: {
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0
                      }
                    }}
                    style={{
                      borderLeftWidth: 0,
                      borderRightWidth: 0,
                      borderWidth: 0,
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 0
                    }}
                    variant='modal'>
                    <View className='rounded-tl-[32px] rounded-tr-[32px] relative ' style={[{ width: width(100) }, drawer.heightDrawer && { height: drawer.heightDrawer }, mergeStyle(drawer.style)]}>
                      <View
                        style={{
                          zIndex: 10,
                          pointerEvents: 'none',
                          borderColor: Colors.BG_BOX_SMALL,
                          position: 'absolute',
                          borderWidth: 1,
                          borderBottomWidth: 0,
                          left: 0,
                          top: 0,
                          bottom: 0,
                          backgroundColor: 'transparent',
                          width: width(100),
                          ...BORDER_RADIUS_TOP_DRAWER
                        }} />

                      {drawer.children}

                    </View>
                  </MyLinearGradient>

                </BottomSheetView>
              </Content>

            </BottomSheet>
          )
        })
      }

      {/* backdrop custom before That need debounce close when close drawer */}
      {
        drawers.map((drawer, index) => {
          const isHasBackdrop = index === 0 || drawer.backdrop

          return (
            <BackDrop
              key={`backdrop-debounce-${index}`}
              isHasBackdrop={isHasBackdrop}
              index={index} />
          )
        })
      }
    </>
  )
})

export default MyDrawerUI
