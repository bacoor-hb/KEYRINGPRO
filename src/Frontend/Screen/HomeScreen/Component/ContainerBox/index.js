import { pixelByHeight, pixelByWidth } from 'common/styles'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import { View } from 'react-native'
import createStyles from './styles'
import * as Animatable from 'react-native-animatable'

const ContainerBox = ({ children, noAnimation }) => {
  const styles = createStyles()

  return (
    // react-native-animatable defaults useNativeDriver to FALSE, which put this
    // fade on the JS thread. It was NOT the cause of the home-screen jank (that
    // was measured separately), but fadeIn only animates opacity — which the
    // native driver supports — so there is no reason to pay for it in JS.
    <Animatable.View
      easing='linear'
      duration={200}
      useNativeDriver
      animation={noAnimation ? undefined : 'fadeIn'}>
      <MyLinearGradient style={styles.containerBox}>
        <View style={{ paddingHorizontal: pixelByWidth(12), gap: pixelByHeight(0) }}>
          {children}
        </View>
      </MyLinearGradient>
    </Animatable.View>

  )
}

export default ContainerBox
