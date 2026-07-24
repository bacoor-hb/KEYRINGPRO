import { StyleSheet, View } from 'react-native'
import React from 'react'
import MyLottie from 'frontend/Components/UI/MyLottie'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import images from 'assets/Image'

const LogoApp = () => {
  const { theme } = React.useContext(ThemeContext)
  return (
    <View style={styles.container}>
      <MyLottie source={theme === 'dark' ? images.keyringLogoLightmode : images.keyringLogoLightmode} autoPlay loop style={styles.logo} />
    </View>
  )
}

export default LogoApp

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logo: {
    width: 100,
    height: 100
  }
})
