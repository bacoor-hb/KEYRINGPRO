import { Colors, pixelByWidth } from 'common/styles'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import MyBgBlur from '../MyBlur'

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    zIndex: 2
  }
})

const ContainerAnchor = ({ defaultColor = 'transparent', fallbackColor = Colors.BLACK, children, style, onSetHeightContainer }) => {
  const [heightContainer, setHeightContainer] = useState(0)

  const onLayout = (event) => {
    const { height } = event.nativeEvent.layout
    setHeightContainer(height)
    onSetHeightContainer?.(height)
  }

  return (
    <View style={styles.container}>
      <View onLayout={onLayout} style={[{ position: 'relative' }, style]}>
        <MyBgBlur
          style={{
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            overflow: 'hidden'
          }}
          defaultColor={defaultColor}
          fallbackColor={fallbackColor}
          height={heightContainer} />
        <View style={{ paddingLeft: pixelByWidth(16), paddingRight: pixelByWidth(16) }} className='relative z-10'>
          {children}
        </View>
      </View>
    </View>
  )
}

export default ContainerAnchor
