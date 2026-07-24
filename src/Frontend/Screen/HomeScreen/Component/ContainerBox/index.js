import { pixelByHeight, pixelByWidth } from 'common/styles'
import MyLinearGradient from 'frontend/Components/UI/MyLinearGradient'
import { View } from 'react-native'
import createStyles from './styles'
import * as Animatable from 'react-native-animatable'

const ContainerBox = ({ children, noAnimation }) => {
  const styles = createStyles()

  return (
    <Animatable.View easing='linear' duration={200} animation={noAnimation ? undefined : 'fadeIn'}>
      <MyLinearGradient style={styles.containerBox}>
        <View style={{ paddingHorizontal: pixelByWidth(12), gap: pixelByHeight(0) }}>
          {children}
        </View>
      </MyLinearGradient>
    </Animatable.View>

  )
}

export default ContainerBox
